const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");

const StatusPage = {
  create(data) {
    const db = getDb();
    const id = generateId();
    const now = nowISO();
    db.prepare(`
      INSERT INTO status_pages (id, name, slug, description, logo_url, custom_css, theme, published, show_values, header_text, footer_text, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.name, data.slug, data.description || "", data.logo_url || "",
      data.custom_css || "", data.theme || "light", data.published ? 1 : 0,
      data.show_values !== false ? 1 : 0, data.header_text || "", data.footer_text || "",
      data.created_by || null, now, now
    );
    return this.findById(id);
  },

  findById(id) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM status_pages WHERE id = ?").get(id);
    if (row) {
      row.published = !!row.published;
      row.show_values = !!row.show_values;
    }
    return row;
  },

  findBySlug(slug) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM status_pages WHERE slug = ?").get(slug);
    if (row) {
      row.published = !!row.published;
      row.show_values = !!row.show_values;
    }
    return row;
  },

  findAll() {
    const db = getDb();
    return db.prepare("SELECT * FROM status_pages ORDER BY created_at DESC").all().map((row) => {
      row.published = !!row.published;
      row.show_values = !!row.show_values;
      return row;
    });
  },

  update(id, data) {
    const db = getDb();
    const allowed = [
      "name", "slug", "description", "logo_url", "custom_css", "theme",
      "published", "show_values", "header_text", "footer_text",
    ];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(data)) {
      if (allowed.includes(key) && val !== undefined) {
        sets.push(`${key} = ?`);
        if (key === "published" || key === "show_values") {
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
    db.prepare(`UPDATE status_pages SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete(id) {
    const db = getDb();
    db.prepare("DELETE FROM status_pages WHERE id = ?").run(id);
  },

  // Monitor assignments
  getMonitors(statusPageId) {
    const db = getDb();
    return db.prepare(`
      SELECT spm.*, m.name as monitor_name, m.type as monitor_type, m.url as monitor_url, m.active as monitor_active
      FROM status_page_monitors spm
      INNER JOIN monitors m ON m.id = spm.monitor_id
      WHERE spm.status_page_id = ?
      ORDER BY spm.sort_order ASC
    `).all(statusPageId);
  },

  addMonitor(statusPageId, monitorId, displayName, sortOrder) {
    const db = getDb();
    const id = generateId();
    db.prepare(
      "INSERT OR IGNORE INTO status_page_monitors (id, status_page_id, monitor_id, display_name, sort_order) VALUES (?, ?, ?, ?, ?)"
    ).run(id, statusPageId, monitorId, displayName || "", sortOrder || 0);
  },

  removeMonitor(statusPageId, monitorId) {
    const db = getDb();
    db.prepare(
      "DELETE FROM status_page_monitors WHERE status_page_id = ? AND monitor_id = ?"
    ).run(statusPageId, monitorId);
  },

  updateMonitorOrder(statusPageId, monitorId, sortOrder) {
    const db = getDb();
    db.prepare(
      "UPDATE status_page_monitors SET sort_order = ? WHERE status_page_id = ? AND monitor_id = ?"
    ).run(sortOrder, statusPageId, monitorId);
  },

  // Messages
  getMessages(statusPageId, { published, limit = 50, offset = 0 } = {}) {
    const db = getDb();
    let query = "SELECT * FROM status_page_messages WHERE status_page_id = ?";
    const params = [statusPageId];
    if (published !== undefined) {
      query += " AND published = ?";
      params.push(published ? 1 : 0);
    }
    query += " ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    return db.prepare(query).all(...params).map((row) => {
      row.pinned = !!row.pinned;
      row.published = !!row.published;
      return row;
    });
  },

  createMessage(data) {
    const db = getDb();
    const id = generateId();
    const now = nowISO();
    db.prepare(`
      INSERT INTO status_page_messages (id, status_page_id, title, body, type, pinned, published, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.status_page_id, data.title, data.body || "",
      data.type || "info", data.pinned ? 1 : 0, data.published !== false ? 1 : 0,
      data.created_by || null, now, now
    );
    return db.prepare("SELECT * FROM status_page_messages WHERE id = ?").get(id);
  },

  updateMessage(id, data) {
    const db = getDb();
    const allowed = ["title", "body", "type", "pinned", "published"];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(data)) {
      if (allowed.includes(key) && val !== undefined) {
        sets.push(`${key} = ?`);
        if (key === "pinned" || key === "published") {
          values.push(val ? 1 : 0);
        } else {
          values.push(val);
        }
      }
    }
    if (sets.length === 0) return;
    sets.push("updated_at = ?");
    values.push(nowISO());
    values.push(id);
    db.prepare(`UPDATE status_page_messages SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return db.prepare("SELECT * FROM status_page_messages WHERE id = ?").get(id);
  },

  deleteMessage(id) {
    const db = getDb();
    db.prepare("DELETE FROM status_page_messages WHERE id = ?").run(id);
  },

  getMonitorIds(statusPageId) {
    const db = getDb();
    return db.prepare(
      "SELECT monitor_id FROM status_page_monitors WHERE status_page_id = ?"
    ).all(statusPageId).map((r) => r.monitor_id);
  },
};

module.exports = StatusPage;
