const config = require("./src/config");
const logger = require("./src/utils/logger");
const { getDb } = require("./src/database/connection");
const { runMigrations } = require("./src/database/migrations");
const { seedDefaults } = require("./src/database/seed");
const { createApp } = require("./src/app");
const monitorEngine = require("./src/services/monitorEngine");
const analytics = require("./src/services/analytics");
const dataRetention = require("./src/services/dataRetention");
const heartbeat = require("./src/services/heartbeat");

async function main() {
  logger.info("=== Status One - Starting Up ===");

  // Initialize database
  logger.info("Initializing database...");
  const db = getDb();
  logger.info("Database connected.");

  // Run migrations
  logger.info("Running migrations...");
  runMigrations();
  logger.info("Migrations complete.");

  // Seed default settings
  seedDefaults();
  logger.info("Default settings seeded.");

  // Create Express app
  const app = createApp();

  // Start the HTTP server
  const server = app.listen(config.port, () => {
    logger.info(`Server listening on http://localhost:${config.port}`);
  });

  // Start monitor engine (loads active monitors and begins checking)
  logger.info("Starting monitor engine...");
  monitorEngine.start();
  logger.info("Monitor engine started.");

  // Start cron jobs
  logger.info("Starting scheduled jobs...");
  analytics.startCronJob();
  dataRetention.startCronJob();
  heartbeat.startExpiredCheck();
  logger.info("Scheduled jobs started.");

  logger.info("=== Status One - Ready ===");

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    // Stop monitor engine
    monitorEngine.stopAll();
    logger.info("Monitor engine stopped.");

    // Stop cron jobs
    analytics.stopCronJob();
    dataRetention.stopCronJob();
    heartbeat.stopExpiredCheck();
    logger.info("Cron jobs stopped.");

    // Close HTTP server
    server.close(() => {
      logger.info("HTTP server closed.");

      // Close database
      const { closeDb } = require("./src/database/connection");
      closeDb();
      logger.info("Database closed.");

      logger.info("Goodbye!");
      process.exit(0);
    });

    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
      logger.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Fatal error during startup:", err);
  process.exit(1);
});