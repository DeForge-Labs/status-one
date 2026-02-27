const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const { getDb, resetDb, closeDb } = require("../database/connection");
const { runMigrations } = require("../database/migrations");
const { seedDefaults } = require("../database/seed");
const monitorEngine = require("../services/monitorEngine");
const logger = require("../utils/logger");

// GET /api/system/health - Health check
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage(),
  });
});

// GET /api/system/info - System information (auth required)
router.get("/info", authMiddleware, (req, res) => {
  const db = getDb();
  const dbSize = db.query("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();
  const monitorCount = db.query("SELECT COUNT(*) as count FROM monitors").get();
  const checkCount = db.query("SELECT COUNT(*) as count FROM monitor_checks").get();
  const userCount = db.query("SELECT COUNT(*) as count FROM users").get();

  res.json({
    version: "1.0.0",
    runtime: "Bun",
    uptime: process.uptime(),
    database: {
      size_bytes: dbSize?.size || 0,
      monitors: monitorCount?.count || 0,
      checks: checkCount?.count || 0,
      users: userCount?.count || 0,
    },
    engine: {
      activeMonitors: monitorEngine.getActiveCount(),
    },
    memory: process.memoryUsage(),
  });
});

// POST /api/system/factory-reset - Full system reset
router.post("/factory-reset", authMiddleware, async (req, res) => {
  const { confirm } = req.body;

  if (confirm !== "FACTORY_RESET") {
    return res.status(400).json({
      error: "Please send { confirm: 'FACTORY_RESET' } to confirm this action",
    });
  }

  logger.warn("Factory reset initiated by user:", req.user.email);

  try {
    // Stop all monitors
    monitorEngine.stopAll();

    // Reset database
    resetDb();

    // Re-run migrations and seed
    runMigrations();
    seedDefaults();

    logger.warn("Factory reset completed");
    res.json({ message: "Factory reset completed. All data has been erased. Please restart the application." });
  } catch (err) {
    logger.error("Factory reset failed:", err);
    res.status(500).json({ error: "Factory reset failed: " + err.message });
  }
});

// POST /api/system/backup - Trigger database backup
router.post("/backup", authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const fs = require("fs");
    const path = require("path");
    const config = require("../config");

    const backupDir = path.join(config.dataDir, "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

    // Use SQLite VACUUM INTO for consistent backup
    db.run(`VACUUM INTO '${backupPath}'`);

    const stats = fs.statSync(backupPath);
    res.json({
      message: "Backup created successfully",
      path: backupPath,
      size_bytes: stats.size,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Backup failed:", err);
    res.status(500).json({ error: "Backup failed: " + err.message });
  }
});

// POST /api/system/purge-checks - Purge old check data
router.post("/purge-checks", authMiddleware, (req, res) => {
  const { days } = req.body;
  const retentionDays = parseInt(days) || 30;

  if (retentionDays < 1) {
    return res.status(400).json({ error: "Days must be at least 1" });
  }

  const db = getDb();
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
  const result = db.run("DELETE FROM monitor_checks WHERE created_at < ?", [cutoff]);

  logger.info(`Purged checks older than ${retentionDays} days. Rows deleted: ${result.changes}`);
  res.json({
    message: `Purged checks older than ${retentionDays} days`,
    deleted: result.changes,
  });
});

module.exports = router;
