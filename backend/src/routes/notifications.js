const express = require("express");
const router = express.Router();
const NotificationChannel = require("../models/notificationChannel");
const { authMiddleware } = require("../middleware/auth");
const { sanitizeString } = require("../utils/validators");
const telegram = require("../services/telegram");
const email = require("../services/email");
const webhook = require("../services/webhook");
const discord = require("../services/discord");
const Settings = require("../models/settings");

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
router.post("/", authMiddleware, async (req, res) => {
  const { name, type, config, enabled } = req.body;

  if (!name || name.trim().length < 1) {
    return res.status(400).json({ error: "Name is required" });
  }

  const validTypes = ["telegram", "email", "webhook", "slack", "discord"];
  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({ error: `Type must be one of: ${validTypes.join(", ")}` });
  }

  if (!config || typeof config !== "object") {
    return res.status(400).json({ error: "Config object is required" });
  }

  // Validate type-specific config
  if (type === "telegram" && !config.bot_token) {
    return res.status(400).json({ error: "Telegram requires bot_token" });
  }
  if (type === "telegram" && !config.webhook_secret) {
    return res.status(400).json({ error: "Telegram requires webhook_secret (used to secure the bot webhook endpoint)" });
  }
  if (type === "email" && !config.recipients) {
    return res.status(400).json({ error: "Email requires recipients" });
  }
  if (type === "webhook" && !config.url) {
    return res.status(400).json({ error: "Webhook requires url" });
  }
  if (type === "slack" && !config.webhook_url) {
    return res.status(400).json({ error: "Slack requires webhook_url" });
  }
  if (type === "discord" && !config.webhook_url) {
    return res.status(400).json({ error: "Discord requires webhook_url" });
  }

  const channel = NotificationChannel.create({
    name: sanitizeString(name, 200),
    type,
    config,
    active: enabled !== false ? 1 : 0,
    created_by: req.user.id,
  });

  // Register the Telegram bot webhook immediately after channel creation
  if (type === "telegram") {
    const appUrl = Settings.get("app_url");
    if (!appUrl) {
      NotificationChannel.delete(channel.id);
      return res.status(400).json({ error: "app_url is not configured. Set it in Settings before creating a Telegram channel." });
    }
    const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook/${channel.id}`;
    try {
      await telegram.registerWebhook(config.bot_token, webhookUrl, config.webhook_secret);
    } catch (err) {
      NotificationChannel.delete(channel.id);
      return res.status(400).json({ error: `Failed to register Telegram webhook: ${err.message}` });
    }
  }

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
  if (req.body.config) updates.config = req.body.config;
  if (req.body.enabled !== undefined) updates.active = req.body.enabled ? 1 : 0;

  const updated = NotificationChannel.update(req.params.id, updates);
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
    type: "test",
    message: "This is a test notification from Status One.",
    timestamp: new Date().toISOString(),
  };

  try {
    switch (channel.type) {
      case "telegram":
        await telegram.sendMessage(config, testPayload, channel.id);
        break;
      case "email":
        await email.sendNotification(config, testPayload);
        break;
      case "webhook":
        await webhook.sendWebhook(config, testPayload);
        break;
      case "slack":
        await webhook.sendWebhook({ url: config.webhook_url }, testPayload);
        break;
      case "discord":
        await discord.sendNotification(config, testPayload);
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
