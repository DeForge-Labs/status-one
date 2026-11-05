const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { authMiddleware } = require("../middleware/auth");
const { getDb } = require("../database/connection");
const { resetDatabase } = require("../database/migrations");
const config = require("../config");
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
  const dbSize = db.query(
    "SELECT page_count * page_size as size, freelist_count * page_size as free FROM pragma_page_count(), pragma_page_size(), pragma_freelist_count()"
  ).get();
  // Committed data can sit in the -wal file until a checkpoint, so report real disk usage too
  const fileSize = (suffix) => {
    try { return fs.statSync(config.dbPath + suffix).size; } catch { return 0; }
  };
  const monitorCount = db.query("SELECT COUNT(*) as count FROM monitors").get();
  const checkCount = db.query("SELECT COUNT(*) as count FROM monitor_checks").get();
  const userCount = db.query("SELECT COUNT(*) as count FROM users").get();

  res.json({
    version: "1.0.0",
    runtime: "Bun",
    uptime: process.uptime(),
    database: {
      size_bytes: dbSize?.size || 0,
      free_bytes: dbSize?.free || 0,
      disk_bytes: fileSize("") + fileSize("-wal"),
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

  // Stop checks so nothing writes into tables while they are dropped
  monitorEngine.stopAll();

  try {
    resetDatabase();
    compactDb();

    logger.warn("Factory reset completed");
    res.json({ message: "Factory reset completed. All data has been erased." });
  } catch (err) {
    logger.error("Factory reset failed:", err);
    monitorEngine.start();
    res.status(500).json({ error: "Factory reset failed: " + err.message });
  }
});

// POST /api/system/backup - Trigger a manual database backup
router.post("/backup", authMiddleware, (req, res) => {
  try {
    const backupPath = backupService.runBackup("manual");
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
  const retentionDays = parseInt(req.body?.days, 10);

  // Hourly aggregation re-reads yesterday's raw checks, so keep at least 2 days to not corrupt daily stats
  if (!Number.isFinite(retentionDays) || retentionDays < 2) {
    return res.status(400).json({ error: "Days must be a number of at least 2" });
  }

  const db = getDb();
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
  const result = db.run("DELETE FROM monitor_checks WHERE created_at < ?", [cutoff]);
  if (result.changes > 0) compactDb();

  logger.info(`Purged checks older than ${retentionDays} days. Rows deleted: ${result.changes}`);
  res.json({
    message: `Purged checks older than ${retentionDays} days`,
    deleted: result.changes,
  });
});

// DELETE leaves free pages behind; VACUUM + checkpoint actually shrinks the files on disk
function compactDb() {
  const db = getDb();
  db.run("VACUUM");
  db.run("PRAGMA wal_checkpoint(TRUNCATE)");
}

module.exports = router;
