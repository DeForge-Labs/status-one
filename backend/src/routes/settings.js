const express = require("express");
const router = express.Router();
const Settings = require("../models/settings");
const { authMiddleware } = require("../middleware/auth");

// GET /api/settings - Get all settings
router.get("/", authMiddleware, (req, res) => {
  const settings = Settings.getAll();
  res.json({ settings });
});

// GET /api/settings/:key - Get single setting
router.get("/:key", authMiddleware, (req, res) => {
  const value = Settings.get(req.params.key);
  if (value === null || value === undefined) {
    return res.status(404).json({ error: "Setting not found" });
  }
  res.json({ key: req.params.key, value });
});

// PUT /api/settings - Bulk update settings
router.put("/", authMiddleware, (req, res) => {
  const { settings } = req.body;

  if (!settings || typeof settings !== "object") {
    return res.status(400).json({ error: "Settings object is required" });
  }

  // Protected settings that can't be changed via API
  const protected_keys = ["schema_version"];

  const updated = {};
  for (const [key, value] of Object.entries(settings)) {
    if (protected_keys.includes(key)) continue;
    Settings.set(key, String(value));
    updated[key] = String(value);
  }

  res.json({ settings: updated });
});

// PUT /api/settings/:key - Update single setting
router.put("/:key", authMiddleware, (req, res) => {
  const { value } = req.body;
  if (value === undefined) {
    return res.status(400).json({ error: "Value is required" });
  }

  const protected_keys = ["schema_version"];
  if (protected_keys.includes(req.params.key)) {
    return res.status(403).json({ error: "Cannot modify this setting" });
  }

  Settings.set(req.params.key, String(value));
  res.json({ key: req.params.key, value: String(value) });
});

// DELETE /api/settings/:key - Remove a setting
router.delete("/:key", authMiddleware, (req, res) => {
  const protected_keys = ["schema_version", "app_name"];
  if (protected_keys.includes(req.params.key)) {
    return res.status(403).json({ error: "Cannot delete this setting" });
  }

  Settings.delete(req.params.key);
  res.json({ message: "Setting deleted" });
});

module.exports = router;
