const express = require("express");
const cors = require("cors");
const { createRateLimiter } = require("./middleware/rateLimit");
const { setupGuard } = require("./middleware/setupGuard");
const { errorHandler } = require("./middleware/errorHandler");
const { apiKeyAuth } = require("./middleware/apiKeyAuth");

// Route imports
const setupRoutes = require("./routes/setup");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const monitorRoutes = require("./routes/monitors");
const tagRoutes = require("./routes/tags");
const incidentRoutes = require("./routes/incidents");
const statusPageRoutes = require("./routes/statusPages");
const notificationRoutes = require("./routes/notifications");
const maintenanceRoutes = require("./routes/maintenance");
const analyticsRoutes = require("./routes/analytics");
const settingsRoutes = require("./routes/settings");
const apiKeyRoutes = require("./routes/apiKeys");
const systemRoutes = require("./routes/system");
const publicRoutes = require("./routes/public");
const telegramRoutes = require("./routes/telegram");

function createApp() {
  const app = express();

  // --- Global Middleware ---

  // CORS
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  }));

  // Body parsing
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Global rate limiter: 200 requests per minute per IP
  app.use(createRateLimiter({
    windowMs: 60 * 1000,
    max: 200,
    message: "Too many requests, please try again later.",
  }));

  // Stricter rate limit on auth routes: 20 per minute
  const authLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 20,
    message: "Too many authentication attempts.",
  });

  // Setup guard - blocks everything except public/setup/heartbeat if no users exist
  app.use(setupGuard);

  // --- Routes ---

  // Public routes (no auth)
  app.use("/api/public", publicRoutes);

  // Telegram bot webhook (public, verified internally per channel)
  app.use("/api/telegram", telegramRoutes);

  // Setup (first admin creation)
  app.use("/api/setup", setupRoutes);

  // Auth routes with stricter rate limit
  app.use("/api/auth", authLimiter, authRoutes);

  // Heartbeat push endpoint (auth via push token in URL)
  app.post("/api/heartbeat/:id/:pushToken", (req, res, next) => {
    const monitorRouteHandler = require("./routes/monitors");
    // Forward to monitors heartbeat handler - handled within monitors route
    next();
  });

  // Protected API routes (JWT or API key)
  app.use("/api/users", userRoutes);
  app.use("/api/monitors", monitorRoutes);
  app.use("/api/tags", tagRoutes);
  app.use("/api/incidents", incidentRoutes);
  app.use("/api/status-pages", statusPageRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/maintenance", maintenanceRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/api-keys", apiKeyRoutes);
  app.use("/api/system", systemRoutes);

  // API key authenticated routes (alternative auth)
  app.use("/api/ext", apiKeyAuth, monitorRoutes);

  // 404 handler
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
