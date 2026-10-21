# Release verification

Release: Gleam 1.0.0. Verified on 20 October 2026 in a Linux environment with Node.js 24.19.0.

## Automated checks

- Production frontend compiled with Vite.
- Node syntax checks passed.
- The release copy started successfully through `scripts/start.mjs` from a folder containing spaces, with no `node_modules` directory and no package installation. Its health endpoint, compiled HTML/CSS/JavaScript, image asset, customer login and garage endpoint all responded successfully.
- All 24 integration tests passed. Run `npm test` from the project directory to repeat them; the included `dist/` folder is required by the static-serving test.
- Tests cover registration, authentication, roles, CSRF/origin checks, vehicles and ownership, server-calculated prices, coupons, booking idempotency, overlapping appointment capacity, customer conflicts, date and hours validation, cancellation, admin state changes, payment recording, completed-visit reviews, notifications, favourites, one-time OTP use, password/session changes, historical snapshots, catalogue administration, database persistence, production configuration, and static security headers.

## Browser checks

- Inspected the desktop discovery page and centre details.
- Completed the customer booking flow with the demo account, a saved vehicle, an available slot and FIRST20. The server returned a booking confirmation at ₹400 for a ₹499 service.
- Checked the booking list and receipt dialog.
- Checked the 390 × 844 mobile layout, bottom navigation and profile view. No horizontal overflow was observed in the mobile frame.
- Admin booking lifecycle and permission checks were exercised through the API integration tests.

## Scope

These checks establish the supplied local application's core behaviour. Windows command scripts and Docker configuration are included but were not executed on Windows or in Docker during verification. Live Twilio delivery, real payment processing, production hosting, multi-process load and a formal accessibility or security audit were not performed. Payments are recorded manually for collection at the centre; demo OTPs do not send SMS.

Test data, browser-session data and development dependencies are excluded from the release archive. A fresh sample database is created on first local launch.
