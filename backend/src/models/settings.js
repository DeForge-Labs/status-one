const { getDb } = require("../database/connection");

const Settings = {
  get(key) {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    return row ? row.value : null;
  },

  set(key, value) {
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, String(value));
  },

  getAll() {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM settings").all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  },

  setMany(obj) {
    const db = getDb();
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    for (const [key, value] of Object.entries(obj)) {
      stmt.run(key, String(value));
    }
  },

  delete(key) {
    const db = getDb();
    db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  },
};

module.exports = Settings;
