const express = require("express");
const router = express.Router();
const path = require("path");
const { authMiddleware } = require("../middleware/auth");
const { getDb, resetDb, closeDb } = require("../database/connection");
const { runMigrations } = require("../database/migrations");
const { seedDefaults } = require("../database/seed");
const monitorEngine = require("../services/monitorEngine");
const backupService = require("../services/backup");
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

// POST /api/system/backup - Trigger a manual database backup
router.post("/backup", authMiddleware, (req, res) => {
  try {
    const backupPath = backupService.runBackup();
    const fs = require("fs");
    const stats = fs.statSync(backupPath);
    res.json({
      message: "Backup created successfully",
      filename: path.basename(backupPath),
      size_bytes: stats.size,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Backup failed:", err);
    res.status(500).json({ error: "Backup failed: " + err.message });
  }
});

// GET /api/system/backups - List available backups
router.get("/backups", authMiddleware, (req, res) => {
  try {
    const files = backupService.getBackupFiles();
    res.json(
      files.reverse().map((f) => ({
        filename: f.name,
        size_bytes: f.size,
        created_at: f.mtime.toISOString(),
      }))
    );
  } catch (err) {
    logger.error("Failed to list backups:", err);
    res.status(500).json({ error: "Failed to list backups: " + err.message });
  }
});

// GET /api/system/backups/:filename - Download a backup file
router.get("/backups/:filename", authMiddleware, (req, res) => {
  const fs = require("fs");
  const filename = path.basename(req.params.filename); // prevent path traversal

  if (!filename.endsWith(".db")) {
    return res.status(400).json({ error: "Invalid backup filename" });
  }

  const filePath = path.join(backupService.backupDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Backup not found" });
  }

  res.download(filePath, filename, (err) => {
    if (err && !res.headersSent) {
      logger.error("Download failed:", err);
      res.status(500).json({ error: "Download failed" });
    }
  });
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
