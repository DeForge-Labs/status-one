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

function validateMonitorInput(body) {
  const errors = [];

  if (!body.name || body.name.trim().length < 1) {
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

  if (body.interval_seconds && !isValidInterval(body.interval_seconds)) {
    errors.push("Interval must be between 10 and 86400 seconds");
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
