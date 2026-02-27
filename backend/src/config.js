const path = require("path");

const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  jwtSecret: process.env.JWT_SECRET || "change-me-to-a-random-secret",
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

module.exports = config;
