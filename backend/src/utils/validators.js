function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidInterval(seconds) {
  return Number.isInteger(seconds) && seconds >= 10 && seconds <= 86400;
}

function isValidMonitorType(type) {
  return ["http", "ping", "tcp", "dns", "keyword", "push", "ssl"].includes(
    type
  );
}

function isValidHttpMethod(method) {
  return ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(
    method?.toUpperCase()
  );
}

function isValidIncidentStatus(status) {
  return ["investigating", "identified", "monitoring", "resolved"].includes(
    status
  );
}

function isValidStatusPageMessageType(type) {
  return ["info", "warning", "maintenance"].includes(type);
}

function sanitizeString(str, maxLen = 255) {
  if (typeof str !== "string") return "";
  return str.trim().substring(0, maxLen);
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// headers arrive as an object or as a JSON string of an object
function isValidHeaders(headers) {
  if (typeof headers !== "string") return isPlainObject(headers);
  try {
    return isPlainObject(JSON.parse(headers));
  } catch {
    return false;
  }
}

function validateMonitorInput(body) {
  const errors = [];

  if (typeof body.name !== "string" || body.name.trim().length < 1) {
    errors.push("Name is required");
  }

  if (!isValidMonitorType(body.type)) {
    errors.push(
      "Invalid monitor type. Must be: http, ping, tcp, dns, keyword, push, ssl"
    );
  }

  if (
    ["http", "keyword", "ssl"].includes(body.type) &&
    !isValidUrl(body.url)
  ) {
    errors.push("Valid URL is required for HTTP/keyword/SSL monitors");
  }

  if (body.type === "http" && body.method && !isValidHttpMethod(body.method)) {
    errors.push("Invalid HTTP method");
  }

  if (
    ["ping", "tcp", "dns"].includes(body.type) &&
    !body.hostname &&
    !body.url
  ) {
    errors.push("Hostname or URL is required for ping/tcp/dns monitors");
  }

  if (body.type === "tcp" && (!body.port || body.port < 1 || body.port > 65535)) {
    errors.push("Valid port (1-65535) is required for TCP monitors");
  }

  if (body.type === "ping") {
    let host = body.hostname;
    if (!host && body.url) {
      try { host = new URL(body.url).hostname; } catch {}
    }
    // a leading "-" would be parsed as an option by the ping binary
    if (String(host || "").trimStart().startsWith("-")) {
      errors.push("Hostname must not start with '-'");
    }
  }

  if (body.interval_seconds != null && !isValidInterval(body.interval_seconds)) {
    errors.push("Interval must be between 10 and 86400 seconds");
  }

  if (body.type === "push" && body.push_interval_seconds != null && !isValidInterval(body.push_interval_seconds)) {
    errors.push("Push interval must be between 10 and 86400 seconds");
  }

  if (body.retries != null && !(Number.isInteger(body.retries) && body.retries >= 0 && body.retries <= 10)) {
    errors.push("Retries must be an integer between 0 and 10");
  }

  if (body.headers != null && !isValidHeaders(body.headers)) {
    errors.push("Headers must be a JSON object");
  }

  if (body.notification_channel_ids !== undefined &&
      !(Array.isArray(body.notification_channel_ids) && body.notification_channel_ids.every((id) => typeof id === "string"))) {
    errors.push("notification_channel_ids must be an array of ids");
  }

  if (body.type === "keyword" && !body.keyword) {
    errors.push("Keyword is required for keyword monitors");
  }

  return errors;
}

function validatePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = {
  isValidEmail,
  isValidUrl,
  isValidInterval,
  isValidMonitorType,
  isValidHttpMethod,
  isValidIncidentStatus,
  isValidStatusPageMessageType,
  sanitizeString,
  validateMonitorInput,
  validatePagination,
};
