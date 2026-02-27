const express = require("express");
const router = express.Router();
const { getDb } = require("../database/connection");
const { generateId } = require("../utils/helpers");
const { authMiddleware } = require("../middleware/auth");
const { sanitizeString } = require("../utils/validators");

// GET /api/tags - List all tags
router.get("/", authMiddleware, (req, res) => {
  const db = getDb();
  const tags = db.prepare("SELECT * FROM tags ORDER BY name ASC").all();
  res.json({ tags });
});

// POST /api/tags - Create tag
router.post("/", authMiddleware, (req, res) => {
  const { name, color } = req.body;

  if (!name || name.trim().length < 1) {
    return res.status(400).json({ error: "Tag name is required" });
  }

  const db = getDb();
  const id = generateId();

  try {
    db.prepare(
      "INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(id, sanitizeString(name, 50), color || "#6366f1");

    const tag = db.prepare("SELECT * FROM tags WHERE id = ?").get(id);
    res.status(201).json({ tag });
  } catch (err) {
    if (err.message?.includes("UNIQUE")) {
      return res.status(409).json({ error: "Tag name already exists" });
    }
    throw err;
  }
});

// PUT /api/tags/:id - Update tag
router.put("/:id", authMiddleware, (req, res) => {
  const db = getDb();
  const tag = db.prepare("SELECT * FROM tags WHERE id = ?").get(req.params.id);
  if (!tag) {
    return res.status(404).json({ error: "Tag not found" });
  }

  const { name, color } = req.body;
  const sets = [];
  const values = [];

  if (name) {
    sets.push("name = ?");
    values.push(sanitizeString(name, 50));
  }
  if (color) {
    sets.push("color = ?");
    values.push(color);
  }

  if (sets.length > 0) {
    values.push(req.params.id);
    db.prepare(`UPDATE tags SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  const updated = db.prepare("SELECT * FROM tags WHERE id = ?").get(req.params.id);
  res.json({ tag: updated });
});

// DELETE /api/tags/:id - Delete tag
router.delete("/:id", authMiddleware, (req, res) => {
  const db = getDb();
  const tag = db.prepare("SELECT * FROM tags WHERE id = ?").get(req.params.id);
  if (!tag) {
    return res.status(404).json({ error: "Tag not found" });
  }

  db.prepare("DELETE FROM tags WHERE id = ?").run(req.params.id);
  res.json({ message: "Tag deleted" });
});

module.exports = router;
