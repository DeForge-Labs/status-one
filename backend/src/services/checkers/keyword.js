const { isStatusCodeAccepted } = require("../../utils/helpers");

async function checkKeyword(monitor) {
  const startTime = Date.now();
  const result = {
    status: "up",
    response_time_ms: 0,
    status_code: 0,
    error_message: "",
    metadata: {},
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), monitor.timeout_ms || 10000);

    const headers = typeof monitor.headers === "string"
      ? JSON.parse(monitor.headers)
      : (monitor.headers || {});

    if (monitor.auth_method === "basic" && monitor.auth_user) {
      const credentials = Buffer.from(`${monitor.auth_user}:${monitor.auth_pass}`).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    }

    const fetchOptions = {
      method: monitor.method || "GET",
      headers,
      signal: controller.signal,
      redirect: "follow",
    };

    if (["POST", "PUT", "PATCH"].includes(fetchOptions.method) && monitor.body) {
      fetchOptions.body = monitor.body;
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    }

    const response = await fetch(monitor.url, fetchOptions);
    clearTimeout(timeout);

    result.response_time_ms = Date.now() - startTime;
    result.status_code = response.status;

    const accepted = monitor.accepted_status_codes || `${monitor.expected_status || 200}`;
    if (!isStatusCodeAccepted(response.status, accepted)) {
      result.status = "down";
      result.error_message = `Expected status ${accepted}, got ${response.status}`;
      return result;
    }

    // Read body for keyword check
    const body = await response.text();
    const keyword = monitor.keyword || "";
    const keywordType = monitor.keyword_type || "contains";

    let keywordMatch = false;
    if (keywordType === "contains") {
      keywordMatch = body.includes(keyword);
    } else if (keywordType === "not_contains") {
      keywordMatch = !body.includes(keyword);
    } else if (keywordType === "regex") {
      try {
        const regex = new RegExp(keyword);
        keywordMatch = regex.test(body);
      } catch {
        result.status = "down";
        result.error_message = "Invalid regex pattern in keyword";
        return result;
      }
    }

    if (!keywordMatch) {
      result.status = "down";
      if (keywordType === "not_contains") {
        result.error_message = `Body contains forbidden keyword: "${keyword}"`;
      } else {
        result.error_message = `Keyword "${keyword}" not found in response body`;
      }
    } else if (monitor.degraded_threshold_ms && result.response_time_ms > monitor.degraded_threshold_ms) {
      result.status = "degraded";
    }
  } catch (err) {
    result.response_time_ms = Date.now() - startTime;
    result.status = "down";
    if (err.name === "AbortError") {
      result.error_message = `Timeout after ${monitor.timeout_ms || 10000}ms`;
    } else {
      result.error_message = err.message;
    }
  }

  return result;
}

module.exports = { checkKeyword };
