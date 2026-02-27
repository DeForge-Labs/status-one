const { createHmac } = require("crypto");
const logger = require("../utils/logger");

async function sendWebhook(config, payload) {
  const { url, secret, method } = config;

  if (!url) {
    throw new Error("Webhook URL is required");
  }

  const body = JSON.stringify(payload);
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "StatusOne-Webhook/1.0",
  };

  // Add HMAC signature if secret is provided
  if (secret) {
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    headers["X-Signature-256"] = `sha256=${signature}`;
  }

  const response = await fetch(url, {
    method: method || "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const respBody = await response.text().catch(() => "");
    throw new Error(`Webhook failed (${response.status}): ${respBody.substring(0, 200)}`);
  }

  logger.debug(`Webhook sent to ${url}`);
}

module.exports = { sendWebhook };
