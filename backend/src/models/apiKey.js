const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");
const { generateApiKey, hashApiKey } = require("../utils/crypto");

// permissions is stored as JSON text; callers always see an array
function withPermissions(row) {
  if (!row) return row;
  let permissions = [];
  try {
    permissions = JSON.parse(row.permissions) || [];
  } catch {}
  return { ...row, permissions };
}

const ApiKey = {
  create({ name, created_by, expires_at, permissions = ["read"] }) {
    const db = getDb();
    const { key, prefix, keyHash } = generateApiKey();
    const id = generateId();
    const created_at = nowISO();
    db.prepare(`
      INSERT INTO api_keys (id, name, key_hash, prefix, created_by, expires_at, created_at, permissions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, keyHash, prefix, created_by, expires_at || null, created_at, JSON.stringify(permissions));
    // Return the key only once
    return { id, name, prefix, key, permissions, expires_at: expires_at || null, created_at };
  },

  findById(id) {
    const db = getDb();
    return withPermissions(
      db.prepare("SELECT id, name, prefix, permissions, last_used, created_by, expires_at, created_at FROM api_keys WHERE id = ?").get(id)
    );
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
    return withPermissions(row);
  },

  findAll() {
    const db = getDb();
    return db.prepare(
      "SELECT id, name, prefix, permissions, last_used, created_by, expires_at, created_at FROM api_keys ORDER BY created_at DESC"
    ).all().map(withPermissions);
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
