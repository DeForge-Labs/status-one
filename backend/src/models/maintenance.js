const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");

// Recurring windows repeat every interval; a missing or unknown interval means a one-off window.
const RECURRING_MS = new Map([
  ["daily", 86400000],
  ["weekly", 604800000],
]);

// Live at nowMs when some occurrence k >= 0 covers it: start + k*interval <= now <= end + k*interval.
function isLiveAt(w, nowMs) {
  const start = Date.parse(w.start_time);
  const duration = Date.parse(w.end_time) - start;
  const interval = w.recurring ? RECURRING_MS.get(w.recurring_interval) : undefined;
  if (!interval) return start <= nowMs && nowMs <= start + duration;
  const kLatest = Math.floor((nowMs - start) / interval);
  const kEarliest = Math.max(0, Math.ceil((nowMs - start - duration) / interval));
  return kEarliest <= kLatest;
}

const Maintenance = {
  RECURRING_INTERVALS: [...RECURRING_MS.keys()],
  isLiveAt,

  // Fetch monitor_ids for each row in a single extra query and attach them as an array.
  _attachMonitorIds(rows) {
    if (rows.length === 0) return rows;
    const db = getDb();
    const placeholders = rows.map(() => "?").join(", ");
    const links = db.prepare(
      `SELECT maintenance_id, monitor_id FROM maintenance_monitors WHERE maintenance_id IN (${placeholders})`
    ).all(...rows.map((r) => r.id));
    const map = {};
    for (const l of links) {
      if (!map[l.maintenance_id]) map[l.maintenance_id] = [];
      map[l.maintenance_id].push(l.monitor_id);
    }
    return rows.map((r) => ({ ...r, monitor_ids: map[r.id] || [] }));
  },

  _hydrate(rows) {
    return this._attachMonitorIds(rows.map((row) => {
      row.recurring = !!row.recurring;
      row.active = !!row.active;
      row.is_global = !!row.is_global;
      return row;
    }));
  },

  // is_global, not "has no links", marks an all-monitors window: a window that loses its links must match nothing.
  create(data) {
    const db = getDb();
    const id = generateId();
    const now = nowISO();
    const monitorIds = data.monitor_ids || [];
    db.transaction(() => {
      db.prepare(`
        INSERT INTO maintenance_windows (id, title, description, start_time, end_time, recurring, recurring_interval, cron_expression, active, is_global, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, data.title, data.description || "",
        data.start_time, data.end_time, data.recurring ? 1 : 0,
        data.recurring_interval || "", data.cron_expression || "",
        data.active !== false ? 1 : 0, monitorIds.length === 0 ? 1 : 0,
        data.created_by || null, now, now
      );
      for (const monitorId of monitorIds) this.addMonitor(id, monitorId);
    })();
    return this.findById(id);
  },

  findById(id) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM maintenance_windows WHERE id = ?").get(id);
    return row ? this._hydrate([row])[0] : null;
  },

  findAll({ status, monitor_id, limit, offset } = {}) {
    const db = getDb();
    let query = "SELECT * FROM maintenance_windows WHERE 1=1";
    const params = [];
    if (status === "active") {
      query += " AND active = 1";
    } else if (status === "inactive") {
      query += " AND active = 0";
    }
    if (monitor_id) {
      query += " AND id IN (SELECT maintenance_id FROM maintenance_monitors WHERE monitor_id = ?)";
      params.push(monitor_id);
    }
    query += " ORDER BY start_time DESC";
    if (limit) {
      query += " LIMIT ? OFFSET ?";
      params.push(limit, offset || 0);
    }
    return this._hydrate(db.prepare(query).all(...params));
  },

  findActiveForMonitor(monitorId) {
    return this.findOngoingForMonitors([monitorId]);
  },

  isMonitorInMaintenance(monitorId) {
    const windows = this.findActiveForMonitor(monitorId);
    return windows.length > 0;
  },

  // Returns the windows live right now that apply to any of the given monitors (or to all monitors when is_global).
  findOngoingForMonitors(monitorIds) {
    const db = getDb();
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    let scope = "is_global = 1";
    const params = [now, now];
    if (monitorIds && monitorIds.length > 0) {
      const placeholders = monitorIds.map(() => "?").join(", ");
      scope = `(is_global = 1 OR EXISTS (SELECT 1 FROM maintenance_monitors mm WHERE mm.maintenance_id = maintenance_windows.id AND mm.monitor_id IN (${placeholders})))`;
      params.push(...monitorIds);
    }

    // Recurring windows can be live on a later occurrence, so only one-off windows are pre-filtered by time
    const rows = db.prepare(`
      SELECT * FROM maintenance_windows
      WHERE active = 1
        AND (recurring = 1 OR (start_time <= ? AND end_time >= ?))
        AND ${scope}
      ORDER BY start_time ASC
    `).all(...params);
    return this._hydrate(rows).filter((w) => isLiveAt(w, nowMs));
  },

  // monitor_ids (when an array) replaces the links; an empty array makes the window global.
  update(id, data) {
    const db = getDb();
    const allowed = [
      "title", "description", "start_time", "end_time",
      "recurring", "recurring_interval", "cron_expression", "active",
    ];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(data)) {
      if (allowed.includes(key) && val !== undefined) {
        sets.push(`${key} = ?`);
        if (key === "recurring" || key === "active") {
          values.push(val ? 1 : 0);
        } else {
          values.push(val);
        }
      }
    }
    const monitorIds = Array.isArray(data.monitor_ids) ? data.monitor_ids : null;
    if (monitorIds) {
      sets.push("is_global = ?");
      values.push(monitorIds.length === 0 ? 1 : 0);
    }
    if (sets.length === 0) return this.findById(id);
    sets.push("updated_at = ?");
    values.push(nowISO());
    values.push(id);
    db.transaction(() => {
      if (monitorIds) {
        this.clearMonitors(id);
        for (const monitorId of monitorIds) this.addMonitor(id, monitorId);
      }
      db.prepare(`UPDATE maintenance_windows SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    })();
    return this.findById(id);
  },

  delete(id) {
    const db = getDb();
    db.prepare("DELETE FROM maintenance_windows WHERE id = ?").run(id);
  },

  count({ status, monitor_id } = {}) {
    const db = getDb();
    let query = "SELECT COUNT(*) as count FROM maintenance_windows WHERE 1=1";
    const params = [];
    if (status === "active") {
      query += " AND active = 1";
    } else if (status === "inactive") {
      query += " AND active = 0";
    }
    if (monitor_id) {
      query += " AND id IN (SELECT maintenance_id FROM maintenance_monitors WHERE monitor_id = ?)";
      params.push(monitor_id);
    }
    return db.prepare(query).get(...params).count;
  },

  addMonitor(maintenanceId, monitorId) {
    const db = getDb();
    db.prepare(
      "INSERT OR IGNORE INTO maintenance_monitors (maintenance_id, monitor_id) VALUES (?, ?)"
    ).run(maintenanceId, monitorId);
  },

  clearMonitors(maintenanceId) {
    const db = getDb();
    db.prepare("DELETE FROM maintenance_monitors WHERE maintenance_id = ?").run(maintenanceId);
  },
};

module.exports = Maintenance;
