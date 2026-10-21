import { randomUUID } from "node:crypto";
import {
  HttpError,
  fail,
  token,
  digest,
  otpCode,
  hashPassword,
  verifyPassword,
  textValue,
  emailValue,
  phoneValue,
  passwordValue,
  publicUser,
} from "./security.mjs";

export function sessionFor(db, req) {
  const raw = req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("gleam_session="))
    ?.slice(14);
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const session = db
    .prepare("SELECT * FROM sessions WHERE token_hash=? AND expires_at>?")
    .get(digest(raw), Date.now());
  if (!session) return null;
  const user = db
    .prepare("SELECT * FROM users WHERE id=?")
    .get(session.user_id);
  return user ? { ...session, user } : null;
}
export function createSession(db, config, res, user) {
  const raw = token(),
    csrf = token();
  db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run(
    digest(raw),
    user.id,
    csrf,
    Date.now() + 7 * 86400000,
  );
  res.setHeader(
    "Set-Cookie",
    `gleam_session=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${config.secureCookies ? "; Secure" : ""}`,
  );
  return { user: publicUser(user), csrfToken: csrf };
}
export async function authRoute(ctx) {
  const { path, method, db, config, req, res, data, session, send, limit } =
    ctx;
  const ip = req.socket.remoteAddress;
  if (path === "/api/session" && method === "GET") {
    send(200, {
      user: publicUser(session?.user),
      csrfToken: session?.csrf || "",
      demoMode: config.demo,
      smsEnabled: config.demo || !!config.twilioSid,
      timezone: "Asia/Kolkata",
    });
    return true;
  }
  if (path === "/api/auth/login" && method === "POST") {
    limit(`login:${ip}`, 30);
    const email = emailValue(data.email);
    limit(`login:${email}`, 12);
    const password = textValue(data.password, "Password", 1, 128);
    const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
    fail(
      !user || !verifyPassword(password, user.password_hash),
      401,
      "Email or password is incorrect.",
    );
    send(200, createSession(db, config, res, user));
    return true;
  }
  if (path === "/api/auth/register" && method === "POST") {
    limit(`register:${ip}`, 10, 3600000);
    const name = textValue(data.name, "Name", 2, 80),
      email = emailValue(data.email),
      password = passwordValue(data.password);
    fail(
      db.prepare("SELECT 1 FROM users WHERE email=?").get(email),
      409,
      "This email is already registered. Please sign in.",
    );
    const id = randomUUID();
    db.prepare(
      "INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)",
    ).run(id, name, email, hashPassword(password), Date.now());
    send(
      201,
      createSession(
        db,
        config,
        res,
        db.prepare("SELECT * FROM users WHERE id=?").get(id),
      ),
    );
    return true;
  }
  if (path === "/api/auth/request-otp" && method === "POST") {
    limit(`otp:${ip}`, 15);
    const phone = phoneValue(data.phone);
    limit(`otp:${phone}`, 5);
    const prev = db
      .prepare("SELECT requested_at FROM otps WHERE phone=?")
      .get(phone);
    fail(
      prev && prev.requested_at > Date.now() - 30000,
      429,
      "Please wait 30 seconds before requesting another code.",
    );
    fail(
      !config.demo &&
        (!config.twilioSid || !config.twilioToken || !config.twilioFrom),
      503,
      "SMS sign-in is not configured. Use email and password.",
    );
    const code = otpCode();
    if (!config.demo) {
      let sms;
      try {
        sms = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.twilioSid)}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${config.twilioSid}:${config.twilioToken}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: phone,
              From: config.twilioFrom,
              Body: `Your Gleam verification code is ${code}. It expires in 5 minutes.`,
            }),
            signal: AbortSignal.timeout(10000),
          },
        );
      } catch {
        throw new HttpError(
          503,
          "SMS delivery is unavailable. Please try email sign-in.",
        );
      }
      fail(!sms.ok, 503, "SMS delivery failed. Please try email sign-in.");
    }
    db.prepare(
      "INSERT INTO otps VALUES (?,?,?,0,?) ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=0, requested_at=excluded.requested_at",
    ).run(phone, digest(`${phone}:${code}`), Date.now() + 300000, Date.now());
    send(200, {
      message: config.demo
        ? "Local demonstration code created. No SMS was sent."
        : "Verification code sent.",
      ...(config.demo ? { demoCode: code } : {}),
    });
    return true;
  }
  if (path === "/api/auth/verify-otp" && method === "POST") {
    limit(`verify:${ip}`, 30);
    const phone = phoneValue(data.phone),
      code = textValue(data.code, "Code", 6, 6);
    const saved = db.prepare("SELECT * FROM otps WHERE phone=?").get(phone);
    fail(
      !saved || saved.expires_at < Date.now() || saved.attempts >= 5,
      400,
      "The code expired or has too many attempts. Request a new one.",
    );
    db.prepare("UPDATE otps SET attempts=attempts+1 WHERE phone=?").run(phone);
    fail(
      saved.code_hash !== digest(`${phone}:${code}`),
      400,
      "That code is incorrect. Please try again.",
    );
    let user = db.prepare("SELECT * FROM users WHERE phone=?").get(phone);
    if (!user) {
      const id = randomUUID();
      db.prepare(
        "INSERT INTO users (id,name,phone,created_at) VALUES (?,?,?,?)",
      ).run(id, "Car lover", phone, Date.now());
      user = db.prepare("SELECT * FROM users WHERE id=?").get(id);
    }
    db.prepare("DELETE FROM otps WHERE phone=?").run(phone);
    send(200, createSession(db, config, res, user));
    return true;
  }
  if (path === "/api/auth/logout" && method === "POST") {
    if (session)
      db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
        session.token_hash,
      );
    res.setHeader(
      "Set-Cookie",
      `gleam_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.secureCookies ? "; Secure" : ""}`,
    );
    send(200, { ok: true });
    return true;
  }
  if (path === "/api/auth/password" && method === "PUT") {
    fail(!session, 401, "Please sign in.");
    limit(`password:${session.user.id}`, 8);
    const password = passwordValue(data.newPassword);
    if (session.user.password_hash)
      fail(
        !verifyPassword(
          String(data.currentPassword || ""),
          session.user.password_hash,
        ),
        400,
        "Current password is incorrect.",
      );
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
      hashPassword(password),
      session.user.id,
    );
    db.prepare("DELETE FROM sessions WHERE user_id=? AND token_hash!=?").run(
      session.user.id,
      session.token_hash,
    );
    send(200, { ok: true });
    return true;
  }
  return false;
}
