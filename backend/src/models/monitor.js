const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");

const Monitor = {
  create(data) {
    const db = getDb();
    const id = generateId();
    const now = nowISO();
    db.prepare(`
      INSERT INTO monitors (
        id, name, type, url, method, headers, body, 
        interval_seconds, timeout_ms, retries, retry_interval_seconds,
        expected_status, keyword, keyword_type, degraded_threshold_ms,
        hostname, port, dns_record_type, push_token, push_interval_seconds,
        ssl_warn_days, active, accepted_status_codes, max_redirects,
        auth_method, auth_user, auth_pass, description, created_by,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )
    `).run(
      id,
      data.name,
      data.type || "http",
      data.url || "",
      data.method || "GET",
      JSON.stringify(data.headers || {}),
      data.body || "",
      data.interval_seconds || 60,
      data.timeout_ms || 10000,
      data.retries || 3,
      data.retry_interval_seconds || 10,
      data.expected_status || 200,
      data.keyword || "",
      data.keyword_type || "contains",
      data.degraded_threshold_ms || 2000,
      data.hostname || "",
      data.port || 0,
      data.dns_record_type || "A",
      data.push_token || "",
      data.push_interval_seconds || 60,
      data.ssl_warn_days || 30,
      data.active !== undefined ? (data.active ? 1 : 0) : 1,
      data.accepted_status_codes || "200-299",
      data.max_redirects || 5,
      data.auth_method || "none",
      data.auth_user || "",
      data.auth_pass || "",
      data.description || "",
      data.created_by || null,
      now,
      now
    );
    return this.findById(id);
  },

  findById(id) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM monitors WHERE id = ?").get(id);
    if (row) {
      row.headers = JSON.parse(row.headers || "{}");
      row.active = !!row.active;
    }
    return row;
  },

  findAll({ active } = {}) {
    const db = getDb();
    let query = "SELECT * FROM monitors";
    const params = [];
    if (active !== undefined) {
      query += " WHERE active = ?";
      params.push(active ? 1 : 0);
    }
    query += " ORDER BY created_at DESC";
    return db.prepare(query).all(...params).map((row) => {
      row.headers = JSON.parse(row.headers || "{}");
      row.active = !!row.active;
      return row;
    });
  },

  count() {
    const db = getDb();
    return db.prepare("SELECT COUNT(*) as count FROM monitors").get().count;
  },

  countAll() {
    return this.count();
  },

  countByStatus() {
    const db = getDb();
    const rows = db.prepare(`
      SELECT 
        SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) as paused
      FROM monitors
    `).get();
    // Get current status from latest checks
    const statusRows = db.prepare(`
      SELECT m.id, mc.status FROM monitors m
      LEFT JOIN monitor_checks mc ON mc.id = (
        SELECT id FROM monitor_checks WHERE monitor_id = m.id ORDER BY created_at DESC LIMIT 1
      )
    `).all();
    let up = 0, down = 0, degraded = 0, unknown = 0;
    for (const r of statusRows) {
      if (r.status === 'up') up++;
      else if (r.status === 'down') down++;
      else if (r.status === 'degraded') degraded++;
      else unknown++;
    }
    return { total: rows.active + rows.paused, active: rows.active, paused: rows.paused, up, down, degraded, unknown };
  },

  update(id, data) {
    const db = getDb();
    const allowed = [
      "name", "type", "url", "method", "headers", "body",
      "interval_seconds", "timeout_ms", "retries", "retry_interval_seconds",
      "expected_status", "keyword", "keyword_type", "degraded_threshold_ms",
      "hostname", "port", "dns_record_type", "push_token", "push_interval_seconds",
      "ssl_warn_days", "active", "accepted_status_codes", "max_redirects",
      "auth_method", "auth_user", "auth_pass", "description",
    ];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(data)) {
      if (allowed.includes(key) && val !== undefined) {
        sets.push(`${key} = ?`);
        if (key === "headers") {
          values.push(typeof val === "string" ? val : JSON.stringify(val));
        } else if (key === "active") {
          values.push(val ? 1 : 0);
        } else {
          values.push(val);
        }
      }
    }
    if (sets.length === 0) return this.findById(id);
    sets.push("updated_at = ?");
    values.push(nowISO());
    values.push(id);
    db.prepare(`UPDATE monitors SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete(id) {
    const db = getDb();
    db.prepare("DELETE FROM monitors WHERE id = ?").run(id);
  },

  findByPushToken(token) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM monitors WHERE push_token = ? AND type = 'push'").get(token);
    if (row) {
      row.headers = JSON.parse(row.headers || "{}");
      row.active = !!row.active;
    }
    return row;
  },

  getTagsForMonitor(monitorId) {
    const db = getDb();
    return db.prepare(`
      SELECT t.* FROM tags t
      INNER JOIN monitor_tags mt ON mt.tag_id = t.id
      WHERE mt.monitor_id = ?
    `).all(monitorId);
  },

  addTag(monitorId, tagId) {
    const db = getDb();
    db.prepare("INSERT OR IGNORE INTO monitor_tags (monitor_id, tag_id) VALUES (?, ?)").run(monitorId, tagId);
  },

  removeTag(monitorId, tagId) {
    const db = getDb();
    db.prepare("DELETE FROM monitor_tags WHERE monitor_id = ? AND tag_id = ?").run(monitorId, tagId);
  },

  getNotificationChannels(monitorId) {
    const db = getDb();
    return db.prepare(`
      SELECT nc.* FROM notification_channels nc
      INNER JOIN monitor_notifications mn ON mn.notification_channel_id = nc.id
      WHERE mn.monitor_id = ? AND nc.active = 1
    `).all(monitorId).map((row) => {
      row.config = JSON.parse(row.config || "{}");
      row.active = !!row.active;
      return row;
    });
  },

  addNotificationChannel(monitorId, channelId) {
    const db = getDb();
    db.prepare(
      "INSERT OR IGNORE INTO monitor_notifications (monitor_id, notification_channel_id) VALUES (?, ?)"
    ).run(monitorId, channelId);
  },

  removeNotificationChannel(monitorId, channelId) {
    const db = getDb();
    db.prepare(
      "DELETE FROM monitor_notifications WHERE monitor_id = ? AND notification_channel_id = ?"
    ).run(monitorId, channelId);
  },

  getLinkedNotificationIds(monitorId) {
    const db = getDb();
    return db.prepare(
      "SELECT notification_channel_id FROM monitor_notifications WHERE monitor_id = ?"
    ).all(monitorId).map((r) => r.notification_channel_id);
  },
};

module.exports = Monitor;
