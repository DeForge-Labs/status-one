const express = require("express");
const router = express.Router();
const ApiKey = require("../models/apiKey");
const { authMiddleware } = require("../middleware/auth");
const { sanitizeString } = require("../utils/validators");

// GET /api/api-keys - List all API keys (masked)
router.get("/", authMiddleware, (req, res) => {
  const keys = ApiKey.findAll();
  res.json({
    apiKeys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      permissions: k.permissions ? JSON.parse(k.permissions) : [],
      expires_at: k.expires_at,
      last_used_at: k.last_used_at,
      created_at: k.created_at,
    })),
  });
});

// POST /api/api-keys - Create new API key
router.post("/", authMiddleware, (req, res) => {
  const { name, permissions, expires_at } = req.body;

  if (!name || name.trim().length < 1) {
    return res.status(400).json({ error: "Name is required" });
  }

  const validPermissions = ["read", "write", "monitors", "incidents", "status_pages"];
  const perms = permissions || ["read"];
  for (const p of perms) {
    if (!validPermissions.includes(p)) {
      return res.status(400).json({ error: `Invalid permission: ${p}. Valid: ${validPermissions.join(", ")}` });
    }
  }

  const result = ApiKey.create({
    name: sanitizeString(name, 200),
    permissions: JSON.stringify(perms),
    expires_at: expires_at || null,
    created_by: req.user.id,
  });

  // Return the raw key ONLY on creation
  res.status(201).json({
    apiKey: {
      id: result.id,
      name: result.name,
      key: result.rawKey,
      prefix: result.prefix,
      permissions: perms,
      expires_at: result.expires_at,
      created_at: result.created_at,
    },
    warning: "Store this key securely. It will not be shown again.",
  });
});

// DELETE /api/api-keys/:id
router.delete("/:id", authMiddleware, (req, res) => {
  const key = ApiKey.findById(req.params.id);
  if (!key) {
    return res.status(404).json({ error: "API key not found" });
  }

  ApiKey.delete(req.params.id);
  res.json({ message: "API key deleted" });
});

module.exports = router;
