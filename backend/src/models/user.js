const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");

const User = {
  create({ email, password_hash, name }) {
    const db = getDb();
    const id = generateId();
    const now = nowISO();
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, email.toLowerCase().trim(), password_hash, name.trim(), now, now);
    return this.findById(id);
  },

  findById(id) {
    const db = getDb();
    return db
      .prepare("SELECT id, email, name, created_at, updated_at FROM users WHERE id = ?")
      .get(id);
  },

  findByEmail(email) {
    const db = getDb();
    return db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email.toLowerCase().trim());
  },

  findAll() {
    const db = getDb();
    return db
      .prepare("SELECT id, email, name, created_at, updated_at FROM users ORDER BY created_at")
      .all();
  },

  count() {
    const db = getDb();
    return db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  },

  update(id, fields) {
    const db = getDb();
    const allowed = ["email", "name", "password_hash"];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key) && val !== undefined) {
        sets.push(`${key} = ?`);
        values.push(key === "email" ? val.toLowerCase().trim() : val);
      }
    }
    if (sets.length === 0) return this.findById(id);
    sets.push("updated_at = ?");
    values.push(nowISO());
    values.push(id);
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete(id) {
    const db = getDb();
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
  },
};

module.exports = User;
