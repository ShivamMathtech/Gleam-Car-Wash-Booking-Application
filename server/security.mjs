import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  randomInt,
} from "node:crypto";
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (condition, status, message) => {
  if (condition) throw new HttpError(status, message);
};
export const token = () => randomBytes(32).toString("hex");
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const otpCode = () => String(randomInt(100000, 1000000));
export function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(value, salt, 64).toString("hex")}`;
}
export function verifyPassword(value, saved) {
  if (!saved) return false;
  try {
    const [salt, hash] = saved.split(":");
    return timingSafeEqual(
      Buffer.from(hash, "hex"),
      scryptSync(value, salt, 64),
    );
  } catch {
    return false;
  }
}
export function textValue(value, name, min = 1, max = 200) {
  fail(typeof value !== "string", 400, `${name} is required.`);
  const cleaned = value.trim();
  fail(
    cleaned.length < min || cleaned.length > max,
    400,
    `${name} must contain ${min}–${max} characters.`,
  );
  return cleaned;
}
export function emailValue(value) {
  const email = textValue(value, "Email", 5, 254).toLowerCase();
  fail(
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    400,
    "Enter a valid email address.",
  );
  return email;
}
export function phoneValue(value) {
  const phone = String(value || "")
    .replace(/[\s()-]/g, "")
    .replace(/^0/, "");
  const normalized = /^[6-9]\d{9}$/.test(phone) ? `+91${phone}` : phone;
  fail(
    !/^\+91[6-9]\d{9}$/.test(normalized),
    400,
    "Enter a valid Indian mobile number (10 digits, or +91).",
  );
  return normalized;
}
export function passwordValue(value) {
  fail(
    typeof value !== "string" || value.length < 10 || value.length > 128,
    400,
    "Password must contain 10–128 characters.",
  );
  return value;
}
export const publicUser = (user) =>
  user
    ? {
        id: user.id,
        name: user.name,
        email: user.email || "",
        phone: user.phone || "",
        role: user.role,
        location: user.location,
        lat: user.lat,
        lng: user.lng,
        notificationsEnabled: !!user.notifications_enabled,
      }
    : null;
export function createLimiter() {
  const hits = new Map();
  return (key, limit = 12, interval = 15 * 60 * 1000) => {
    const now = Date.now();
    if (hits.size > 5000)
      for (const [k, v] of hits) if (v.until < now) hits.delete(k);
    const item = hits.get(key);
    if (!item || item.until < now) {
      hits.set(key, { n: 1, until: now + interval });
      return;
    }
    fail(item.n >= limit, 429, "Too many attempts. Please try again later.");
    item.n++;
  };
}
