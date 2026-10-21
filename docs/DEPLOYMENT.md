# Deployment

## Local demo

Use `START-WINDOWS.cmd` or `node scripts/start.mjs`. The default server binds to `127.0.0.1`. The included Compose setup also exposes its demo port only on the local host:

```bash
docker compose up --build -d
```

Visit http://localhost:4000. SQLite is stored in the named `gleam-data` volume. Docker configuration is supplied, but Docker itself was not run in this verification environment.

## Internet hosting

Deploy the **whole Node application** on a server/container with a persistent writable disk. Serving only `dist/` on a static host will not run the API or save bookings. This SQLite server is not configured for ephemeral serverless storage or several app replicas.

1. Install Node 24 and copy the project (or build the Docker image).
2. Copy `.env.example` to `.env` and configure production values below.
3. Use a **new database path**. Do not promote the supplied demo database into production.
4. Run the server under your process manager/container runtime with automatic restart.
5. Put an HTTPS reverse proxy in front of the application, forwarding the same origin for the frontend and `/api`.
6. Sign in using your own configured administrator, then create real centres and services from **Manage centres**.
7. Back up the database consistently and monitor server errors and free disk space.

Example configuration with placeholders to replace:

```dotenv
HOST=127.0.0.1
PORT=4000
DB_PATH=./data-production/gleam.sqlite
DEMO_MODE=false
APP_ORIGIN=https://wash.example.com
COOKIE_SECURE=true
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=REPLACE_WITH_A_UNIQUE_LONG_PASSWORD
```

The initial admin is created only when the database is first seeded. Changing `ADMIN_PASSWORD` later does not silently overwrite an existing account. Use the application's authenticated password-change form for an existing administrator.

With production mode enabled, startup requires HTTPS configuration, secure cookies, and first-boot administrator credentials. A new production database contains no demo customers, providers or reviews. The frontend removes the demo login buttons and demo-OTP display when the server reports production mode.

Sample Nginx reverse proxy fragment (your TLS certificates and DNS must be configured separately):

```nginx
location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 64k;
}
```

Set `APP_ORIGIN` to the exact HTTPS origin users visit, without a trailing slash. The application intentionally does not provide permissive cross-origin CORS. Add proxy-level rate limiting for public traffic; the built-in in-memory limiter sees the socket IP and does not trust arbitrary `X-Forwarded-For` headers.

## Real mobile OTP

Set these **server-only** variables in addition to production settings:

```dotenv
TWILIO_ACCOUNT_SID=YOUR_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_AUTH_TOKEN
TWILIO_FROM_NUMBER=YOUR_ENABLED_SENDER
```

The adapter uses the [Twilio Messages API](https://www.twilio.com/docs/messaging/api/message-resource). Use a sender enabled for your intended recipients and verify actual delivery with your provider. If the adapter is not configured, mobile login is unavailable and customers can use email/password. Live SMS was not exercised in the supplied tests, and no SMS was sent during development.

## Operational scope

- Payments remain pay at centre. Recording payment is not a gateway transaction.
- The app does not send emails, background SMS reminders or browser push notifications.
- Centre contact information, hours, capacity and prices must be maintained by the administrator.
- Appointment times currently use IST throughout. Supporting another timezone requires coordinated server and frontend changes.
- SQLite supports this single-server implementation. Multi-instance deployments require a deliberate shared-database and rate-limiting design.
- Password recovery, email verification, tax invoices and granular provider staff roles are extensions, not connected services in this release.

This guide describes how to run the implemented application. Load testing, third-party service delivery and your actual hosting environment still need their own validation.
