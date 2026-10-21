import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "../server/app.mjs";
import { openDatabase } from "../server/db.mjs";
import { getConfig } from "../server/config.mjs";
import { todayIST } from "../server/booking.mjs";

let app, base, config;
const tomorrow = () => todayIST(Date.now() + 86400000);
async function boot(extra = {}) {
  config = getConfig({ demo: true, dbPath: ":memory:", ...extra });
  app = createApp(config);
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${app.server.address().port}`;
}
beforeEach(async () => {
  await boot();
});
afterEach(async () => {
  if (app) {
    await app.close();
    app = null;
  }
});
function client() {
  const c = { cookie: "", csrf: "", user: null };
  c.request = async (path, method = "GET", body, extra = {}) => {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        ...(c.cookie ? { Cookie: c.cookie } : {}),
        ...(method !== "GET"
          ? { "Content-Type": "application/json", "X-CSRF-Token": c.csrf }
          : {}),
        ...extra,
      },
      ...(method !== "GET" ? { body: JSON.stringify(body || {}) } : {}),
    });
    if (res.headers.get("set-cookie"))
      c.cookie = res.headers.get("set-cookie").split(";")[0];
    const data = await res.json();
    if (data.csrfToken) c.csrf = data.csrfToken;
    if (data.user) c.user = data.user;
    return { status: res.status, data, headers: res.headers };
  };
  c.ok = async (path, method, body) => {
    const r = await c.request(path, method, body);
    assert.ok(
      r.status >= 200 && r.status < 300,
      `${path}: ${r.status} ${JSON.stringify(r.data)}`,
    );
    return r.data;
  };
  return c;
}
async function customer() {
  const c = client();
  await c.ok("/auth/login", "POST", {
    email: "customer@gleam.local",
    password: "GleamDemo123!",
  });
  return c;
}
async function admin() {
  const c = client();
  await c.ok("/auth/login", "POST", {
    email: "admin@gleam.local",
    password: "AdminDemo123!",
  });
  return c;
}
async function fresh(name = "Sam Driver") {
  const c = client();
  await c.ok("/auth/register", "POST", {
    name,
    email: `${randomUUID()}@example.test`,
    password: "FreshPassword123!",
  });
  return c;
}
async function vehicle(c, kind = "sedan") {
  return (
    await c.ok("/vehicles", "POST", {
      name: "Test Sedan",
      plate: `UK07 ${Math.floor(Math.random() * 9000) + 1000}`,
      kind,
      color: "Blue",
    })
  ).vehicle;
}
function payload(v = "demo-car", overrides = {}) {
  return {
    providerId: "proglow",
    serviceIds: ["proglow-signature"],
    vehicleId: v,
    date: tomorrow(),
    time: "10:00",
    requestKey: randomUUID(),
    ...overrides,
  };
}

test("public directory, detail, filtering and sorting work without login", async () => {
  const c = client();
  assert.equal((await c.ok("/health")).ok, true);
  const result = await c.ok("/providers");
  assert.equal(result.providers.length, 4);
  assert.equal(result.providers[0].name, "Proglow Auto Spa");
  assert.equal(
    (await c.ok("/providers?q=Ballupur")).providers[0].id,
    "foam-finish",
  );
  assert.equal((await c.ok("/providers?maxPrice=500")).providers.length, 1);
  const detail = await c.ok("/providers/proglow");
  assert.equal(detail.services.length, 4);
  assert.equal(detail.reviews.length, 3);
  assert.ok(detail.reviews.every((r) => r.is_demo));
  assert.equal((await c.request("/providers?lat=999")).status, 400);
});
test("private endpoints require authentication and admin is role protected", async () => {
  assert.equal((await client().request("/bookings")).status, 401);
  const c = await customer();
  assert.equal((await c.request("/admin/dashboard")).status, 403);
  assert.equal(
    (await (await admin()).ok("/admin/dashboard")).stats.bookings,
    0,
  );
});
test("registration validates credentials and sessions use HttpOnly cookies", async () => {
  const c = client();
  assert.equal(
    (
      await c.request("/auth/register", "POST", {
        name: "S",
        email: "broken",
        password: "a",
      })
    ).status,
    400,
  );
  const r = await c.request("/auth/register", "POST", {
    name: "Sam Driver",
    email: "sam@example.test",
    password: "LongEnough123!",
  });
  assert.equal(r.status, 201);
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  assert.match(r.headers.get("set-cookie"), /SameSite=Lax/);
  assert.equal((await c.ok("/session")).user.name, "Sam Driver");
  await c.ok("/auth/logout", "POST");
  assert.equal((await c.ok("/session")).user, null);
  assert.equal(
    (
      await c.request("/auth/login", "POST", {
        email: "sam@example.test",
        password: "wrong",
      })
    ).status,
    401,
  );
});
test("CSRF token, Origin and Fetch Metadata protect authenticated mutations", async () => {
  const c = await customer(),
    body = { name: "Sedan", plate: "UK07 A1234", kind: "sedan", color: "Blue" };
  assert.equal(
    (await c.request("/vehicles", "POST", body, { "X-CSRF-Token": "" })).status,
    403,
  );
  assert.equal(
    (
      await c.request("/vehicles", "POST", body, {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await c.request("/vehicles", "POST", body, {
        "Sec-Fetch-Site": "cross-site",
      })
    ).status,
    403,
  );
  assert.equal((await c.request("/vehicles", "POST", body)).status, 201);
});
test("profile validation rejects invalid coordinates and email collisions", async () => {
  const c = await customer(),
    profile = { ...c.user, notificationsEnabled: false };
  assert.equal(
    (await c.request("/profile", "PUT", { ...profile, lat: 100 })).status,
    400,
  );
  assert.equal(
    (
      await c.request("/profile", "PUT", {
        ...profile,
        email: "admin@gleam.local",
      })
    ).status,
    409,
  );
  const saved = await c.ok("/profile", "PUT", {
    ...profile,
    name: "Updated Driver",
  });
  assert.equal(saved.user.name, "Updated Driver");
  assert.equal(saved.user.notificationsEnabled, false);
});
test("vehicle CRUD is user-scoped, and duplicate plates are rejected", async () => {
  const c = await customer(),
    other = await fresh(),
    v = await vehicle(c);
  assert.equal(
    (await other.request(`/vehicles/${v.id}`, "PUT", { ...v, name: "Hijack" }))
      .status,
    404,
  );
  assert.equal(
    (await other.request(`/vehicles/${v.id}`, "DELETE")).status,
    404,
  );
  assert.equal((await c.request("/vehicles", "POST", v)).status, 409);
  assert.equal(
    (await c.ok(`/vehicles/${v.id}`, "PUT", { ...v, name: "Updated Sedan" }))
      .vehicle.name,
    "Updated Sedan",
  );
  await c.ok(`/vehicles/${v.id}`, "DELETE");
  assert.equal((await c.ok("/vehicles")).vehicles.length, 1);
});
test("server computes price and ignores forged totals", async () => {
  const c = await customer(),
    v = await vehicle(c, "suv"),
    p = payload(v.id, { coupon: "FIRST20", total: 1 });
  const q = await c.ok("/bookings/quote", "POST", p);
  assert.equal(q.subtotal, 649);
  assert.equal(q.discount, 129);
  assert.equal(q.total, 520);
  const b = (await c.ok("/bookings", "POST", p)).booking;
  assert.equal(b.total, 520);
  assert.equal(b.payment_status, "unpaid");
  assert.equal(
    (
      await c.request(
        "/bookings/quote",
        "POST",
        payload(v.id, { coupon: "FIRST20" }),
      )
    ).status,
    400,
  );
});
test("invalid or ineligible coupons are not silently applied", async () => {
  const c = await customer();
  assert.equal(
    (
      await c.request(
        "/bookings/quote",
        "POST",
        payload("demo-car", { coupon: "MADEUP" }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await c.request(
        "/bookings/quote",
        "POST",
        payload("demo-car", { coupon: "SHINE10" }),
      )
    ).status,
    400,
  );
  const q = await c.ok(
    "/bookings/quote",
    "POST",
    payload("demo-car", {
      serviceIds: ["proglow-full-detail"],
      coupon: "SHINE10",
    }),
  );
  assert.equal(q.discount, 149);
});
test("booking idempotency returns one booking for repeated submission", async () => {
  const c = await customer(),
    p = payload();
  const first = await c.ok("/bookings", "POST", p),
    second = await c.ok("/bookings", "POST", p);
  assert.equal(first.booking.id, second.booking.id);
  assert.equal((await c.ok("/bookings")).bookings.length, 1);
});
test("capacity applies across overlapping durations and frees at the boundary", async () => {
  const a = await fresh(),
    b = await fresh(),
    c = await fresh(),
    va = await vehicle(a),
    vb = await vehicle(b),
    vc = await vehicle(c);
  await a.ok(
    "/bookings",
    "POST",
    payload(va.id, { serviceIds: ["proglow-interior"], time: "10:00" }),
  );
  await b.ok("/bookings", "POST", payload(vb.id, { time: "10:30" }));
  assert.equal(
    (await c.request("/bookings", "POST", payload(vc.id, { time: "10:30" })))
      .status,
    409,
  );
  const slots = await c.ok(
    `/providers/proglow/slots?date=${tomorrow()}&duration=30`,
  );
  assert.equal(slots.slots.find((s) => s.time === "10:30").available, false);
  assert.equal(slots.slots.find((s) => s.time === "11:00").available, true);
  assert.equal(
    (await c.request("/bookings", "POST", payload(vc.id, { time: "11:00" })))
      .status,
    201,
  );
});
test("a user cannot book overlapping visits across different centres", async () => {
  const c = await customer();
  await c.ok("/bookings", "POST", payload());
  assert.equal(
    (
      await c.request(
        "/bookings",
        "POST",
        payload("demo-car", {
          providerId: "wash-club",
          serviceIds: ["wash-club-signature"],
        }),
      )
    ).status,
    409,
  );
});
test("dates, opening hours, nonexistent dates and off-grid times are validated", async () => {
  const c = await customer();
  for (const change of [
    { date: "2020-01-01" },
    { date: "2030-02-31" },
    { date: "nonsense" },
    { time: "05:00" },
    { time: "10:17" },
    { time: "18:30", serviceIds: ["proglow-interior"] },
  ]) {
    const r = await c.request("/bookings", "POST", payload("demo-car", change));
    assert.ok([400, 409].includes(r.status), JSON.stringify(r));
  }
  assert.equal((await c.request("/bookings/quote", "POST", {})).status, 400);
});
test("foreign vehicles and services from another centre cannot be booked", async () => {
  const c = await fresh(),
    v = await vehicle(c);
  assert.equal(
    (await c.request("/bookings", "POST", payload("demo-car"))).status,
    400,
  );
  assert.equal(
    (
      await c.request(
        "/bookings",
        "POST",
        payload(v.id, { serviceIds: ["wash-club-signature"] }),
      )
    ).status,
    400,
  );
});
test("cancellation is owner-scoped and releases appointment capacity", async () => {
  const a = await customer(),
    b = await fresh(),
    book = (
      await a.ok(
        "/bookings",
        "POST",
        payload("demo-car", {
          providerId: "foam-finish",
          serviceIds: ["foam-finish-signature"],
        }),
      )
    ).booking;
  assert.equal(
    (await b.request(`/bookings/${book.id}/cancel`, "POST")).status,
    404,
  );
  await a.ok(`/bookings/${book.id}/cancel`, "POST");
  assert.equal((await a.ok("/bookings")).bookings[0].status, "cancelled");
  assert.equal(
    (
      await a.ok(`/providers/foam-finish/slots?date=${tomorrow()}&duration=30`)
    ).slots.find((s) => s.time === "10:00").available,
    true,
  );
});
test("admin workflow enforces transitions and records payment separately", async () => {
  const c = await customer(),
    a = await admin(),
    b = (await c.ok("/bookings", "POST", payload())).booking;
  assert.equal(
    (
      await a.request(`/admin/bookings/${b.id}`, "PATCH", {
        status: "completed",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await a.request(`/admin/bookings/${b.id}`, "PATCH", {
        paymentStatus: "paid",
      })
    ).status,
    400,
  );
  for (const status of ["checked_in", "in_progress", "completed"])
    await a.ok(`/admin/bookings/${b.id}`, "PATCH", { status });
  assert.equal((await a.ok("/admin/dashboard")).stats.revenue, 0);
  await a.ok(`/admin/bookings/${b.id}`, "PATCH", { paymentStatus: "paid" });
  assert.equal((await a.ok("/admin/dashboard")).stats.revenue, 499);
  assert.equal(
    (
      await a.request(`/admin/bookings/${b.id}`, "PATCH", {
        paymentStatus: "unpaid",
      })
    ).status,
    409,
  );
});
test("only completed owned bookings can be reviewed once", async () => {
  const c = await customer(),
    a = await admin(),
    other = await fresh(),
    b = (await c.ok("/bookings", "POST", payload())).booking;
  const review = {
    rating: 5,
    comment: "Thoughtful care and a beautiful finish.",
  };
  assert.equal(
    (await c.request(`/bookings/${b.id}/review`, "POST", review)).status,
    409,
  );
  for (const status of ["checked_in", "in_progress", "completed"])
    await a.ok(`/admin/bookings/${b.id}`, "PATCH", { status });
  assert.equal(
    (await other.request(`/bookings/${b.id}/review`, "POST", review)).status,
    404,
  );
  assert.equal(
    (await c.request(`/bookings/${b.id}/review`, "POST", review)).status,
    201,
  );
  assert.equal(
    (await c.request(`/bookings/${b.id}/review`, "POST", review)).status,
    409,
  );
  assert.equal((await c.ok("/providers/proglow")).reviews[0].is_demo, 0);
});
test("notification inbox and favourites are private and persisted", async () => {
  const c = await customer(),
    other = await fresh();
  await c.ok("/bookings", "POST", payload());
  const n = (await c.ok("/notifications")).notifications;
  assert.equal(n.length, 2);
  assert.equal((await other.ok("/notifications")).notifications.length, 0);
  await c.ok("/notifications/read", "POST");
  assert.ok(
    (await c.ok("/notifications")).notifications.every((n) => n.is_read),
  );
  await c.ok("/favorites/wash-club", "PUT");
  assert.equal((await c.ok("/providers?favorite=true")).providers.length, 2);
  await c.ok("/favorites/wash-club", "DELETE");
  assert.equal((await c.ok("/providers?favorite=true")).providers.length, 1);
});
test("demo OTP signs in, is single use and has an attempt limit", async () => {
  const c = client(),
    phone = "+919111111111",
    otp = await c.ok("/auth/request-otp", "POST", { phone });
  assert.match(otp.demoCode, /^\d{6}$/);
  assert.equal(
    (await c.request("/auth/verify-otp", "POST", { phone, code: "000000" }))
      .status,
    400,
  );
  assert.equal(
    (await c.ok("/auth/verify-otp", "POST", { phone, code: otp.demoCode })).user
      .phone,
    phone,
  );
  assert.equal(
    (await c.request("/auth/verify-otp", "POST", { phone, code: otp.demoCode }))
      .status,
    400,
  );
  const p2 = "+919111111112",
    second = await c.ok("/auth/request-otp", "POST", { phone: p2 });
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await c.request("/auth/verify-otp", "POST", {
          phone: p2,
          code: "000000",
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await c.request("/auth/verify-otp", "POST", {
        phone: p2,
        code: second.demoCode,
      })
    ).status,
    400,
  );
});
test("password update invalidates other sessions but keeps current login", async () => {
  const c = await customer(),
    other = await customer();
  await c.ok("/auth/password", "PUT", {
    currentPassword: "GleamDemo123!",
    newPassword: "ChangedPassword123!",
  });
  assert.equal((await other.ok("/session")).user, null);
  assert.ok((await c.ok("/session")).user);
  assert.equal(
    (
      await client().request("/auth/login", "POST", {
        email: "customer@gleam.local",
        password: "GleamDemo123!",
      })
    ).status,
    401,
  );
});
test("historical booking snapshots survive catalogue edits and vehicle deletion", async () => {
  const c = await customer(),
    a = await admin(),
    b = (await c.ok("/bookings", "POST", payload())).booking;
  const service = (await a.ok("/admin/dashboard")).providers
    .find((p) => p.id === "proglow")
    .services.find((s) => s.id === "proglow-signature");
  await a.ok("/admin/services/proglow-signature", "PUT", {
    ...service,
    providerId: "proglow",
    name: "New premium service",
    price: 999,
  });
  await c.ok("/vehicles/demo-car", "DELETE");
  const stored = (await c.ok("/bookings")).bookings[0];
  assert.equal(stored.total, 499);
  assert.equal(stored.services[0].name, "Signature wash");
  assert.equal(stored.vehicle.name, "Hyundai i20");
  assert.equal(stored.id, b.id);
});
test("admin can create a centre and its service, then hide it from new bookings", async () => {
  const a = await admin(),
    p = {
      name: "Test Studio",
      area: "Test Area",
      address: "100 Test Road, Dehradun",
      lat: 30.32,
      lng: 78.03,
      description: "An integration test wash centre.",
      phone: "+919111111113",
      opens: 9,
      closes: 18,
      capacity: 1,
      image: "wash",
      features: ["Parking"],
      active: true,
    };
  const { id } = await a.ok("/admin/providers", "POST", p);
  const s = await a.ok("/admin/services", "POST", {
    providerId: id,
    name: "Test Wash",
    description: "A complete test wash.",
    category: "Exterior",
    price: 350,
    duration: 30,
    features: ["Wash"],
    active: true,
  });
  assert.equal((await a.ok(`/providers/${id}`)).services[0].id, s.id);
  await a.ok(`/admin/providers/${id}`, "PUT", { ...p, active: false });
  assert.equal((await a.request(`/providers/${id}`)).status, 404);
});
test("server state and login persist after restart with a file database", async () => {
  await app.close();
  app = null;
  const directory = mkdtempSync(join(tmpdir(), "gleam-test-"));
  const path = join(directory, "db.sqlite");
  try {
    await boot({ dbPath: path });
    const c = await customer(),
      b = (await c.ok("/bookings", "POST", payload())).booking;
    await app.close();
    app = null;
    await boot({ dbPath: path });
    assert.equal((await c.ok("/session")).user.id, "demo-customer");
    assert.equal((await c.ok("/bookings")).bookings[0].id, b.id);
    await app.close();
    app = null;
    assert.throws(
      () =>
        openDatabase({
          ...config,
          demo: false,
          adminEmail: "owner@example.test",
          adminPassword: "NotADemoPassword123!",
        }),
      /demo accounts/,
    );
  } finally {
    if (app) {
      await app.close();
      app = null;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
test("production boot requires secure settings and creates no sample records", async () => {
  assert.throws(
    () =>
      getConfig({
        demo: false,
        appOrigin: "http://localhost:4000",
        secureCookies: false,
      }),
    /HTTPS/,
  );
  const db = openDatabase(
    getConfig({
      demo: false,
      dbPath: ":memory:",
      appOrigin: "https://gleam.example",
      secureCookies: true,
      adminEmail: "owner@example.test",
      adminPassword: "UniqueProductionPassword123!",
    }),
  );
  try {
    assert.equal(db.prepare("SELECT COUNT(*) n FROM users").get().n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM providers").get().n, 0);
  } finally {
    db.close();
  }
});
test("built frontend is served with security headers and API 404s remain JSON", async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.match(
    page.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
  const c = await customer();
  assert.equal((await c.request("/not-a-real-endpoint")).status, 404);
  const missing = await fetch(`${base}/missing-file.png`);
  assert.equal(missing.status, 404);
});
