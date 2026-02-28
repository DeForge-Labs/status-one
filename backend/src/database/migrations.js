const { getDb } = require("./connection");
const logger = require("../utils/logger");

const SCHEMA_VERSION = 2;

function runMigrations() {
  const db = getDb();

  // Create migrations tracking table
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const currentVersion =
    db.query("SELECT MAX(version) as v FROM schema_version").get()?.v || 0;

  if (currentVersion < 1) {
    logger.info("Running migration v1: initial schema");
    migrateV1(db);
    db.run("INSERT INTO schema_version (version) VALUES (1)");
  }

  if (currentVersion < 2) {
    logger.info("Running migration v2: telegram subscribers");
    migrateV2(db);
    db.run("INSERT INTO schema_version (version) VALUES (2)");
  }

  logger.info(`Database schema at version ${SCHEMA_VERSION}`);
}

function migrateV2(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS telegram_subscribers (
      id TEXT PRIMARY KEY,
      notification_channel_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      username TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (notification_channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE,
      UNIQUE(notification_channel_id, chat_id)
    )
  `);
}

function migrateV1(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'http',
      url TEXT,
      method TEXT DEFAULT 'GET',
      headers TEXT DEFAULT '{}',
      body TEXT DEFAULT '',
      interval_seconds INTEGER DEFAULT 60,
      timeout_ms INTEGER DEFAULT 10000,
      retries INTEGER DEFAULT 3,
      retry_interval_seconds INTEGER DEFAULT 10,
      expected_status INTEGER DEFAULT 200,
      keyword TEXT DEFAULT '',
      keyword_type TEXT DEFAULT 'contains',
      degraded_threshold_ms INTEGER DEFAULT 2000,
      hostname TEXT DEFAULT '',
      port INTEGER DEFAULT 0,
      dns_record_type TEXT DEFAULT 'A',
      push_token TEXT DEFAULT '',
      push_interval_seconds INTEGER DEFAULT 60,
      ssl_warn_days INTEGER DEFAULT 30,
      active INTEGER DEFAULT 1,
      accepted_status_codes TEXT DEFAULT '200-299',
      max_redirects INTEGER DEFAULT 5,
      auth_method TEXT DEFAULT 'none',
      auth_user TEXT DEFAULT '',
      auth_pass TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS monitor_checks (
      id TEXT PRIMARY KEY,
      monitor_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'up',
      response_time_ms INTEGER DEFAULT 0,
      status_code INTEGER DEFAULT 0,
      error_message TEXT DEFAULT '',
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS monitor_daily_stats (
      id TEXT PRIMARY KEY,
      monitor_id TEXT NOT NULL,
      date TEXT NOT NULL,
      total_checks INTEGER DEFAULT 0,
      up_count INTEGER DEFAULT 0,
      down_count INTEGER DEFAULT 0,
      degraded_count INTEGER DEFAULT 0,
      avg_response_time REAL DEFAULT 0,
      min_response_time INTEGER DEFAULT 0,
      max_response_time INTEGER DEFAULT 0,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
      UNIQUE(monitor_id, date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      monitor_id TEXT,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'auto',
      status TEXT DEFAULT 'investigating',
      started_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS incident_updates (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_pages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      custom_css TEXT DEFAULT '',
      theme TEXT DEFAULT 'light',
      published INTEGER DEFAULT 0,
      show_values INTEGER DEFAULT 1,
      header_text TEXT DEFAULT '',
      footer_text TEXT DEFAULT '',
      custom_domain TEXT DEFAULT '',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_page_monitors (
      id TEXT PRIMARY KEY,
      status_page_id TEXT NOT NULL,
      monitor_id TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (status_page_id) REFERENCES status_pages(id) ON DELETE CASCADE,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
      UNIQUE(status_page_id, monitor_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_page_messages (
      id TEXT PRIMARY KEY,
      status_page_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      type TEXT DEFAULT 'info',
      pinned INTEGER DEFAULT 0,
      published INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (status_page_id) REFERENCES status_pages(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notification_channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS monitor_notifications (
      monitor_id TEXT NOT NULL,
      notification_channel_id TEXT NOT NULL,
      PRIMARY KEY (monitor_id, notification_channel_id),
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
      FOREIGN KEY (notification_channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS maintenance_windows (
      id TEXT PRIMARY KEY,
      monitor_id TEXT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      recurring INTEGER DEFAULT 0,
      cron_expression TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT UNIQUE NOT NULL,
      prefix TEXT NOT NULL,
      last_used TEXT,
      created_by TEXT,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS monitor_tags (
      monitor_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (monitor_id, tag_id),
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // Indexes for query performance
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor_created ON monitor_checks(monitor_id, created_at)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_monitor_checks_created ON monitor_checks(created_at)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_monitor_daily_stats_monitor_date ON monitor_daily_stats(monitor_id, date)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_incidents_monitor_status ON incidents(monitor_id, status)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_status_pages_slug ON status_pages(slug)"
  );
  db.run(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_status_pages_custom_domain ON status_pages(custom_domain) WHERE custom_domain != ''"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_maintenance_windows_time ON maintenance_windows(start_time, end_time)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_monitor_checks_status ON monitor_checks(monitor_id, status)"
  );
}

function resetDatabase() {
  const db = getDb();
  const tables = db
    .query("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'")
    .all()
    .map((t) => t.name);

  db.run("PRAGMA foreign_keys = OFF");
  for (const table of tables) {
    db.run(`DROP TABLE IF EXISTS "${table}"`);
  }
  db.run("PRAGMA foreign_keys = ON");

  runMigrations();
  seedDefaults();
}

function seedDefaults() {
  const db = getDb();

  const defaults = {
    app_name: "Status One",
    app_url: "http://localhost:3000",
    data_retention_days: "90",
    stats_retention_days: "365",
    default_check_interval: "60",
    default_timeout: "10000",
    default_retries: "3",
    aggregation_cron: "0 * * * *",
    retention_cron: "0 2 * * *",
  };

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  for (const [key, value] of Object.entries(defaults)) {
    stmt.run(key, value);
  }
}

module.exports = { runMigrations, resetDatabase, seedDefaults };
