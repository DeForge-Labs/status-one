const logger = require("../utils/logger");

function formatEmbed(payload) {
  const colors = {
    monitor_down: 0xdc2626,      // red
    monitor_up: 0x16a34a,        // green
    monitor_degraded: 0xca8a04,  // yellow
    incident_update: 0x2563eb,   // blue
    test: 0x7c3aed,              // purple
  };

  const color = colors[payload.type] || 0x6b7280;

  if (payload.type === "test") {
    return {
      title: "🔔 Test Notification",
      description: payload.message,
      color,
      timestamp: payload.timestamp,
    };
  }

  if (payload.type === "monitor_down") {
    return {
      title: "🔴 Monitor Down",
      description: `**${payload.monitor.name}** is not responding.`,
      color,
      fields: [
        { name: "Type", value: payload.monitor.type, inline: true },
        ...(payload.monitor.url ? [{ name: "URL", value: payload.monitor.url, inline: true }] : []),
        { name: "Error", value: payload.check.error_message || "Unknown", inline: false },
        { name: "Response Time", value: `${payload.check.response_time_ms}ms`, inline: true },
      ],
      timestamp: payload.timestamp,
    };
  }

  if (payload.type === "monitor_up") {
    return {
      title: "🟢 Monitor Recovered",
      description: `**${payload.monitor.name}** is back online.`,
      color,
      fields: [
        { name: "Type", value: payload.monitor.type, inline: true },
        ...(payload.monitor.url ? [{ name: "URL", value: payload.monitor.url, inline: true }] : []),
        { name: "Response Time", value: `${payload.check.response_time_ms}ms`, inline: true },
      ],
      timestamp: payload.timestamp,
    };
  }

  if (payload.type === "monitor_degraded") {
    return {
      title: "🟡 Monitor Degraded",
      description: `**${payload.monitor.name}** is experiencing degraded performance.`,
      color,
      fields: [
        { name: "Response Time", value: `${payload.check.response_time_ms}ms`, inline: true },
      ],
      timestamp: payload.timestamp,
    };
  }

  if (payload.type === "incident_update") {
    return {
      title: "🔵 Incident Update",
      description: payload.incident ? `**${payload.incident.title}**` : "Incident Update",
      color,
      fields: [
        { name: "Status", value: payload.update?.status || "Unknown", inline: true },
        ...(payload.update?.message ? [{ name: "Message", value: payload.update.message, inline: false }] : []),
      ],
      timestamp: payload.timestamp,
    };
  }

  return {
    title: "ℹ️ Status One Notification",
    description: `\`\`\`json\n${JSON.stringify(payload, null, 2)}\`\`\``,
    color,
    timestamp: payload.timestamp,
  };
}

async function sendNotification(config, payload) {
  const { webhook_url } = config;

  if (!webhook_url) {
    throw new Error("Discord webhook_url is required");
  }

  const embed = formatEmbed(payload);
  const body = JSON.stringify({ embeds: [embed] });

  const response = await fetch(webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "StatusOne-Webhook/1.0" },
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Discord webhook failed (${response.status}): ${text.substring(0, 200)}`);
  }

  logger.debug(`Discord notification sent`);
}

module.exports = { sendNotification };
