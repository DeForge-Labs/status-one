const { getDb } = require("./connection");
const logger = require("../utils/logger");

function seedDefaults() {
  const db = getDb();

  const defaults = {
    app_name: "Status One",
    check_timeout: "10000",
    default_interval: "60",
    max_retries: "3",
    data_retention_days: "90",
    stats_retention_days: "365",
    incident_auto_resolve: "true",
  };

  for (const [key, value] of Object.entries(defaults)) {
    const existing = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    if (!existing) {
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, value);
      logger.debug(`Seeded setting: ${key} = ${value}`);
    }
  }
}

module.exports = { seedDefaults };
