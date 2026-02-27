const cron = require("node-cron");
const MonitorCheck = require("../models/monitorCheck");
const Settings = require("../models/settings");
const { daysAgo, dateToISO } = require("../utils/helpers");
const logger = require("../utils/logger");

let cronJob = null;

function runRetention() {
  logger.info("Running data retention cleanup...");

  try {
    // Clean old raw checks
    const retentionDays = parseInt(Settings.get("data_retention_days") || "90", 10);
    const cutoffDate = daysAgo(retentionDays);
    const deletedChecks = MonitorCheck.deleteOlderThan(cutoffDate);
    if (deletedChecks > 0) {
      logger.info(`Deleted ${deletedChecks} old check records (older than ${retentionDays} days)`);
    }

    // Clean old daily stats
    const statsRetentionDays = parseInt(Settings.get("stats_retention_days") || "365", 10);
    const statsCutoff = new Date();
    statsCutoff.setDate(statsCutoff.getDate() - statsRetentionDays);
    const deletedStats = MonitorCheck.deleteOldStats(dateToISO(statsCutoff));
    if (deletedStats > 0) {
      logger.info(`Deleted ${deletedStats} old daily stats (older than ${statsRetentionDays} days)`);
    }

    // Clean expired sessions
    const { getDb } = require("../database/connection");
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
    db.prepare("DELETE FROM password_resets WHERE expires_at < ? OR used = 1").run(now);
  } catch (err) {
    logger.error(`Data retention error: ${err.message}`);
  }
}

function start() {
  const cronExpression = Settings.get("retention_cron") || "0 2 * * *";

  if (!cron.validate(cronExpression)) {
    logger.warn(`Invalid retention cron: ${cronExpression}, falling back to 2 AM daily`);
    cronJob = cron.schedule("0 2 * * *", runRetention);
  } else {
    cronJob = cron.schedule(cronExpression, runRetention);
  }

  logger.info(`Data retention scheduled: ${cronExpression}`);
}

function stop() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
}

function startCronJob() { start(); }
function stopCronJob() { stop(); }

module.exports = { start, stop, startCronJob, stopCronJob, runRetention };
