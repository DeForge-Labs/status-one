const express = require("express");
const router = express.Router();
const NotificationChannel = require("../models/notificationChannel");
const { authMiddleware } = require("../middleware/auth");
const Settings = require("../models/settings");
const telegram = require("../services/telegram");
const logger = require("../utils/logger");

// Middleware: verify the X-Telegram-Bot-Api-Secret-Token header against the channel's webhook_secret
function verifyTelegramSecret(req, res, next) {
  const { channelId } = req.params;
  const incoming = req.headers["x-telegram-bot-api-secret-token"];

  const channel = NotificationChannel.findById(channelId);
  if (!channel || channel.type !== "telegram" || !channel.active) {
    // Return 200 to prevent Telegram from retrying on a permanently absent channel
    return res.sendStatus(200);
  }

  const expected = channel.config?.webhook_secret;
  if (!expected || !incoming || incoming !== expected) {
    logger.warn(`Telegram webhook secret mismatch for channel ${channelId}`);
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.telegramChannel = channel;
  next();
}

// POST /api/telegram/webhook/:channelId - Telegram delivers bot updates here
router.post("/webhook/:channelId", verifyTelegramSecret, async (req, res) => {
  // Respond immediately so Telegram doesn't retry
  res.sendStatus(200);

  const channel = req.telegramChannel;
  const update = req.body;

  try {
    await telegram.handleUpdate(channel.id, channel.config.bot_token, update);
  } catch (err) {
    logger.error(`Telegram webhook error for channel ${channel.id}: ${err.message}`);
  }
});

// POST /api/telegram/:channelId/setup-webhook - Re-register the webhook (e.g. after domain change)
router.post("/:channelId/setup-webhook", authMiddleware, async (req, res) => {
  const channel = NotificationChannel.findById(req.params.channelId);
  if (!channel || channel.type !== "telegram") {
    return res.status(404).json({ error: "Telegram channel not found" });
  }

  const { bot_token, webhook_secret } = channel.config;
  if (!bot_token || !webhook_secret) {
    return res.status(400).json({ error: "Channel is missing bot_token or webhook_secret" });
  }

  const appUrl = Settings.get("app_url");
  if (!appUrl) {
    return res.status(400).json({ error: "app_url is not configured. Set it in Settings first." });
  }

  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook/${channel.id}`;

  try {
    await telegram.registerWebhook(bot_token, webhookUrl, webhook_secret);
    res.json({ message: "Telegram webhook registered successfully", webhook_url: webhookUrl });
  } catch (err) {
    res.status(500).json({ error: `Failed to register webhook: ${err.message}` });
  }
});

// GET /api/telegram/:channelId/subscribers - list subscribers
router.get("/:channelId/subscribers", authMiddleware, (req, res) => {
  const channel = NotificationChannel.findById(req.params.channelId);
  if (!channel || channel.type !== "telegram") {
    return res.status(404).json({ error: "Telegram channel not found" });
  }

  const subscribers = telegram.getSubscribers(req.params.channelId);
  res.json({
    subscribers: subscribers.map((s) => ({
      chat_id: s.chat_id,
      username: s.username,
      created_at: s.created_at,
    })),
  });
});

module.exports = router;
