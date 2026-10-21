import { fail, textValue } from "./security.mjs";
export const vehicleExtras = { hatchback: 0, sedan: 0, suv: 150, muv: 200 };
export const todayIST = (now = Date.now()) =>
  new Date(now + 330 * 60000).toISOString().slice(0, 10);
export const appointmentTime = (date, time) =>
  Date.parse(`${date}T${time}:00+05:30`);
export const timeLabel = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export function validateDate(date) {
  fail(
    typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date),
    400,
    "Choose a valid date.",
  );
  const parsed = Date.parse(`${date}T00:00:00Z`);
  fail(
    !Number.isFinite(parsed) ||
      new Date(parsed).toISOString().slice(0, 10) !== date,
    400,
    "Choose a valid date.",
  );
  fail(
    date < todayIST() || date > todayIST(Date.now() + 30 * 86400000),
    400,
    "Choose a date within the next 30 days.",
  );
}
export function quote(db, user, data) {
  fail(typeof data.providerId !== "string", 400, "Choose a centre.");
  const provider = db
    .prepare("SELECT * FROM providers WHERE id=? AND active=1")
    .get(data.providerId);
  fail(!provider, 404, "This centre is unavailable.");
  fail(
    !Array.isArray(data.serviceIds) ||
      data.serviceIds.length < 1 ||
      data.serviceIds.length > 6,
    400,
    "Choose at least one service (maximum six).",
  );
  const ids = [...new Set(data.serviceIds)];
  fail(
    ids.some((x) => typeof x !== "string"),
    400,
    "Invalid service selection.",
  );
  const services = ids.map((id) =>
    db
      .prepare(
        "SELECT * FROM services WHERE id=? AND provider_id=? AND active=1",
      )
      .get(id, provider.id),
  );
  fail(
    services.some((x) => !x),
    400,
    "One of these services is no longer available.",
  );
  const vehicle = db
    .prepare("SELECT * FROM vehicles WHERE id=? AND user_id=?")
    .get(String(data.vehicleId || ""), user.id);
  fail(!vehicle, 400, "Select a vehicle from your garage.");
  const surcharge = vehicleExtras[vehicle.kind];
  const subtotal = services.reduce((sum, s) => sum + s.price, 0) + surcharge;
  const duration = services.reduce((sum, s) => sum + s.duration, 0);
  fail(
    duration > (provider.closes - provider.opens) * 60,
    400,
    "These services exceed the centre’s daily opening hours.",
  );
  const coupon = String(data.coupon || "")
    .trim()
    .toUpperCase();
  let discount = 0;
  if (coupon) {
    fail(
      !["FIRST20", "SHINE10"].includes(coupon),
      400,
      "This offer code is not valid.",
    );
    if (coupon === "FIRST20") {
      fail(
        db
          .prepare(
            "SELECT 1 FROM bookings WHERE user_id=? AND status!='cancelled'",
          )
          .get(user.id),
        400,
        "FIRST20 is only for your first booking.",
      );
      fail(subtotal < 499, 400, "FIRST20 requires a booking of at least ₹499.");
      discount = Math.min(200, Math.floor(subtotal * 0.2));
    } else {
      fail(subtotal < 799, 400, "SHINE10 requires a booking of at least ₹799.");
      discount = Math.min(150, Math.floor(subtotal * 0.1));
    }
  }
  return {
    provider,
    services,
    vehicle,
    duration,
    subtotal,
    surcharge,
    discount,
    total: subtotal - discount,
    coupon,
  };
}
export function hasCapacity(db, provider, start, end) {
  // Sweep-line check handles both fully overlapping and adjacent appointments.
  const intervals = db
    .prepare(
      "SELECT start_at,end_at FROM bookings WHERE provider_id=? AND status!='cancelled' AND start_at<? AND end_at>?",
    )
    .all(provider.id, end, start);
  const points = [
    [start, 1],
    [end, -1],
  ];
  intervals.forEach((b) => {
    points.push(
      [Math.max(start, b.start_at), 1],
      [Math.min(end, b.end_at), -1],
    );
  });
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let count = 0;
  for (const [, delta] of points) {
    count += delta;
    if (count > provider.capacity) return false;
  }
  return true;
}
export function getSlots(db, provider, date, duration, userId) {
  validateDate(date);
  fail(
    !Number.isInteger(duration) || duration < 1 || duration > 600,
    400,
    "Invalid service duration.",
  );
  const slots = [];
  for (
    let minute = provider.opens * 60;
    minute + duration <= provider.closes * 60;
    minute += 30
  ) {
    const time = timeLabel(minute),
      start = appointmentTime(date, time),
      end = start + duration * 60000;
    const conflict =
      userId &&
      db
        .prepare(
          "SELECT 1 FROM bookings WHERE user_id=? AND status!='cancelled' AND start_at<? AND end_at>?",
        )
        .get(userId, end, start);
    slots.push({
      time,
      available:
        start > Date.now() + 15 * 60000 &&
        !conflict &&
        hasCapacity(db, provider, start, end),
    });
  }
  return slots;
}
export function validateSlot(db, q, data, userId) {
  validateDate(data.date);
  const time = textValue(data.time, "Time", 5, 5);
  const slots = getSlots(db, q.provider, data.date, q.duration, userId);
  fail(
    !slots.some((s) => s.time === time && s.available),
    409,
    "This time is no longer available. Please choose another slot.",
  );
  return appointmentTime(data.date, time);
}
export const bookingView = (row) =>
  row
    ? {
        ...row,
        vehicle: JSON.parse(row.vehicle_snapshot),
        services: JSON.parse(row.service_snapshot),
        vehicle_snapshot: undefined,
        service_snapshot: undefined,
        request_key: undefined,
      }
    : null;
