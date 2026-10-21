# Architecture

## Runtime

React renders the customer and administrator interfaces. Hash-based navigation keeps routes compatible with the included static build. A shared client wraps `fetch`, sends the session's CSRF token and uses same-origin cookies. Form data is validated in the API even when the browser has already validated it.

Node's HTTP server serves the compiled frontend and `/api/*` endpoints from one origin. Node's built-in SQLite module provides local persistent storage without native npm database add-ons. Vite is only required when building or editing the frontend.

Development starts the API on 127.0.0.1:4000 and Vite on port 4173. Vite proxies `/api`. Normal startup serves the included build on port 4000.

## Storage

| Table         | Purpose                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| metadata      | Schema and demo/production seed mode                                       |
| users         | Accounts, password hashes, roles and location/preferences                  |
| sessions      | Hashed session tokens, CSRF tokens and expiry                              |
| otps          | Hashed phone/code pairs, expiration, attempts and request timestamps       |
| vehicles      | Owner-scoped garage records                                                |
| providers     | Centre details, location, hours, capacity and visibility                   |
| services      | Provider-specific service prices, durations and inclusions                 |
| favorites     | Unique customer/centre relationships                                       |
| bookings      | Appointment times, immutable vehicle/service snapshots, amounts and status |
| reviews       | One review per completed booking, plus explicitly marked demo reviews      |
| notifications | Persistent user-scoped booking updates                                     |
| audit_log     | Actor and before/after state for admin booking changes                     |

SQLite foreign keys, uniqueness constraints and indexes protect relationships. Booking reads/writes use prepared statements. `BEGIN IMMEDIATE` keeps availability, price validation and insertion in the same transaction. The schema is version 1; future structural changes should be introduced as explicit migrations rather than deleting a live database.

## Booking capacity

All appointment datetimes use a fixed `+05:30` offset. Slots start every 30 minutes and must fit the combined selected duration before closing time. The API compares existing intervals with a proposed interval. A sweep-line count over interval starts/ends ensures the concurrent bookings do not exceed the centre's capacity. End events are handled before start events at the same timestamp, allowing adjacent visits.

Cancelled appointments do not consume capacity. All other appointments retain their occupied historical intervals. Each customer is independently blocked from holding overlapping appointments. Each `(user_id, request_key)` is unique; retrying a successful request returns the original booking.

Price and duration are taken from the database, never trusted from the browser. Old bookings keep service/vehicle snapshots. Changing a catalogue price or removing a garage vehicle does not change an earlier booking receipt.

## Status and payment

| Current status | Allowed admin transitions |
| -------------- | ------------------------- |
| confirmed      | checked_in, cancelled     |
| checked_in     | in_progress, cancelled    |
| in_progress    | completed                 |
| completed      | None                      |
| cancelled      | None                      |

Customers can cancel only their own upcoming confirmed booking. Payment is a separate manual flag. It can be recorded during service or after completion. It cannot be reversed through this interface. No payment is initiated by any endpoint.

## Security decisions

- Passwords: random salt and Node `scrypt`, compared with timing-safe equality.
- Sessions: 256-bit random cookie token, only its SHA-256 hash stored, 7-day expiry, HttpOnly and SameSite=Lax. Secure cookies are mandatory in production mode.
- All authenticated mutations require the session CSRF header. Origin and Fetch Metadata checks reject cross-site browser writes. JSON content type and a 32 KiB body limit apply to mutations.
- Roles and resource ownership are enforced by the API, not just by hidden UI buttons.
- OTPs are random, hashed at rest, expire in 5 minutes, and allow at most five guesses. Rate limits also apply to request, login, registration and booking actions.
- Basic rate limiting is per-process and keyed by the actual socket address. Forwarded IP headers are not blindly trusted. A production reverse proxy should add its own shared rate limiting; otherwise clients behind one proxy share the IP-level budget.
- Dynamic React text is escaped; the app does not insert user HTML. Production responses set CSP, frame, MIME and referrer headers.
- Production startup refuses a database seeded in demo mode. Production uses a separately configured admin and an empty catalogue.

## Current boundaries

This is a single-server application. SQLite and synchronous password hashing are appropriate for this small local deployment, but large workloads need a measured migration plan, connection-aware rate limits and asynchronous/worker-based password processing. There is no distributed cache, background notification queue, payment gateway, email account recovery, holiday calendar, multi-timezone scheduling, multi-owner centre permissions or tenant isolation.

## Frontend modules

- `App.jsx`: session state, shell, navigation, location picker, notifications and feedback.
- `pages/Home.jsx`: discover, nearby, filters, favourites and area overview.
- `pages/Centre.jsx`: provider details, services, reviews and gallery.
- `pages/Booking.jsx`: vehicle/service selection, server quote, availability and checkout.
- `pages/Account.jsx`: visits, reviews, receipts, calendar exports, garage and profile.
- `pages/Admin.jsx`: operations dashboard, status updates, payments, CSV and catalogue forms.
- `components/UI.jsx`: accessible modal focus handling, form controls, cards and shared components.
- `components/Auth.jsx`: email and mobile sign-in forms and demo entry controls.

## Primary documentation

- [Node SQLite](https://nodejs.org/api/sqlite.html)
- [Vite production builds](https://vite.dev/guide/build.html)
- [Twilio Messages API](https://www.twilio.com/docs/messaging/api/message-resource)
