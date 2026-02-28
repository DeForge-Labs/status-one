const Monitor = require("../models/monitor");
const telegram = require("./telegram");
const email = require("./email");
const webhook = require("./webhook");
const discord = require("./discord");
const logger = require("../utils/logger");

async function sendToChannel(channel, payload) {
  try {
    switch (channel.type) {
      case "telegram":
        await telegram.sendMessage(channel.config, payload, channel.id);
        break;
      case "email":
        await email.sendNotification(channel.config, payload);
        break;
      case "webhook":
        await webhook.sendWebhook(channel.config, payload);
        break;
      case "slack":
        await webhook.sendWebhook({ url: channel.config.webhook_url }, payload);
        break;
      case "discord":
        await discord.sendNotification(channel.config, payload);
        break;
      default:
        logger.warn(`Unknown notification channel type: ${channel.type}`);
    }
  } catch (err) {
    logger.error(`Failed to send notification via ${channel.type} (${channel.name}): ${err.message}`);
  }
}

async function notifyMonitorChannels(monitor, payload) {
  const channels = Monitor.getNotificationChannels(monitor.id);
  if (channels.length === 0) return;

  const promises = channels.map((channel) => sendToChannel(channel, payload));
  await Promise.allSettled(promises);
}

async function sendMonitorDown(monitor, incident, checkResult) {
  const payload = {
    type: "monitor_down",
    monitor: {
      id: monitor.id,
      name: monitor.name,
      type: monitor.type,
      url: monitor.url || monitor.hostname,
    },
    incident: {
      id: incident.id,
      title: incident.title,
      status: incident.status,
    },
    check: {
      status: checkResult.status,
      status_code: checkResult.status_code,
      response_time_ms: checkResult.response_time_ms,
      error_message: checkResult.error_message,
    },
    timestamp: new Date().toISOString(),
  };

  await notifyMonitorChannels(monitor, payload);
}

async function sendMonitorUp(monitor, incident, checkResult) {
  const payload = {
    type: "monitor_up",
    monitor: {
      id: monitor.id,
      name: monitor.name,
      type: monitor.type,
      url: monitor.url || monitor.hostname,
    },
    incident: {
      id: incident.id,
      title: incident.title,
      status: "resolved",
    },
    check: {
      status: checkResult.status,
      status_code: checkResult.status_code,
      response_time_ms: checkResult.response_time_ms,
    },
    timestamp: new Date().toISOString(),
  };

  await notifyMonitorChannels(monitor, payload);
}

async function sendMonitorDegraded(monitor, checkResult) {
  const payload = {
    type: "monitor_degraded",
    monitor: {
      id: monitor.id,
      name: monitor.name,
      type: monitor.type,
      url: monitor.url || monitor.hostname,
    },
    check: {
      status: checkResult.status,
      response_time_ms: checkResult.response_time_ms,
    },
    timestamp: new Date().toISOString(),
  };

  await notifyMonitorChannels(monitor, payload);
}

async function sendIncidentUpdate(monitor, incident, update) {
  const payload = {
    type: "incident_update",
    monitor: monitor ? {
      id: monitor.id,
      name: monitor.name,
      type: monitor.type,
      url: monitor.url || monitor.hostname,
    } : null,
    incident: {
      id: incident.id,
      title: incident.title,
      status: update.status,
    },
    update: {
      message: update.message,
      status: update.status,
    },
    timestamp: new Date().toISOString(),
  };

  if (monitor) {
    await notifyMonitorChannels(monitor, payload);
  }
}

// Test a specific notification channel
async function testChannel(channel) {
  const payload = {
    type: "test",
    message: "This is a test notification from Status One",
    timestamp: new Date().toISOString(),
  };
  await sendToChannel(channel, payload);
}

module.exports = {
  sendMonitorDown,
  sendMonitorUp,
  sendMonitorDegraded,
  sendIncidentUpdate,
  testChannel,
};
