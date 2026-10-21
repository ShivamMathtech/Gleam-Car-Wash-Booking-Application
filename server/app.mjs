import { createServer } from "node:http";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./db.mjs";
import { authRoute, sessionFor } from "./auth.mjs";
import {
  HttpError,
  fail,
  textValue,
  emailValue,
  createLimiter,
  publicUser,
} from "./security.mjs";
import {
  quote,
  getSlots,
  validateSlot,
  bookingView,
  todayIST,
} from "./booking.mjs";

const root = fileURLToPath(new URL("../dist", import.meta.url));
const bookingSQL =
  "SELECT b.*, p.name as provider_name,p.area as provider_area,p.address as provider_address,p.lat as provider_lat,p.lng as provider_lng,p.image as provider_image,p.phone as provider_phone FROM bookings b JOIN providers p ON p.id=b.provider_id";
const allowedTransitions = {
  confirmed: ["checked_in", "cancelled"],
  checked_in: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};
const integer = (v, name, min, max) => {
  fail(
    !Number.isInteger(v) || v < min || v > max,
    400,
    `${name} must be between ${min} and ${max}.`,
  );
  return v;
};
function coordinate(v, name, min, max) {
  fail(
    typeof v !== "number" || !Number.isFinite(v) || v < min || v > max,
    400,
    `${name} is invalid.`,
  );
  return v;
}
function distance(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180,
    a =
      Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
      Math.cos(lat1 * r) *
        Math.cos(lat2 * r) *
        Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return (
    Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
  );
}
function providerView(db, p, user, lat, lng) {
  const rating = db
    .prepare(
      "SELECT AVG(rating) as rating,COUNT(*) as count FROM reviews WHERE provider_id=?",
    )
    .get(p.id);
  const min = db
    .prepare(
      "SELECT MIN(price) as price FROM services WHERE provider_id=? AND active=1",
    )
    .get(p.id);
  const minutes = (Date.now() / 60000 + 330) % 1440;
  return {
    ...p,
    features: JSON.parse(p.features),
    rating: rating.rating ? Math.round(rating.rating * 10) / 10 : null,
    reviewCount: rating.count,
    fromPrice: min.price,
    distance: distance(lat, lng, p.lat, p.lng),
    isOpen: !!p.active && minutes >= p.opens * 60 && minutes < p.closes * 60,
    favorite: user
      ? !!db
          .prepare("SELECT 1 FROM favorites WHERE user_id=? AND provider_id=?")
          .get(user.id, p.id)
      : false,
  };
}
async function parseBody(req) {
  fail(
    !String(req.headers["content-type"] || "").includes("application/json"),
    415,
    "Send application/json.",
  );
  let size = 0,
    parts = [];
  for await (const chunk of req) {
    size += chunk.length;
    fail(size > 32768, 413, "Request is too large.");
    parts.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(parts).toString() || "{}");
    fail(
      !value || typeof value !== "object" || Array.isArray(value),
      400,
      "Invalid request.",
    );
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON.");
  }
}
export function createApp(config) {
  const db = openDatabase(config),
    limit = createLimiter();
  db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now());
  db.prepare("DELETE FROM otps WHERE expires_at<?").run(Date.now());
  function notify(userId, title, body, bookingId = null) {
    db.prepare("INSERT INTO notifications VALUES (?,?,?,?,?,0,?)").run(
      randomUUID(),
      userId,
      title,
      body,
      bookingId,
      Date.now(),
    );
  }
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(self), camera=(), microphone=()",
    );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    const send = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    try {
      const url = new URL(req.url, "http://local"),
        path = url.pathname,
        method = req.method;
      if (!path.startsWith("/api/")) {
        fail(!["GET", "HEAD"].includes(method), 405, "Method not allowed.");
        let file = resolve(root, `.${decodeURIComponent(path)}`);
        fail(
          file !== root && !file.startsWith(root + sep),
          403,
          "Access denied.",
        );
        try {
          if (!(await stat(file)).isFile()) file = resolve(root, "index.html");
        } catch {
          fail(!!extname(path), 404, "File not found.");
          file = resolve(root, "index.html");
        }
        const bytes = await readFile(file).catch(() => {
          throw new HttpError(
            503,
            "Frontend build missing. Run npm install and npm run build.",
          );
        });
        const types = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".webp": "image/webp",
          ".png": "image/png",
          ".woff2": "font/woff2",
        };
        res.writeHead(200, {
          "Content-Type": types[extname(file)] || "application/octet-stream",
          "Cache-Control":
            extname(file) === ".html" ? "no-cache" : "public, max-age=3600",
        });
        res.end(method === "HEAD" ? undefined : bytes);
        return;
      }
      const mutation = !["GET", "HEAD"].includes(method);
      if (mutation) {
        const origins = new Set([config.appOrigin]);
        if (config.demo)
          [
            "http://localhost:4000",
            "http://127.0.0.1:4000",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://terminal.local:4173",
          ].forEach((x) => origins.add(x));
        fail(
          req.headers.origin && !origins.has(req.headers.origin),
          403,
          "Origin is not allowed.",
        );
        fail(
          req.headers["sec-fetch-site"] === "cross-site",
          403,
          "Cross-site requests are not allowed.",
        );
      }
      const session = sessionFor(db, req),
        user = session?.user;
      if (mutation && session)
        fail(
          req.headers["x-csrf-token"] !== session.csrf,
          403,
          "Your session changed. Refresh the page and try again.",
        );
      const data = mutation ? await parseBody(req) : {};
      const ctx = {
        path,
        method,
        db,
        config,
        req,
        res,
        data,
        session,
        send,
        limit,
      };
      if (await authRoute(ctx)) return;
      if (path === "/api/health" && method === "GET") {
        send(200, { ok: true, version: "1.0.0" });
        return;
      }
      if (path === "/api/providers" && method === "GET") {
        const lat = url.searchParams.has("lat")
          ? coordinate(Number(url.searchParams.get("lat")), "Latitude", -90, 90)
          : (user?.lat ?? 30.3398);
        const lng = url.searchParams.has("lng")
          ? coordinate(
              Number(url.searchParams.get("lng")),
              "Longitude",
              -180,
              180,
            )
          : (user?.lng ?? 78.0563);
        const q = (url.searchParams.get("q") || "").toLowerCase().slice(0, 100),
          category = url.searchParams.get("category");
        let providers = db
          .prepare("SELECT * FROM providers WHERE active=1")
          .all()
          .map((p) => providerView(db, p, user, lat, lng));
        if (q)
          providers = providers.filter((p) =>
            `${p.name} ${p.area} ${p.address}`.toLowerCase().includes(q),
          );
        if (category)
          providers = providers.filter((p) =>
            db
              .prepare(
                "SELECT 1 FROM services WHERE provider_id=? AND category=? AND active=1",
              )
              .get(p.id, category),
          );
        if (url.searchParams.get("open") === "true")
          providers = providers.filter((p) => p.isOpen);
        if (url.searchParams.get("favorite") === "true")
          providers = providers.filter((p) => p.favorite);
        if (url.searchParams.has("maxPrice"))
          providers = providers.filter(
            (p) =>
              p.fromPrice !== null &&
              p.fromPrice <= Number(url.searchParams.get("maxPrice")),
          );
        const sort = url.searchParams.get("sort");
        providers.sort(
          sort === "rating"
            ? (a, b) => (b.rating || 0) - (a.rating || 0)
            : sort === "price"
              ? (a, b) => (a.fromPrice ?? Infinity) - (b.fromPrice ?? Infinity)
              : (a, b) => a.distance - b.distance,
        );
        send(200, { providers, demoMode: config.demo });
        return;
      }
      let match = path.match(/^\/api\/providers\/([^/]+)$/);
      if (match && method === "GET") {
        const p = db
          .prepare("SELECT * FROM providers WHERE id=? AND active=1")
          .get(match[1]);
        fail(!p, 404, "Centre not found.");
        send(200, {
          provider: providerView(
            db,
            p,
            user,
            user?.lat ?? 30.3398,
            user?.lng ?? 78.0563,
          ),
          services: db
            .prepare(
              "SELECT * FROM services WHERE provider_id=? AND active=1 ORDER BY price",
            )
            .all(p.id)
            .map((s) => ({ ...s, features: JSON.parse(s.features) })),
          reviews: db
            .prepare(
              "SELECT id,author,rating,comment,is_demo,created_at FROM reviews WHERE provider_id=? ORDER BY created_at DESC LIMIT 100",
            )
            .all(p.id),
        });
        return;
      }
      match = path.match(/^\/api\/providers\/([^/]+)\/slots$/);
      if (match && method === "GET") {
        const provider = db
          .prepare("SELECT * FROM providers WHERE id=? AND active=1")
          .get(match[1]);
        fail(!provider, 404, "Centre not found.");
        send(200, {
          slots: getSlots(
            db,
            provider,
            url.searchParams.get("date"),
            Number(url.searchParams.get("duration")),
            user?.id,
          ),
        });
        return;
      }
      fail(!user, 401, "Please sign in to continue.");
      if (path === "/api/profile" && method === "PUT") {
        const name = textValue(data.name, "Name", 2, 80),
          email = data.email ? emailValue(data.email) : null;
        fail(
          email &&
            db
              .prepare("SELECT 1 FROM users WHERE email=? AND id!=?")
              .get(email, user.id),
          409,
          "This email is already in use.",
        );
        fail(
          !email && !user.phone,
          400,
          "An email is required for this account.",
        );
        const location = textValue(data.location, "Location", 2, 150);
        const lat = coordinate(data.lat, "Latitude", -90, 90),
          lng = coordinate(data.lng, "Longitude", -180, 180);
        db.prepare(
          "UPDATE users SET name=?,email=?,location=?,lat=?,lng=?,notifications_enabled=? WHERE id=?",
        ).run(
          name,
          email,
          location,
          lat,
          lng,
          data.notificationsEnabled === false ? 0 : 1,
          user.id,
        );
        send(200, {
          user: publicUser(
            db.prepare("SELECT * FROM users WHERE id=?").get(user.id),
          ),
        });
        return;
      }
      if (path === "/api/vehicles" && method === "GET") {
        send(200, {
          vehicles: db
            .prepare("SELECT * FROM vehicles WHERE user_id=? ORDER BY rowid")
            .all(user.id),
        });
        return;
      }
      match = path.match(/^\/api\/vehicles\/([^/]+)$/);
      if (
        (path === "/api/vehicles" && method === "POST") ||
        (match && method === "PUT")
      ) {
        const name = textValue(data.name, "Vehicle name", 2, 80),
          plate = textValue(data.plate, "Registration", 4, 20).toUpperCase(),
          color = textValue(data.color || "White", "Colour", 2, 30);
        fail(
          !/^[A-Z0-9 -]+$/.test(plate),
          400,
          "Registration can contain letters, digits, spaces and hyphens.",
        );
        fail(
          !["hatchback", "sedan", "suv", "muv"].includes(data.kind),
          400,
          "Choose a vehicle type.",
        );
        const id = match?.[1] || randomUUID();
        if (match)
          fail(
            !db
              .prepare("SELECT 1 FROM vehicles WHERE id=? AND user_id=?")
              .get(id, user.id),
            404,
            "Vehicle not found.",
          );
        else
          fail(
            db
              .prepare("SELECT COUNT(*) as n FROM vehicles WHERE user_id=?")
              .get(user.id).n >= 20,
            400,
            "Your garage can hold up to 20 vehicles.",
          );
        fail(
          db
            .prepare(
              "SELECT 1 FROM vehicles WHERE user_id=? AND plate=? AND id!=?",
            )
            .get(user.id, plate, id),
          409,
          "This vehicle is already in your garage.",
        );
        if (match)
          db.prepare(
            "UPDATE vehicles SET name=?,plate=?,kind=?,color=? WHERE id=?",
          ).run(name, plate, data.kind, color, id);
        else
          db.prepare("INSERT INTO vehicles VALUES (?,?,?,?,?,?)").run(
            id,
            user.id,
            name,
            plate,
            data.kind,
            color,
          );
        send(match ? 200 : 201, {
          vehicle: db.prepare("SELECT * FROM vehicles WHERE id=?").get(id),
        });
        return;
      }
      if (match && method === "DELETE") {
        const r = db
          .prepare("DELETE FROM vehicles WHERE id=? AND user_id=?")
          .run(match[1], user.id);
        fail(!r.changes, 404, "Vehicle not found.");
        send(200, { ok: true });
        return;
      }
      match = path.match(/^\/api\/favorites\/([^/]+)$/);
      if (match && ["PUT", "DELETE"].includes(method)) {
        fail(
          !db
            .prepare("SELECT 1 FROM providers WHERE id=? AND active=1")
            .get(match[1]),
          404,
          "Centre not found.",
        );
        if (method === "PUT")
          db.prepare("INSERT OR IGNORE INTO favorites VALUES (?,?)").run(
            user.id,
            match[1],
          );
        else
          db.prepare(
            "DELETE FROM favorites WHERE user_id=? AND provider_id=?",
          ).run(user.id, match[1]);
        send(200, { favorite: method === "PUT" });
        return;
      }
      if (path === "/api/notifications" && method === "GET") {
        send(200, {
          notifications: db
            .prepare(
              "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
            )
            .all(user.id),
        });
        return;
      }
      if (path === "/api/notifications/read" && method === "POST") {
        db.prepare("UPDATE notifications SET is_read=1 WHERE user_id=?").run(
          user.id,
        );
        send(200, { ok: true });
        return;
      }
      if (path === "/api/bookings/quote" && method === "POST") {
        const q = quote(db, user, data);
        send(200, {
          subtotal: q.subtotal,
          discount: q.discount,
          total: q.total,
          duration: q.duration,
          surcharge: q.surcharge,
          coupon: q.coupon,
        });
        return;
      }
      if (path === "/api/bookings" && method === "POST") {
        limit(`booking:${user.id}`, 30, 3600000);
        const key = textValue(data.requestKey, "Request key", 16, 100);
        const existing = db
          .prepare(`${bookingSQL} WHERE b.user_id=? AND b.request_key=?`)
          .get(user.id, key);
        if (existing) {
          send(200, { booking: bookingView(existing) });
          return;
        }
        db.exec("BEGIN IMMEDIATE");
        try {
          const q = quote(db, user, data),
            start = validateSlot(db, q, data, user.id),
            now = Date.now(),
            id = randomUUID();
          const notes = data.notes
            ? textValue(data.notes, "Notes", 0, 500)
            : "";
          const code = `GL-${randomBytes(4).toString("hex").toUpperCase()}`;
          db.prepare(
            "INSERT INTO bookings (id,code,user_id,provider_id,vehicle_snapshot,service_snapshot,date,time,start_at,end_at,duration,subtotal,discount,total,coupon,notes,status,request_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          ).run(
            id,
            code,
            user.id,
            q.provider.id,
            JSON.stringify(q.vehicle),
            JSON.stringify(
              q.services.map((s) => ({
                id: s.id,
                name: s.name,
                price: s.price,
                duration: s.duration,
              })),
            ),
            data.date,
            data.time,
            start,
            start + q.duration * 60000,
            q.duration,
            q.subtotal,
            q.discount,
            q.total,
            q.coupon,
            notes,
            "confirmed",
            key,
            now,
            now,
          );
          notify(
            user.id,
            "Your wash is booked!",
            `${q.provider.name} · ${data.date} at ${data.time} IST. Pay ₹${q.total} at the centre.`,
            id,
          );
          db.exec("COMMIT");
          send(201, {
            booking: bookingView(
              db.prepare(`${bookingSQL} WHERE b.id=?`).get(id),
            ),
          });
          return;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      }
      if (path === "/api/bookings" && method === "GET") {
        send(200, {
          bookings: db
            .prepare(
              `${bookingSQL} WHERE b.user_id=? ORDER BY b.created_at DESC`,
            )
            .all(user.id)
            .map((b) => ({
              ...bookingView(b),
              review:
                db
                  .prepare(
                    "SELECT id,rating,comment FROM reviews WHERE booking_id=?",
                  )
                  .get(b.id) || null,
            })),
        });
        return;
      }
      match = path.match(/^\/api\/bookings\/([^/]+)\/(cancel|review)$/);
      if (match && method === "POST") {
        const b = db
          .prepare("SELECT * FROM bookings WHERE id=? AND user_id=?")
          .get(match[1], user.id);
        fail(!b, 404, "Booking not found.");
        if (match[2] === "cancel") {
          fail(
            b.status !== "confirmed" || b.start_at <= Date.now(),
            409,
            "Only an upcoming, confirmed booking can be cancelled. Contact the centre for help.",
          );
          db.prepare(
            "UPDATE bookings SET status='cancelled',updated_at=? WHERE id=?",
          ).run(Date.now(), b.id);
          notify(
            user.id,
            "Booking cancelled",
            `Booking ${b.code} was cancelled. We hope to see you soon.`,
            b.id,
          );
          send(200, { ok: true });
          return;
        }
        fail(
          b.status !== "completed",
          409,
          "Reviews are available after your service is completed.",
        );
        fail(
          db.prepare("SELECT 1 FROM reviews WHERE booking_id=?").get(b.id),
          409,
          "You already reviewed this visit.",
        );
        const rating = integer(data.rating, "Rating", 1, 5),
          comment = textValue(data.comment, "Review", 10, 1000);
        db.prepare("INSERT INTO reviews VALUES (?,?,?,?,?,?,?,0,?)").run(
          randomUUID(),
          b.provider_id,
          user.id,
          b.id,
          user.name,
          rating,
          comment,
          Date.now(),
        );
        send(201, { ok: true });
        return;
      }
      if (path.startsWith("/api/admin/")) {
        fail(user.role !== "admin", 403, "Administrator access is required.");
        if (path === "/api/admin/dashboard" && method === "GET") {
          const bookings = db
            .prepare(`${bookingSQL} ORDER BY b.created_at DESC LIMIT 1000`)
            .all()
            .map((b) => ({
              ...bookingView(b),
              customer: publicUser(
                db.prepare("SELECT * FROM users WHERE id=?").get(b.user_id),
              ),
            }));
          const stats = db
            .prepare(
              "SELECT COUNT(*) as bookings, SUM(CASE WHEN status='completed' AND payment_status='paid' THEN total ELSE 0 END) as revenue, SUM(CASE WHEN date=? AND status!='cancelled' THEN 1 ELSE 0 END) as today, SUM(CASE WHEN status IN ('confirmed','checked_in','in_progress') THEN 1 ELSE 0 END) as active FROM bookings",
            )
            .get(todayIST());
          send(200, {
            stats,
            bookings,
            providers: db
              .prepare("SELECT * FROM providers ORDER BY name")
              .all()
              .map((p) => ({
                ...p,
                features: JSON.parse(p.features),
                services: db
                  .prepare(
                    "SELECT * FROM services WHERE provider_id=? ORDER BY price",
                  )
                  .all(p.id)
                  .map((s) => ({ ...s, features: JSON.parse(s.features) })),
              })),
            customers: db
              .prepare(
                "SELECT COUNT(*) as count FROM users WHERE role='customer'",
              )
              .get().count,
          });
          return;
        }
        match = path.match(/^\/api\/admin\/bookings\/([^/]+)$/);
        if (match && method === "PATCH") {
          const b = db
            .prepare("SELECT * FROM bookings WHERE id=?")
            .get(match[1]);
          fail(!b, 404, "Booking not found.");
          const status = data.status || b.status,
            payment = data.paymentStatus || b.payment_status;
          fail(
            status !== b.status &&
              !allowedTransitions[b.status]?.includes(status),
            409,
            "That status transition is not allowed.",
          );
          fail(
            !["unpaid", "paid"].includes(payment),
            400,
            "Invalid payment state.",
          );
          fail(
            payment === "paid" &&
              !["completed", "in_progress"].includes(status),
            400,
            "Record payment while the service is in progress or completed.",
          );
          fail(
            b.payment_status === "paid" && payment === "unpaid",
            409,
            "A recorded payment cannot be reversed here.",
          );
          db.exec("BEGIN IMMEDIATE");
          try {
            db.prepare(
              "UPDATE bookings SET status=?,payment_status=?,updated_at=? WHERE id=?",
            ).run(status, payment, Date.now(), b.id);
            db.prepare("INSERT INTO audit_log VALUES (?,?,?,?,?,?)").run(
              randomUUID(),
              user.id,
              "booking_updated",
              b.id,
              JSON.stringify({ from: b.status, to: status, payment }),
              Date.now(),
            );
            if (status !== b.status)
              notify(
                b.user_id,
                `Booking ${status.replaceAll("_", " ")}`,
                `${b.code} has been updated by the centre.`,
                b.id,
              );
            if (payment === "paid" && b.payment_status !== "paid")
              notify(
                b.user_id,
                "Payment recorded",
                `The centre recorded ₹${b.total} for booking ${b.code}.`,
                b.id,
              );
            db.exec("COMMIT");
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
          send(200, { ok: true });
          return;
        }
        match = path.match(/^\/api\/admin\/providers(?:\/([^/]+))?$/);
        if (match && ["POST", "PUT"].includes(method)) {
          fail(
            (method === "PUT") !== !!match[1],
            400,
            "Invalid centre request.",
          );
          const id = match[1] || randomUUID(),
            name = textValue(data.name, "Centre name", 2, 100),
            area = textValue(data.area, "Area", 2, 80),
            address = textValue(data.address, "Address", 5, 200);
          const lat = coordinate(data.lat, "Latitude", -90, 90),
            lng = coordinate(data.lng, "Longitude", -180, 180);
          const description = textValue(
              data.description,
              "Description",
              10,
              1500,
            ),
            phone = textValue(data.phone, "Phone", 6, 20);
          fail(
            !/^[+\d ()-]+$/.test(phone),
            400,
            "Enter a valid contact phone.",
          );
          const opens = integer(data.opens, "Opening hour", 0, 22),
            closes = integer(data.closes, "Closing hour", 1, 23),
            capacity = integer(data.capacity, "Wash bays", 1, 20);
          fail(
            closes <= opens,
            400,
            "Closing time must be after opening time.",
          );
          fail(
            !["wash", "studio", "foam", "detail"].includes(data.image),
            400,
            "Choose an image style.",
          );
          const features = Array.isArray(data.features)
            ? data.features
                .slice(0, 8)
                .map((x) => textValue(x, "Feature", 2, 50))
            : ["Hand wash", "Parking"];
          if (match[1]) {
            const old = db
              .prepare("SELECT * FROM providers WHERE id=?")
              .get(id);
            fail(!old, 404, "Centre not found.");
            fail(
              capacity < old.capacity &&
                db
                  .prepare(
                    "SELECT 1 FROM bookings WHERE provider_id=? AND end_at>? AND status!='cancelled'",
                  )
                  .get(id, Date.now()),
              409,
              "Capacity cannot be reduced while future bookings exist.",
            );
            db.prepare(
              "UPDATE providers SET name=?,area=?,address=?,lat=?,lng=?,description=?,phone=?,opens=?,closes=?,capacity=?,image=?,features=?,active=? WHERE id=?",
            ).run(
              name,
              area,
              address,
              lat,
              lng,
              description,
              phone,
              opens,
              closes,
              capacity,
              data.image,
              JSON.stringify(features),
              data.active === false ? 0 : 1,
              id,
            );
          } else
            db.prepare(
              "INSERT INTO providers VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            ).run(
              id,
              name,
              area,
              address,
              lat,
              lng,
              description,
              phone,
              opens,
              closes,
              capacity,
              data.image,
              "#f65349",
              JSON.stringify(features),
              1,
            );
          send(method === "POST" ? 201 : 200, { id });
          return;
        }
        match = path.match(/^\/api\/admin\/services(?:\/([^/]+))?$/);
        if (match && ["POST", "PUT"].includes(method)) {
          fail(
            (method === "PUT") !== !!match[1],
            400,
            "Invalid service request.",
          );
          const id = match[1] || randomUUID(),
            providerId = textValue(data.providerId, "Centre", 1, 100);
          fail(
            !db.prepare("SELECT 1 FROM providers WHERE id=?").get(providerId),
            404,
            "Centre not found.",
          );
          const name = textValue(data.name, "Name", 2, 100),
            description = textValue(data.description, "Description", 3, 500),
            price = integer(data.price, "Price", 1, 100000),
            duration = integer(data.duration, "Duration", 15, 600);
          fail(
            !["Exterior", "Interior", "Detailing", "Protection"].includes(
              data.category,
            ),
            400,
            "Invalid service category.",
          );
          const features = Array.isArray(data.features)
            ? data.features
                .slice(0, 8)
                .map((x) => textValue(x, "Feature", 2, 100))
            : [];
          if (match[1]) {
            fail(
              !db
                .prepare("SELECT 1 FROM services WHERE id=? AND provider_id=?")
                .get(id, providerId),
              404,
              "Service not found.",
            );
            db.prepare(
              "UPDATE services SET name=?,category=?,description=?,price=?,duration=?,features=?,active=? WHERE id=?",
            ).run(
              name,
              data.category,
              description,
              price,
              duration,
              JSON.stringify(features),
              data.active === false ? 0 : 1,
              id,
            );
          } else
            db.prepare("INSERT INTO services VALUES (?,?,?,?,?,?,?,?,1)").run(
              id,
              providerId,
              name,
              data.category,
              description,
              price,
              duration,
              JSON.stringify(features),
            );
          send(method === "POST" ? 201 : 200, { id });
          return;
        }
      }
      throw new HttpError(404, "Endpoint not found.");
    } catch (error) {
      if (!error.status) console.error("[Gleam]", error);
      if (!res.headersSent)
        send(error.status || 500, {
          error: error.status
            ? error.message
            : "Something went wrong. Please try again.",
        });
      else res.end();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return {
    server,
    db,
    close: () =>
      new Promise((resolveClose) => {
        server.close(() => {
          db.close();
          resolveClose();
        });
        server.closeIdleConnections();
      }),
  };
}
