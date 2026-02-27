const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");

const Incident = {
  create({ monitor_id, title, type, status, created_by }) {
    const db = getDb();
    const id = generateId();
    const now = nowISO();
    db.prepare(`
      INSERT INTO incidents (id, monitor_id, title, type, status, started_at, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, monitor_id || null, title, type || "auto", status || "investigating", now, created_by || null, now, now);
    return this.findById(id);
  },

  findById(id) {
    const db = getDb();
    return db.prepare("SELECT * FROM incidents WHERE id = ?").get(id);
  },

  findAll({ status, monitor_id, limit = 50, offset = 0 } = {}) {
    const db = getDb();
    let query = "SELECT * FROM incidents WHERE 1=1";
    const params = [];
    if (status) {
      query += " AND status = ?";
      params.push(status);
    }
    if (monitor_id) {
      query += " AND monitor_id = ?";
      params.push(monitor_id);
    }
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    return db.prepare(query).all(...params);
  },

  count({ status, monitor_id } = {}) {
    const db = getDb();
    let query = "SELECT COUNT(*) as count FROM incidents WHERE 1=1";
    const params = [];
    if (status) {
      query += " AND status = ?";
      params.push(status);
    }
    if (monitor_id) {
      query += " AND monitor_id = ?";
      params.push(monitor_id);
    }
    return db.prepare(query).get(...params).count;
  },

  findActiveByMonitorId(monitorId) {
    const db = getDb();
    return db.prepare(
      "SELECT * FROM incidents WHERE monitor_id = ? AND status != 'resolved' ORDER BY created_at DESC LIMIT 1"
    ).get(monitorId);
  },

  update(id, fields) {
    const db = getDb();
    const allowed = ["title", "status", "resolved_at"];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key) && val !== undefined) {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (sets.length === 0) return this.findById(id);
    sets.push("updated_at = ?");
    values.push(nowISO());
    values.push(id);
    db.prepare(`UPDATE incidents SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  resolve(id) {
    const now = nowISO();
    return this.update(id, { status: "resolved", resolved_at: now });
  },

  delete(id) {
    const db = getDb();
    db.prepare("DELETE FROM incidents WHERE id = ?").run(id);
  },

  // Incident Updates
  addUpdate({ incident_id, status, message, created_by }) {
    const db = getDb();
    const id = generateId();
    db.prepare(`
      INSERT INTO incident_updates (id, incident_id, status, message, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, incident_id, status, message, created_by || null, nowISO());

    // Also update the incident status
    this.update(incident_id, { status });

    return db.prepare("SELECT * FROM incident_updates WHERE id = ?").get(id);
  },

  getUpdates(incidentId) {
    const db = getDb();
    return db.prepare(
      "SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC"
    ).all(incidentId);
  },

  countActive() {
    const db = getDb();
    return db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status != 'resolved'").get().count;
  },

  getForMonitorIds(monitorIds, { limit = 20, offset = 0 } = {}) {
    if (!monitorIds.length) return [];
    const db = getDb();
    const placeholders = monitorIds.map(() => "?").join(",");
    return db.prepare(`
      SELECT * FROM incidents 
      WHERE monitor_id IN (${placeholders})
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...monitorIds, limit, offset);
  },
};

module.exports = Incident;
