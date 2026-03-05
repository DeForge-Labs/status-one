const path = require("path");
const fs = require("fs");
const cron = require("node-cron");
const { getDb } = require("../database/connection");
const config = require("../config");
const logger = require("../utils/logger");

const MAX_BACKUPS = 2;
const backupDir = path.join(config.dataDir, "backups");

function ensureBackupDir() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
}

function getBackupFiles() {
  ensureBackupDir();
  return fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => {
      const filePath = path.join(backupDir, f);
      const stats = fs.statSync(filePath);
      return { name: f, path: filePath, mtime: stats.mtime, size: stats.size };
    })
    .sort((a, b) => a.mtime - b.mtime); // oldest first
}

function runBackup() {
  logger.info("Running database backup...");
  try {
    ensureBackupDir();

    const db = getDb();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

    db.run(`VACUUM INTO '${backupPath}'`);
    logger.info(`Backup created: ${backupPath}`);

    // Rotate: delete oldest backups until we are within the limit
    const files = getBackupFiles();
    while (files.length > MAX_BACKUPS) {
      const oldest = files.shift();
      fs.unlinkSync(oldest.path);
      logger.info(`Removed old backup: ${oldest.name}`);
    }

    return backupPath;
  } catch (err) {
    logger.error("Backup failed:", err.message);
    throw err;
  }
}

let cronJob = null;

function startCronJob() {
  // Run backup every 12 hours
  cronJob = cron.schedule("0 */12 * * *", () => {
    try {
      runBackup();
    } catch (_) {
      // already logged
    }
  });
  logger.info("Backup service started (every 12 hours)");
}

function stopCronJob() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
}

module.exports = { startCronJob, stopCronJob, runBackup, getBackupFiles, backupDir };
