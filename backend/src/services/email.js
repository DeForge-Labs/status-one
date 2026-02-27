const nodemailer = require("nodemailer");
const config = require("../config");
const logger = require("../utils/logger");

function createTransporter() {
  if (!config.smtp.host) {
    return null;
  }
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
}

function formatHtml(payload) {
  if (payload.type === "test") {
    return `
      <h2>Test Notification</h2>
      <p>${payload.message}</p>
      <p><small>Sent at ${payload.timestamp}</small></p>
    `;
  }

  if (payload.type === "monitor_down") {
    return `
      <h2 style="color: #dc2626;">Monitor Down: ${payload.monitor.name}</h2>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 12px; font-weight: bold;">Type:</td><td>${payload.monitor.type}</td></tr>
        ${payload.monitor.url ? `<tr><td style="padding: 4px 12px; font-weight: bold;">URL:</td><td>${payload.monitor.url}</td></tr>` : ""}
        <tr><td style="padding: 4px 12px; font-weight: bold;">Error:</td><td>${payload.check.error_message || "Unknown"}</td></tr>
        <tr><td style="padding: 4px 12px; font-weight: bold;">Response Time:</td><td>${payload.check.response_time_ms}ms</td></tr>
      </table>
      <p><small>${payload.timestamp}</small></p>
    `;
  }

  if (payload.type === "monitor_up") {
    return `
      <h2 style="color: #16a34a;">Monitor Recovered: ${payload.monitor.name}</h2>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 12px; font-weight: bold;">Type:</td><td>${payload.monitor.type}</td></tr>
        ${payload.monitor.url ? `<tr><td style="padding: 4px 12px; font-weight: bold;">URL:</td><td>${payload.monitor.url}</td></tr>` : ""}
        <tr><td style="padding: 4px 12px; font-weight: bold;">Response Time:</td><td>${payload.check.response_time_ms}ms</td></tr>
      </table>
      <p><small>${payload.timestamp}</small></p>
    `;
  }

  if (payload.type === "monitor_degraded") {
    return `
      <h2 style="color: #ca8a04;">Monitor Degraded: ${payload.monitor.name}</h2>
      <p>Response time is above threshold: ${payload.check.response_time_ms}ms</p>
      <p><small>${payload.timestamp}</small></p>
    `;
  }

  if (payload.type === "incident_update") {
    return `
      <h2>Incident Update: ${payload.incident?.title || "Unknown"}</h2>
      <p><strong>Status:</strong> ${payload.update?.status || "Unknown"}</p>
      <p>${payload.update?.message || ""}</p>
      <p><small>${payload.timestamp}</small></p>
    `;
  }

  return `<pre>${JSON.stringify(payload, null, 2)}</pre>`;
}

function getSubject(payload) {
  switch (payload.type) {
    case "monitor_down":
      return `[DOWN] ${payload.monitor.name} is down`;
    case "monitor_up":
      return `[RECOVERED] ${payload.monitor.name} is back online`;
    case "monitor_degraded":
      return `[DEGRADED] ${payload.monitor.name} performance degraded`;
    case "incident_update":
      return `[INCIDENT] ${payload.incident?.title || "Update"}`;
    case "test":
      return "[TEST] Status One Test Notification";
    default:
      return "Status One Notification";
  }
}

async function sendNotification(channelConfig, payload) {
  const transporter = createTransporter();
  if (!transporter) {
    throw new Error("SMTP not configured. Set SMTP_HOST in .env");
  }

  const recipients = channelConfig.recipients || channelConfig.to;
  if (!recipients) {
    throw new Error("No email recipients configured for this channel");
  }

  const to = Array.isArray(recipients) ? recipients.join(", ") : recipients;

  const mailOptions = {
    from: config.smtp.from,
    to,
    subject: getSubject(payload),
    html: formatHtml(payload),
  };

  await transporter.sendMail(mailOptions);
  logger.debug(`Email notification sent to ${to}`);
}

async function sendPasswordReset(email, resetToken, appUrl) {
  const transporter = createTransporter();
  if (!transporter) {
    throw new Error("SMTP not configured");
  }

  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: "Password Reset - Status One",
    html: `
      <h2>Password Reset</h2>
      <p>You requested a password reset for your Status One account.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
      <p>Or copy and paste this URL into your browser:</p>
      <p>${resetUrl}</p>
      <p><small>This link will expire in 30 minutes. If you did not request this reset, please ignore this email.</small></p>
    `,
  });

  logger.info(`Password reset email sent to ${email}`);
}

module.exports = { sendNotification, sendPasswordReset };
