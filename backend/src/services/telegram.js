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

async function sendMessage(config, payload) {
  const { bot_token, chat_id } = config;

  if (!bot_token || !chat_id) {
    throw new Error("Telegram bot_token and chat_id are required");
  }

  const text = formatMessage(payload);
  const url = `${TELEGRAM_API}/bot${bot_token}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error (${response.status}): ${body}`);
  }

  logger.debug(`Telegram notification sent to chat ${chat_id}`);
}

// Verify bot token is valid
async function verifyBot(botToken) {
  const url = `${TELEGRAM_API}/bot${botToken}/getMe`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Invalid Telegram bot token");
  }
  return response.json();
}

module.exports = { sendMessage, verifyBot };
