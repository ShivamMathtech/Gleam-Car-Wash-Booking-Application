import { existsSync } from "node:fs";
import { resolve } from "node:path";
if (existsSync(resolve(".env"))) process.loadEnvFile(resolve(".env"));
export function getConfig(overrides = {}) {
  const demo = process.env.DEMO_MODE !== "false";
  const config = {
    port: Number(process.env.PORT || 4000),
    host: process.env.HOST || "127.0.0.1",
    dbPath: resolve(process.env.DB_PATH || "./data/gleam.sqlite"),
    demo,
    appOrigin: (process.env.APP_ORIGIN || "http://localhost:4000").replace(
      /\/$/,
      "",
    ),
    secureCookies: process.env.COOKIE_SECURE === "true",
    adminEmail: process.env.ADMIN_EMAIL || "",
    adminPassword: process.env.ADMIN_PASSWORD || "",
    twilioSid: process.env.TWILIO_ACCOUNT_SID || "",
    twilioToken: process.env.TWILIO_AUTH_TOKEN || "",
    twilioFrom: process.env.TWILIO_FROM_NUMBER || "",
    ...overrides,
  };
  if (
    !config.demo &&
    (!config.appOrigin.startsWith("https://") || !config.secureCookies)
  ) {
    throw new Error(
      "Production requires an HTTPS APP_ORIGIN and COOKIE_SECURE=true. Use a reverse proxy with TLS.",
    );
  }
  return config;
}
