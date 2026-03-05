const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");

const Maintenance = {
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

  create(data) {
    const db = getDb();
    const id = generateId();
    const now = nowISO();
    db.prepare(`
      INSERT INTO maintenance_windows (id, title, description, start_time, end_time, recurring, cron_expression, active, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.title, data.description || "",
      data.start_time, data.end_time, data.recurring ? 1 : 0,
      data.cron_expression || "", data.active !== false ? 1 : 0,
      data.created_by || null, now, now
    );
    return this.findById(id);
  },

  findById(id) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM maintenance_windows WHERE id = ?").get(id);
    if (!row) return null;
    row.recurring = !!row.recurring;
    row.active = !!row.active;
    const [enriched] = this._attachMonitorIds([row]);
    return enriched;
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
    const rows = db.prepare(query).all(...params).map((row) => {
      row.recurring = !!row.recurring;
      row.active = !!row.active;
      return row;
    });
    return this._attachMonitorIds(rows);
  },

  findActiveForMonitor(monitorId) {
    const db = getDb();
    const now = nowISO();
    const rows = db.prepare(`
      SELECT * FROM maintenance_windows
      WHERE active = 1
        AND start_time <= ?
        AND end_time >= ?
        AND (
          NOT EXISTS (SELECT 1 FROM maintenance_monitors mm WHERE mm.maintenance_id = maintenance_windows.id)
          OR EXISTS (SELECT 1 FROM maintenance_monitors mm WHERE mm.maintenance_id = maintenance_windows.id AND mm.monitor_id = ?)
        )
    `).all(now, now, monitorId).map((row) => {
      row.recurring = !!row.recurring;
      row.active = !!row.active;
      return row;
    });
    return this._attachMonitorIds(rows);
  },

  isMonitorInMaintenance(monitorId) {
    const windows = this.findActiveForMonitor(monitorId);
    return windows.length > 0;
  },

  // Returns all currently-running maintenance windows relevant to a list of monitor IDs.
  // Includes global windows (no rows in maintenance_monitors) and windows targeting any of the given IDs.
  findOngoingForMonitors(monitorIds) {
    const db = getDb();
    const now = nowISO();
    let whereClause;
    let params = [now, now];

    if (!monitorIds || monitorIds.length === 0) {
      whereClause = `NOT EXISTS (SELECT 1 FROM maintenance_monitors mm WHERE mm.maintenance_id = maintenance_windows.id)`;
    } else {
      const placeholders = monitorIds.map(() => "?").join(", ");
      whereClause = `(
          NOT EXISTS (SELECT 1 FROM maintenance_monitors mm WHERE mm.maintenance_id = maintenance_windows.id)
          OR EXISTS (SELECT 1 FROM maintenance_monitors mm WHERE mm.maintenance_id = maintenance_windows.id AND mm.monitor_id IN (${placeholders}))
        )`;
      params = params.concat(monitorIds);
    }

    const rows = db.prepare(`
      SELECT * FROM maintenance_windows
      WHERE active = 1
        AND start_time <= ?
        AND end_time >= ?
        AND ${whereClause}
      ORDER BY start_time ASC
    `).all(...params).map((row) => {
      row.recurring = !!row.recurring;
      row.active = !!row.active;
      return row;
    });
    return this._attachMonitorIds(rows);
  },

  update(id, data) {
    const db = getDb();
    const allowed = [
      "title", "description", "start_time", "end_time",
      "recurring", "cron_expression", "active",
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
    if (sets.length === 0) return this.findById(id);
    sets.push("updated_at = ?");
    values.push(nowISO());
    values.push(id);
    db.prepare(`UPDATE maintenance_windows SET ${sets.join(", ")} WHERE id = ?`).run(...values);
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
