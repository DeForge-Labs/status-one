const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");

const Maintenance = {
  create(data) {
    const db = getDb();
    const id = generateId();
    const now = nowISO();
    db.prepare(`
      INSERT INTO maintenance_windows (id, monitor_id, title, description, start_time, end_time, recurring, cron_expression, active, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.monitor_id || null, data.title, data.description || "",
      data.start_time, data.end_time, data.recurring ? 1 : 0,
      data.cron_expression || "", data.active !== false ? 1 : 0,
      data.created_by || null, now, now
    );
    return this.findById(id);
  },

  findById(id) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM maintenance_windows WHERE id = ?").get(id);
    if (row) {
      row.recurring = !!row.recurring;
      row.active = !!row.active;
    }
    return row;
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
      query += " AND monitor_id = ?";
      params.push(monitor_id);
    }
    query += " ORDER BY start_time DESC";
    if (limit) {
      query += " LIMIT ? OFFSET ?";
      params.push(limit, offset || 0);
    }
    return db.prepare(query).all(...params).map((row) => {
      row.recurring = !!row.recurring;
      row.active = !!row.active;
      return row;
    });
  },

  findActiveForMonitor(monitorId) {
    const db = getDb();
    const now = nowISO();
    return db.prepare(`
      SELECT * FROM maintenance_windows
      WHERE active = 1
        AND start_time <= ?
        AND end_time >= ?
        AND (monitor_id IS NULL OR monitor_id = ?)
    `).all(now, now, monitorId).map((row) => {
      row.recurring = !!row.recurring;
      row.active = !!row.active;
      return row;
    });
  },

  isMonitorInMaintenance(monitorId) {
    const windows = this.findActiveForMonitor(monitorId);
    return windows.length > 0;
  },

  update(id, data) {
    const db = getDb();
    const allowed = [
      "monitor_id", "title", "description", "start_time", "end_time",
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
      query += " AND monitor_id = ?";
      params.push(monitor_id);
    }
    return db.prepare(query).get(...params).count;
  },

  addMonitor(maintenanceId, monitorId) {
    const db = getDb();
    // For now, maintenance_windows supports a single monitor_id column.
    // To support multiple monitors, update the record or use a join table.
    // Using simple approach: update the monitor_id if single monitor, 
    // or we can store comma-separated. Let's keep it simple:
    db.prepare("UPDATE maintenance_windows SET monitor_id = ? WHERE id = ?").run(monitorId, maintenanceId);
  },

  clearMonitors(maintenanceId) {
    const db = getDb();
    db.prepare("UPDATE maintenance_windows SET monitor_id = NULL WHERE id = ?").run(maintenanceId);
  },
};

module.exports = Maintenance;
