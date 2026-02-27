const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");

const MonitorCheck = {
  create({ monitor_id, status, response_time_ms, status_code, error_message, metadata }) {
    const db = getDb();
    const id = generateId();
    db.prepare(`
      INSERT INTO monitor_checks (id, monitor_id, status, response_time_ms, status_code, error_message, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      monitor_id,
      status || "up",
      response_time_ms || 0,
      status_code || 0,
      error_message || "",
      JSON.stringify(metadata || {}),
      nowISO()
    );
    return id;
  },

  findByMonitorId(monitorId, { limit = 20, offset = 0 } = {}) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM monitor_checks 
      WHERE monitor_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(monitorId, limit, offset);
  },

  countByMonitorId(monitorId) {
    const db = getDb();
    return db.prepare("SELECT COUNT(*) as count FROM monitor_checks WHERE monitor_id = ?").get(monitorId).count;
  },

  getLatestByMonitorId(monitorId) {
    const db = getDb();
    return db.prepare(
      "SELECT * FROM monitor_checks WHERE monitor_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(monitorId);
  },

  getRecentByMonitorId(monitorId, limit = 10) {
    const db = getDb();
    return db.prepare(
      "SELECT * FROM monitor_checks WHERE monitor_id = ? ORDER BY created_at DESC LIMIT ?"
    ).all(monitorId, limit);
  },

  getConsecutiveFailures(monitorId) {
    const db = getDb();
    // Get checks in reverse order and count consecutive non-up statuses
    const checks = db.prepare(
      "SELECT status FROM monitor_checks WHERE monitor_id = ? ORDER BY created_at DESC LIMIT 50"
    ).all(monitorId);
    let count = 0;
    for (const c of checks) {
      if (c.status !== "up") count++;
      else break;
    }
    return count;
  },

  getUptimePercentage(monitorId, since) {
    const db = getDb();
    const row = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'up' OR status = 'degraded' THEN 1 ELSE 0 END) as up_count
      FROM monitor_checks 
      WHERE monitor_id = ? AND created_at >= ?
    `).get(monitorId, since);
    if (!row || row.total === 0) return 100;
    return parseFloat(((row.up_count / row.total) * 100).toFixed(3));
  },

  getAvgResponseTime(monitorId, since) {
    const db = getDb();
    const row = db.prepare(`
      SELECT AVG(response_time_ms) as avg_rt
      FROM monitor_checks 
      WHERE monitor_id = ? AND created_at >= ? AND status != 'down'
    `).get(monitorId, since);
    return row?.avg_rt ? Math.round(row.avg_rt) : 0;
  },

  getResponseTimeSeries(monitorId, since, bucketMinutes = 60) {
    const db = getDb();
    // Group by time buckets
    return db.prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:00:00', created_at) as bucket,
        AVG(response_time_ms) as avg_rt,
        MIN(response_time_ms) as min_rt,
        MAX(response_time_ms) as max_rt,
        COUNT(*) as checks
      FROM monitor_checks
      WHERE monitor_id = ? AND created_at >= ?
      GROUP BY bucket
      ORDER BY bucket ASC
    `).all(monitorId, since);
  },

  getStatusDistribution(monitorId, since) {
    const db = getDb();
    return db.prepare(`
      SELECT status, COUNT(*) as count
      FROM monitor_checks
      WHERE monitor_id = ? AND created_at >= ?
      GROUP BY status
    `).all(monitorId, since);
  },

  getStatsByRange(monitorId, since) {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up,
        SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as down,
        SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) as degraded,
        AVG(response_time_ms) as avg_response_time
      FROM monitor_checks
      WHERE monitor_id = ? AND created_at >= ?
    `).get(monitorId, since);
    return row || { total: 0, up: 0, down: 0, degraded: 0, avg_response_time: 0 };
  },

  deleteOlderThan(date) {
    const db = getDb();
    const result = db.prepare("DELETE FROM monitor_checks WHERE created_at < ?").run(date);
    return result.changes;
  },

  deleteByMonitorId(monitorId) {
    const db = getDb();
    db.prepare("DELETE FROM monitor_checks WHERE monitor_id = ?").run(monitorId);
  },

  getDailyStats(monitorId, date) {
    const db = getDb();
    return db.prepare(
      "SELECT * FROM monitor_daily_stats WHERE monitor_id = ? AND date = ?"
    ).get(monitorId, date);
  },

  upsertDailyStats(monitorId, date, stats) {
    const db = getDb();
    const id = generateId();
    db.prepare(`
      INSERT INTO monitor_daily_stats (id, monitor_id, date, total_checks, up_count, down_count, degraded_count, avg_response_time, min_response_time, max_response_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(monitor_id, date) DO UPDATE SET
        total_checks = excluded.total_checks,
        up_count = excluded.up_count,
        down_count = excluded.down_count,
        degraded_count = excluded.degraded_count,
        avg_response_time = excluded.avg_response_time,
        min_response_time = excluded.min_response_time,
        max_response_time = excluded.max_response_time
    `).run(
      id,
      monitorId,
      date,
      stats.total_checks,
      stats.up_count,
      stats.down_count,
      stats.degraded_count,
      stats.avg_response_time,
      stats.min_response_time,
      stats.max_response_time
    );
  },

  getDailyStatsRange(monitorId, startDate, endDate) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM monitor_daily_stats
      WHERE monitor_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).all(monitorId, startDate, endDate);
  },

  deleteOldStats(date) {
    const db = getDb();
    const result = db.prepare("DELETE FROM monitor_daily_stats WHERE date < ?").run(date);
    return result.changes;
  },
};

module.exports = MonitorCheck;
