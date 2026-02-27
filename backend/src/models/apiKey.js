const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");
const { generateApiKey, hashApiKey } = require("../utils/crypto");

const ApiKey = {
  create({ name, created_by, expires_at }) {
    const db = getDb();
    const { key, prefix, keyHash } = generateApiKey();
    const id = generateId();
    db.prepare(`
      INSERT INTO api_keys (id, name, key_hash, prefix, created_by, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, keyHash, prefix, created_by, expires_at || null, nowISO());
    // Return the key only once
    return { id, name, prefix, key, expires_at, created_at: nowISO() };
  },

  findById(id) {
    const db = getDb();
    return db.prepare("SELECT id, name, prefix, last_used, created_by, expires_at, created_at FROM api_keys WHERE id = ?").get(id);
  },

  findByKey(key) {
    const db = getDb();
    const keyHash = hashApiKey(key);
    const row = db.prepare("SELECT * FROM api_keys WHERE key_hash = ?").get(keyHash);
    if (row && row.expires_at) {
      const now = new Date();
      const expires = new Date(row.expires_at);
      if (now > expires) return null;
    }
    return row;
  },

  findAll() {
    const db = getDb();
    return db.prepare(
      "SELECT id, name, prefix, last_used, created_by, expires_at, created_at FROM api_keys ORDER BY created_at DESC"
    ).all();
  },

  updateLastUsed(id) {
    const db = getDb();
    db.prepare("UPDATE api_keys SET last_used = ? WHERE id = ?").run(nowISO(), id);
  },

  delete(id) {
    const db = getDb();
    db.prepare("DELETE FROM api_keys WHERE id = ?").run(id);
  },
};

module.exports = ApiKey;
