const { isStatusCodeAccepted } = require("../../utils/helpers");

async function checkHttp(monitor) {
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

    // Add basic auth if configured
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

    // Add body for methods that support it
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
    result.metadata.statusText = response.statusText;

    const accepted = monitor.accepted_status_codes || `${monitor.expected_status || 200}`;
    if (!isStatusCodeAccepted(response.status, accepted)) {
      result.status = "down";
      result.error_message = `Expected status ${accepted}, got ${response.status}`;
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

module.exports = { checkHttp };
