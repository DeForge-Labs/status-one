const { getDb } = require("../database/connection");
const { generateId } = require("../utils/helpers");
const logger = require("../utils/logger");

const TELEGRAM_API = "https://api.telegram.org";

function formatMessage(payload) {
  const emoji = {
    monitor_down: "\u{1F534}",
    monitor_up: "\u{1F7E2}",
    monitor_degraded: "\u{1F7E1}",
    incident_update: "\u{1F535}",
    test: "\u{1F514}",
  };

  const icon = emoji[payload.type] || "\u{2139}\u{FE0F}";

  if (payload.type === "test") {
    return `${icon} *Test Notification*\n\n${payload.message}`;
  }

  if (payload.type === "monitor_down") {
    let msg = `${icon} *Monitor Down*\n\n`;
    msg += `*${payload.monitor.name}*\n`;
    msg += `Type: ${payload.monitor.type}\n`;
    if (payload.monitor.url) msg += `URL: ${payload.monitor.url}\n`;
    msg += `\nError: ${payload.check.error_message || "Unknown error"}\n`;
    if (payload.check.response_time_ms) msg += `Response Time: ${payload.check.response_time_ms}ms\n`;
    msg += `\nTime: ${payload.timestamp}`;
    return msg;
  }

  if (payload.type === "monitor_up") {
    let msg = `${icon} *Monitor Recovered*\n\n`;
    msg += `*${payload.monitor.name}*\n`;
    msg += `Type: ${payload.monitor.type}\n`;
    if (payload.monitor.url) msg += `URL: ${payload.monitor.url}\n`;
    msg += `Response Time: ${payload.check.response_time_ms}ms\n`;
    msg += `\nTime: ${payload.timestamp}`;
    return msg;
  }

  if (payload.type === "monitor_degraded") {
    let msg = `${icon} *Monitor Degraded*\n\n`;
    msg += `*${payload.monitor.name}*\n`;
    msg += `Response Time: ${payload.check.response_time_ms}ms\n`;
    msg += `\nTime: ${payload.timestamp}`;
    return msg;
  }

  if (payload.type === "incident_update") {
    let msg = `${icon} *Incident Update*\n\n`;
    if (payload.incident) {
      msg += `*${payload.incident.title}*\n`;
      msg += `Status: ${payload.update.status}\n\n`;
      msg += `${payload.update.message}\n`;
    }
    msg += `\nTime: ${payload.timestamp}`;
    return msg;
  }

  return `${icon} Status One notification: ${JSON.stringify(payload)}`;
}

// --- Subscriber management ---

function getSubscribers(channelId) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM telegram_subscribers WHERE notification_channel_id = ? ORDER BY created_at ASC"
  ).all(channelId);
}

function addSubscriber(channelId, chatId, username) {
  const db = getDb();
  const id = generateId();
  try {
    db.prepare(
      "INSERT OR IGNORE INTO telegram_subscribers (id, notification_channel_id, chat_id, username) VALUES (?, ?, ?, ?)"
    ).run(id, channelId, String(chatId), username || "");
    return true;
  } catch (err) {
    logger.error(`Failed to add Telegram subscriber: ${err.message}`);
    return false;
  }
}

function removeSubscriber(channelId, chatId) {
  const db = getDb();
  const result = db.prepare(
    "DELETE FROM telegram_subscribers WHERE notification_channel_id = ? AND chat_id = ?"
  ).run(channelId, String(chatId));
  return result.changes > 0;
}

// --- Bot update handler (called from webhook route) ---

async function handleUpdate(channelId, botToken, update) {
  const message = update.message || update.edited_message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const username = message.from?.username || message.from?.first_name || "";
  const text = message.text.trim().split(" ")[0].toLowerCase(); // handle /start@botname

  if (text === "/start") {
    const added = addSubscriber(channelId, chatId, username);
    const reply = added
      ? "✅ You are now subscribed to Status One notifications. Send /stop to unsubscribe."
      : "ℹ️ You are already subscribed to notifications.";
    await sendRawMessage(botToken, chatId, reply);
  } else if (text === "/stop") {
    const removed = removeSubscriber(channelId, chatId);
    const reply = removed
      ? "🔕 You have been unsubscribed from Status One notifications."
      : "ℹ️ You were not subscribed.";
    await sendRawMessage(botToken, chatId, reply);
  }
}

// --- Send helpers ---

async function sendRawMessage(botToken, chatId, text) {
  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true }),
  });
  if (!response.ok) {
    const body = await response.text();
    logger.warn(`Telegram sendMessage failed (${response.status}): ${body}`);
  }
}

async function sendMessage(config, payload, channelId) {
  const { bot_token } = config;

  if (!bot_token) {
    throw new Error("Telegram bot_token is required");
  }

  if (!channelId) {
    throw new Error("channelId is required to look up Telegram subscribers");
  }

  const subscribers = getSubscribers(channelId);
  if (subscribers.length === 0) {
    throw new Error("No Telegram subscribers. Users must send /start to the bot first.");
  }

  const text = formatMessage(payload);

  const results = await Promise.allSettled(
    subscribers.map((sub) => sendRawMessage(bot_token, sub.chat_id, text))
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  logger.debug(`Telegram notification sent to ${subscribers.length - failed}/${subscribers.length} subscribers`);
}

// --- Webhook registration ---

async function registerWebhook(botToken, webhookUrl, webhookSecret) {
  const url = `${TELEGRAM_API}/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${encodeURIComponent(webhookSecret)}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram setWebhook failed: ${data.description || JSON.stringify(data)}`);
  }
  logger.info(`Telegram webhook registered: ${webhookUrl}`);
  return data;
}

async function deleteWebhook(botToken) {
  const url = `${TELEGRAM_API}/bot${botToken}/deleteWebhook`;
  const response = await fetch(url, { method: "POST" });
  const data = await response.json();
  if (!data.ok) {
    logger.warn(`Telegram deleteWebhook failed: ${data.description || JSON.stringify(data)}`);
  }
}

// --- Verify bot token ---

async function verifyBot(botToken) {
  const url = `${TELEGRAM_API}/bot${botToken}/getMe`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Invalid Telegram bot token");
  }
  return response.json();
}

module.exports = { sendMessage, verifyBot, handleUpdate, getSubscribers, addSubscriber, removeSubscriber, registerWebhook, deleteWebhook };
