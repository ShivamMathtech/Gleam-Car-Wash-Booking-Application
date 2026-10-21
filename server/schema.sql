PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, phone TEXT UNIQUE,
 password_hash TEXT, role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
 location TEXT NOT NULL DEFAULT 'Rajpur Road, Dehradun', lat REAL NOT NULL DEFAULT 30.3398,
 lng REAL NOT NULL DEFAULT 78.0563, notifications_enabled INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS otps (
 phone TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, requested_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS vehicles (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, plate TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('hatchback','sedan','suv','muv')),
 color TEXT NOT NULL DEFAULT 'White', UNIQUE(user_id, plate)
);
CREATE TABLE IF NOT EXISTS providers (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, area TEXT NOT NULL, address TEXT NOT NULL,
 lat REAL NOT NULL, lng REAL NOT NULL, description TEXT NOT NULL, phone TEXT NOT NULL,
 opens INTEGER NOT NULL, closes INTEGER NOT NULL, capacity INTEGER NOT NULL DEFAULT 2,
 image TEXT NOT NULL, accent TEXT NOT NULL, features TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS services (
 id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id), name TEXT NOT NULL,
 category TEXT NOT NULL, description TEXT NOT NULL, price INTEGER NOT NULL CHECK(price >= 0),
 duration INTEGER NOT NULL CHECK(duration > 0), features TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS favorites (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider_id TEXT NOT NULL REFERENCES providers(id),
 PRIMARY KEY(user_id, provider_id)
);
CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
 provider_id TEXT NOT NULL REFERENCES providers(id), vehicle_snapshot TEXT NOT NULL,
 service_snapshot TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, start_at INTEGER NOT NULL,
 end_at INTEGER NOT NULL, duration INTEGER NOT NULL, subtotal INTEGER NOT NULL, discount INTEGER NOT NULL,
 total INTEGER NOT NULL, coupon TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('confirmed','checked_in','in_progress','completed','cancelled')),
 payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid')),
 request_key TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(user_id, request_key)
);
CREATE INDEX IF NOT EXISTS idx_booking_slots ON bookings(provider_id, start_at, end_at, status);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, created_at);
CREATE TABLE IF NOT EXISTS reviews (
 id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id), user_id TEXT REFERENCES users(id),
 booking_id TEXT UNIQUE REFERENCES bookings(id), author TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 comment TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, body TEXT NOT NULL, booking_id TEXT REFERENCES bookings(id),
 is_read INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL,
 entity_id TEXT NOT NULL, detail TEXT NOT NULL, created_at INTEGER NOT NULL
);
