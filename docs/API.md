# API reference

Base path: `/api`. Responses are JSON. Failed requests return `{ "error": "Human-readable message" }`.

Mutations use `Content-Type: application/json`. Once signed in, include `X-CSRF-Token` from `/session` or the login response. Browser requests use the HttpOnly `gleam_session` cookie. The frontend handles this automatically.

## Public and authentication

| Method | Route                  | Purpose / body                                        |
| ------ | ---------------------- | ----------------------------------------------------- |
| GET    | `/health`              | API readiness and version                             |
| GET    | `/session`             | Current user, CSRF token, demo/SMS flags and timezone |
| POST   | `/auth/register`       | `{name,email,password}`; password 10–128 characters   |
| POST   | `/auth/login`          | `{email,password}`                                    |
| POST   | `/auth/request-otp`    | `{phone}`; Indian mobile, e.g. `+919123456789`        |
| POST   | `/auth/verify-otp`     | `{phone,code}`; six-digit code                        |
| POST   | `/auth/logout`         | `{}`; destroys current session                        |
| PUT    | `/auth/password`       | `{currentPassword,newPassword}`; authenticated        |
| GET    | `/providers`           | Search and filter centre directory                    |
| GET    | `/providers/:id`       | Centre, active services and latest reviews            |
| GET    | `/providers/:id/slots` | `date=YYYY-MM-DD&duration=30`                         |

Provider query parameters: `q`, `lat`, `lng`, `category` (Exterior/Interior/Detailing/Protection), `sort` (distance/rating/price), `open=true`, `maxPrice`, and `favorite=true` (signed-in user's favourites).

## Customer resources

| Method | Route                    | Purpose / body                                                         |
| ------ | ------------------------ | ---------------------------------------------------------------------- |
| PUT    | `/profile`               | `{name,email,location,lat,lng,notificationsEnabled}`                   |
| GET    | `/vehicles`              | Own garage                                                             |
| POST   | `/vehicles`              | `{name,plate,kind,color}`; kind hatchback/sedan/suv/muv                |
| PUT    | `/vehicles/:id`          | Same fields as create, own vehicle only                                |
| DELETE | `/vehicles/:id`          | Remove own vehicle; snapshots stay on existing bookings                |
| PUT    | `/favorites/:providerId` | Save a centre                                                          |
| DELETE | `/favorites/:providerId` | Unsave a centre                                                        |
| GET    | `/notifications`         | Latest 100 own notifications                                           |
| POST   | `/notifications/read`    | Mark own notifications read                                            |
| POST   | `/bookings/quote`        | Validate service/vehicle/coupon and compute total                      |
| POST   | `/bookings`              | Create an appointment atomically                                       |
| GET    | `/bookings`              | Own booking history with review state                                  |
| POST   | `/bookings/:id/cancel`   | Cancel own upcoming confirmed booking                                  |
| POST   | `/bookings/:id/review`   | `{rating,comment}`; completed visit, rating 1–5, comment 10–1000 chars |

Quote request:

```json
{
  "providerId": "proglow",
  "serviceIds": ["proglow-signature"],
  "vehicleId": "demo-car",
  "coupon": "FIRST20"
}
```

Create request adds the following to the quote fields. Use a future date and an available slot returned by the API, and generate a fresh request key for each intended new booking:

```json
{
  "date": "YYYY-MM-DD",
  "time": "10:00",
  "notes": "Please check the boot area.",
  "requestKey": "a-new-unique-request-id-at-least-16-characters"
}
```

Example quote response:

```json
{
  "subtotal": 499,
  "discount": 99,
  "total": 400,
  "duration": 30,
  "surcharge": 0,
  "coupon": "FIRST20"
}
```

The date example is a placeholder. The application always obtains real future dates from the clock. Client-supplied totals, role assignments and payment flags are not trusted during customer booking creation.

## Administrator routes

| Method | Route                  | Purpose                                                                  |
| ------ | ---------------------- | ------------------------------------------------------------------------ |
| GET    | `/admin/dashboard`     | Counts, collected revenue, latest 1000 bookings and full catalogue       |
| PATCH  | `/admin/bookings/:id`  | `{status}` and/or `{paymentStatus:"paid"}`; allowed transitions enforced |
| POST   | `/admin/providers`     | Create centre                                                            |
| PUT    | `/admin/providers/:id` | Update centre / visibility                                               |
| POST   | `/admin/services`      | Create service                                                           |
| PUT    | `/admin/services/:id`  | Update service / visibility                                              |

Provider body: `name`, `area`, `address`, numeric `lat/lng`, `description`, `phone`, integer `opens/closes` (hours in IST), integer `capacity`, `image` (wash/studio/foam/detail), `features` array and boolean `active`.

Service body: `providerId`, `name`, `category`, `description`, integer `price`, integer `duration` (minutes), `features` array and boolean `active`.

Existing bookings remain visible after a centre or service is hidden. The app rejects reducing a centre's capacity while it has future non-cancelled bookings. New catalogue entries are active; the edit endpoint can subsequently hide them.

## Status codes

`400` validation; `401` sign-in required/invalid login; `403` ownership role/origin/CSRF failure; `404` missing resource; `409` uniqueness, availability or lifecycle conflict; `413` request too large; `415` wrong content type; `429` rate limit; `503` unavailable SMS or missing frontend build.

## SMS adapter

In demo mode the response to request-otp includes `demoCode`, clearly displayed in the UI. In production it never returns a code. With server-side Twilio settings present, the adapter posts a form-encoded request to the Twilio Messages API using HTTP Basic authentication and a ten-second timeout. Successful API acceptance is not proof of handset delivery; configure and verify actual delivery with your provider before enabling it for customers.
