# Gleam — Car Wash Booking Application

A working, responsive car wash application inspired by the supplied coral-red mobile design. It includes a React frontend, a Node.js API, a persistent SQLite database, customer workflows and a centre administration dashboard.

## Run it on Windows — quickest option

1. Install **Node.js 24 LTS** from [nodejs.org](https://nodejs.org/).
2. Extract this ZIP completely into a normal folder, for example `G:\projects\gleam-car-wash`.
3. Double-click **START-WINDOWS.cmd**.
4. Open **http://localhost:4000** in your browser.
5. Select **Sign in → Customer demo** or **Admin demo**.

The compiled frontend is included in `dist/`. The regular launch does **not** need `npm install`, Python, MongoDB, a separate SQL server, Docker, or paid API keys. Keep the server window open while using the app.

Command-line alternative:

```bash
node scripts/start.mjs
```

Linux/macOS: `sh start.sh` with Node 24 installed.

## Demo accounts

| Role          | Email                | Password      |
| ------------- | -------------------- | ------------- |
| Customer      | customer@gleam.local | GleamDemo123! |
| Administrator | admin@gleam.local    | AdminDemo123! |

These are deliberately public **local demo credentials**, not deployment secrets. You may also create an email account. Mobile sign-in accepts an Indian number and displays a newly generated, six-digit demo OTP; no SMS is sent in demo mode. Phone accounts and email accounts are separate unless they already belong to the same database user. Email signup does not automatically claim or verify a phone number.

## What works

- Responsive desktop navigation and mobile bottom navigation.
- Email registration, password login, mobile OTP sign-in, logout, and password changes.
- Provider search; distance, price and rating sorting; category, price and open-now filters.
- Manual location selection and opt-in browser geolocation. Default sample city: Dehradun.
- Centre details, amenities, services, illustrative gallery and reviews.
- Saved centres and a persistent vehicle garage with create, edit and delete.
- Three-step booking: vehicle/services → date/time → review/confirmation.
- Server-calculated pricing, vehicle surcharges and validated offer codes.
- Appointment capacity across overlapping service durations, opening-hours checks and customer overlap prevention.
- Idempotent booking submission so a retry does not create a duplicate reservation.
- Upcoming/active visits, visit history, cancellation, receipt printing/PDF via the browser and `.ics` calendar downloads.
- Google Maps directions links to centre coordinates.
- Reviews restricted to a completed visit, once per booking.
- Booking notifications and unread indicators.
- Admin booking dashboard, lifecycle management, manual payment recording, CSV export, and centre/service catalogue management.
- Persistent SQLite storage, session cookies, CSRF checks, request validation, role checks, password hashing and an audit log for booking updates.
- 24 automated integration tests, Windows launch/setup scripts, Dockerfile and Compose configuration.

## Try the complete workflow

1. Sign in using **Customer demo**.
2. Open **Proglow Auto Spa → Book a service**.
3. Select the preloaded Hyundai i20 and Signature wash. Add another vehicle from **My garage** if preferred.
4. Enter `FIRST20` and apply it, then select an available future time.
5. Review the booking and confirm it. You receive a booking code and an unpaid booking record.
6. Open **My bookings** to view the visit, download the calendar event, get directions or print its receipt.
7. Sign out. Sign in using **Admin demo**, then open **Manage centres**.
8. Progress the booking through **Checked in → In progress → Completed**.
9. Use **Record payment** only to record payment collected at the centre. It does not charge a card or UPI account.
10. Return to the customer account, open **Past visits**, and leave a review.

## Pricing and appointment rules

- All amounts are integer Indian rupees (INR). There is no tax calculation module.
- Hatchbacks/sedans: no size surcharge. SUV: ₹150 per visit; MUV: ₹200 per visit.
- Service prices and durations are added if multiple services are selected. Some packages already contain other treatments; select only the combinations you intend to buy.
- `FIRST20`: first non-cancelled booking, minimum ₹499, 20% discount capped at ₹200.
- `SHINE10`: minimum ₹799, 10% discount capped at ₹150.
- Discounts are rounded down to whole rupees. For example, ₹499 with `FIRST20` receives ₹99 off, total ₹400.
- Bookings use **Asia/Kolkata (IST)** regardless of the browser timezone.
- Appointments start on half-hour boundaries, at least 15 minutes ahead, within the next 30 days.
- The entire service must fit inside opening hours. Overlaps consume the centre's configured wash bays.
- Customers cannot hold overlapping non-cancelled visits, including across different centres.
- Customers may cancel an upcoming confirmed appointment. After check-in, the centre manages changes.
- Past bookings retain vehicle/service snapshots, even if those records change later.

## Development

Use **SETUP-WINDOWS.cmd** once to install packages, build and run tests. Then use **DEV-WINDOWS.cmd** while editing.

```bash
npm ci
npm run dev
```

- React/Vite frontend: http://localhost:4173
- API: http://localhost:4000/api
- Development proxy keeps browser requests on one origin.
- Stop the regular launch before starting development, since both use API port 4000.

Build and test:

```bash
npm run build
npm run check
npm test
```

After editing React/CSS, run `npm run build` to update the compiled frontend used by `START-WINDOWS.cmd`.

## Project layout

```text
gleam-car-wash/
  src/                  React screens, components, client and styles
  server/               HTTP API, auth, booking rules, SQLite schema/seed
  public/               Local image and favicon assets
  dist/                 Included compiled frontend
  scripts/              Cross-platform start/development scripts
  tests/                API and persistence integration tests
  docs/                 Setup, architecture, API and deployment guides
  START-WINDOWS.cmd     Run the included build
  SETUP-WINDOWS.cmd     Install development tools, build and test
  DEV-WINDOWS.cmd       Run React hot reload + API
  .env.example          Configuration reference
  Dockerfile
  compose.yaml
```

`data/gleam.sqlite` is created on first launch. Application data and sessions survive restarts. No test database or personal data is included in this release.

## Demo boundaries and external services

This is a functional local application, with explicitly labelled sample business data. The four centres, contact numbers and initial reviews are demonstration records. The hero/gallery image is original AI-generated artwork and is not a photograph of those businesses.

The area overview is an illustrative coordinate diagram, not live cartography or turn-by-turn navigation. **Get directions** opens Google Maps. The application has no live GPS route simulation, video library or car-wash equipment integration.

Payments are **pay at centre** only. No payment gateway, email verification/reset delivery or push-notification service is connected. Notifications are stored in the app and polled while it is open. The profile setting controls unread badges. Real SMS requires a configured Twilio account and an appropriately enabled sender; delivery was not tested with live credentials. Registered email accounts without a linked phone use password sign-in; phone-only OTP sign-in does not reset an unrelated email account.

For Internet deployment, use the separate production setup in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Production mode starts with an empty centre catalogue and a new administrator; it refuses to reuse a demo database. This release is a tested working starter, not a claim of an audited high-scale production system.

## More information

- [Windows setup and troubleshooting](docs/WINDOWS-SETUP.md)
- [Architecture and storage](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Verification notes](docs/VERIFICATION.md)
- [Asset and dependency notices](THIRD-PARTY-NOTICES.md)

Prepared for Shivam Singh.
