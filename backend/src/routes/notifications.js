const express = require("express");
const router = express.Router();
const NotificationChannel = require("../models/notificationChannel");
const { authMiddleware } = require("../middleware/auth");
const { sanitizeString } = require("../utils/validators");
const telegram = require("../services/telegram");
const email = require("../services/email");
const webhook = require("../services/webhook");

// GET /api/notifications - List notification channels
router.get("/", authMiddleware, (req, res) => {
  const channels = NotificationChannel.findAll();
  res.json({ channels });
});

// GET /api/notifications/:id
router.get("/:id", authMiddleware, (req, res) => {
  const channel = NotificationChannel.findById(req.params.id);
  if (!channel) {
    return res.status(404).json({ error: "Notification channel not found" });
  }
  res.json({ channel });
});

// POST /api/notifications - Create notification channel
router.post("/", authMiddleware, (req, res) => {
  const { name, type, config, enabled } = req.body;

  if (!name || name.trim().length < 1) {
    return res.status(400).json({ error: "Name is required" });
  }

  const validTypes = ["telegram", "email", "webhook", "slack"];
  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({ error: `Type must be one of: ${validTypes.join(", ")}` });
  }

  if (!config || typeof config !== "object") {
    return res.status(400).json({ error: "Config object is required" });
  }

  // Validate type-specific config
  if (type === "telegram" && (!config.bot_token || !config.chat_id)) {
    return res.status(400).json({ error: "Telegram requires bot_token and chat_id" });
  }
  if (type === "email" && !config.recipients) {
    return res.status(400).json({ error: "Email requires recipients" });
  }
  if (type === "webhook" && !config.url) {
    return res.status(400).json({ error: "Webhook requires url" });
  }

  const channel = NotificationChannel.create({
    name: sanitizeString(name, 200),
    type,
    config,
    active: enabled !== false ? 1 : 0,
    created_by: req.user.id,
  });

  res.status(201).json({ channel });
});

// PUT /api/notifications/:id - Update notification channel
router.put("/:id", authMiddleware, (req, res) => {
  const channel = NotificationChannel.findById(req.params.id);
  if (!channel) {
    return res.status(404).json({ error: "Notification channel not found" });
  }

  const updates = {};
  if (req.body.name) updates.name = sanitizeString(req.body.name, 200);
  if (req.body.config) updates.config = JSON.stringify(req.body.config);
  if (req.body.enabled !== undefined) updates.active = req.body.enabled ? 1 : 0;

  const updated = NotificationChannel.update(req.params.id, updates);
  if (updated.config && typeof updated.config === "string") {
    updated.config = JSON.parse(updated.config);
  }
  res.json({ channel: updated });
});

// DELETE /api/notifications/:id
router.delete("/:id", authMiddleware, (req, res) => {
  const channel = NotificationChannel.findById(req.params.id);
  if (!channel) {
    return res.status(404).json({ error: "Notification channel not found" });
  }

  NotificationChannel.delete(req.params.id);
  res.json({ message: "Notification channel deleted" });
});

// POST /api/notifications/:id/test - Test notification channel
router.post("/:id/test", authMiddleware, async (req, res) => {
  const channel = NotificationChannel.findById(req.params.id);
  if (!channel) {
    return res.status(404).json({ error: "Notification channel not found" });
  }

  const config = typeof channel.config === "string" ? JSON.parse(channel.config) : channel.config;
  const testPayload = {
    event: "test",
    monitor: { name: "Test Monitor", url: "https://example.com" },
    message: "This is a test notification from Status One.",
    timestamp: new Date().toISOString(),
  };

  try {
    switch (channel.type) {
      case "telegram":
        await telegram.send(config.bot_token, config.chat_id, "🔔 *Test Notification*\nThis is a test from Status One. Your notification channel is working!");
        break;
      case "email":
        await email.sendNotification(config, {
          type: "test",
          message: "This is a test from Status One. Your email notification channel is working!",
          timestamp: new Date().toISOString(),
        });
        break;
      case "webhook":
        await webhook.send(config.url, testPayload, {
          method: config.method || "POST",
          headers: config.headers || {},
          secret: config.secret || null,
        });
        break;
      default:
        return res.status(400).json({ error: `Unsupported channel type: ${channel.type}` });
    }

    res.json({ message: "Test notification sent successfully" });
  } catch (err) {
    res.status(500).json({ error: `Failed to send test notification: ${err.message}` });
  }
});

module.exports = router;
