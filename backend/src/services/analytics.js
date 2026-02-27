const cron = require("node-cron");
const Monitor = require("../models/monitor");
const MonitorCheck = require("../models/monitorCheck");
const Settings = require("../models/settings");
const { dateToISO } = require("../utils/helpers");
const logger = require("../utils/logger");

let cronJob = null;

function aggregateDayForMonitor(monitorId, date) {
  const { getDb } = require("../database/connection");
  const db = getDb();

  const dateStr = typeof date === "string" ? date : dateToISO(date);
  const nextDate = new Date(dateStr);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = dateToISO(nextDate);

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_checks,
      SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count,
      SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as down_count,
      SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) as degraded_count,
      AVG(response_time_ms) as avg_response_time,
      MIN(response_time_ms) as min_response_time,
      MAX(response_time_ms) as max_response_time
    FROM monitor_checks
    WHERE monitor_id = ? AND created_at >= ? AND created_at < ?
  `).get(monitorId, dateStr, nextDateStr);

  if (stats && stats.total_checks > 0) {
    MonitorCheck.upsertDailyStats(monitorId, dateStr, {
      total_checks: stats.total_checks,
      up_count: stats.up_count || 0,
      down_count: stats.down_count || 0,
      degraded_count: stats.degraded_count || 0,
      avg_response_time: Math.round(stats.avg_response_time || 0),
      min_response_time: stats.min_response_time || 0,
      max_response_time: stats.max_response_time || 0,
    });
  }
}

function runAggregation() {
  logger.info("Starting data aggregation...");

  const monitors = Monitor.findAll();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const monitor of monitors) {
    try {
      // Aggregate yesterday's data (complete day)
      aggregateDayForMonitor(monitor.id, yesterday);
      // Also re-aggregate today (partial day, will be updated later)
      aggregateDayForMonitor(monitor.id, today);
    } catch (err) {
      logger.error(`Aggregation failed for monitor ${monitor.id}: ${err.message}`);
    }
  }

  logger.info(`Aggregation complete for ${monitors.length} monitors`);
}

function start() {
  const cronExpression = Settings.get("aggregation_cron") || "0 * * * *";

  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    logger.warn(`Invalid aggregation cron: ${cronExpression}, falling back to hourly`);
    cronJob = cron.schedule("0 * * * *", runAggregation);
  } else {
    cronJob = cron.schedule(cronExpression, runAggregation);
  }

  logger.info(`Analytics aggregation scheduled: ${cronExpression}`);

  // Run initial aggregation on startup (delayed to avoid blocking)
  setTimeout(runAggregation, 5000);
}

function stop() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
}

// --- Query functions for the analytics route ---

function getOverview() {
  const monitors = Monitor.findAll();
  const { daysAgo } = require("../utils/helpers");
  
  const overview = monitors.map((m) => {
    const latest = MonitorCheck.getLatestByMonitorId(m.id);
    const uptime24h = MonitorCheck.getUptimePercentage(m.id, daysAgo(1));
    const uptime7d = MonitorCheck.getUptimePercentage(m.id, daysAgo(7));
    const uptime30d = MonitorCheck.getUptimePercentage(m.id, daysAgo(30));
    const avgRt = MonitorCheck.getAvgResponseTime(m.id, daysAgo(1));

    return {
      id: m.id,
      name: m.name,
      type: m.type,
      url: m.url,
      active: m.active,
      current_status: latest?.status || "unknown",
      last_check: latest?.created_at || null,
      response_time_ms: latest?.response_time_ms || 0,
      avg_response_time_24h: avgRt,
      uptime_24h: uptime24h,
      uptime_7d: uptime7d,
      uptime_30d: uptime30d,
    };
  });

  return { monitors: overview };
}

function getResponseTimes(monitorId, hours = 24) {
  const { daysAgo } = require("../utils/helpers");
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  return MonitorCheck.getResponseTimeSeries(monitorId, since);
}

function getAvailability(monitorId, days = 30) {
  const { dateToISO } = require("../utils/helpers");
  const since = dateToISO(new Date(Date.now() - days * 86400000));
  const now = dateToISO(new Date());
  const dailyStats = MonitorCheck.getDailyStatsRange(monitorId, since, now);
  const overallUptime = MonitorCheck.getUptimePercentage(monitorId, since);

  return {
    overall_uptime: overallUptime,
    daily: dailyStats.map((d) => ({
      date: d.date,
      uptime: d.total_checks > 0
        ? parseFloat((((d.up_count + d.degraded_count) / d.total_checks) * 100).toFixed(2))
        : 100,
      total_checks: d.total_checks,
      avg_response_time: Math.round(d.avg_response_time || 0),
    })),
  };
}

function startCronJob() { start(); }
function stopCronJob() { stop(); }

module.exports = { start, stop, startCronJob, stopCronJob, runAggregation, aggregateDayForMonitor, getOverview, getResponseTimes, getAvailability };
