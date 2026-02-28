const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");

const NotificationChannel = {
  create({ name, type, config, active, created_by }) {
    const db = getDb();
    const id = generateId();
    const now = nowISO();
    db.prepare(`
      INSERT INTO notification_channels (id, name, type, config, active, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, type, JSON.stringify(config || {}), active !== undefined ? (active ? 1 : 0) : 1, created_by || null, now, now);
    return this.findById(id);
  },

  findById(id) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM notification_channels WHERE id = ?").get(id);
    if (row) {
      row.config = JSON.parse(row.config || "{}");
      row.active = !!row.active;
    }
    return row;
  },

  findAll() {
    const db = getDb();
    return db.prepare("SELECT * FROM notification_channels ORDER BY created_at DESC").all().map((row) => {
      row.config = JSON.parse(row.config || "{}");
      row.active = !!row.active;
      return row;
    });
  },

  update(id, data) {
    const db = getDb();
    const allowed = ["name", "type", "config", "active"];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(data)) {
      if (allowed.includes(key) && val !== undefined) {
        sets.push(`${key} = ?`);
        if (key === "config") {
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
    db.prepare(`UPDATE notification_channels SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete(id) {
    const db = getDb();
    db.prepare("DELETE FROM notification_channels WHERE id = ?").run(id);
  },
};

module.exports = NotificationChannel;
