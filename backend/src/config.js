const path = require("path");

const PLACEHOLDER_JWT_SECRET = "change-me-to-a-random-secret";

const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  jwtSecret: process.env.JWT_SECRET || PLACEHOLDER_JWT_SECRET,
  jwtExpiresIn: "7d",
  resetTokenExpiresMinutes: 30,

  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "Status One <noreply@example.com>",
  },

  dataDir: path.join(process.cwd(), "data"),
  dbPath: path.join(process.cwd(), "data", "status-one.db"),

  rateLimiting: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120,
  },

  defaults: {
    checkIntervalSeconds: 60,
    checkTimeoutMs: 10000,
    retries: 3,
    dataRetentionDays: 90,
    statsRetentionDays: 365,
  },
};

if (config.jwtSecret === PLACEHOLDER_JWT_SECRET) {
  console.warn("!!! WARNING: JWT_SECRET is unset or still the placeholder. Anyone can forge login tokens. Set JWT_SECRET to a long random string. !!!");
}

module.exports = config;
