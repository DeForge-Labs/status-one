const ping = require("ping");

async function checkPing(monitor) {
  const startTime = Date.now();
  const result = {
    status: "up",
    response_time_ms: 0,
    status_code: 0,
    error_message: "",
    metadata: {},
  };

  try {
    const host = monitor.hostname || new URL(monitor.url).hostname;
    const timeoutSec = Math.ceil((monitor.timeout_ms || 10000) / 1000);

    const res = await ping.promise.probe(host, {
      timeout: timeoutSec,
      min_reply: 1,
    });

    result.response_time_ms = res.time === "unknown" ? Date.now() - startTime : Math.round(parseFloat(res.time));
    result.metadata.host = host;
    result.metadata.packetLoss = res.packetLoss;
    result.metadata.numeric_host = res.numeric_host;

    if (!res.alive) {
      result.status = "down";
      result.error_message = `Host ${host} is unreachable`;
    } else if (monitor.degraded_threshold_ms && result.response_time_ms > monitor.degraded_threshold_ms) {
      result.status = "degraded";
    }
  } catch (err) {
    result.response_time_ms = Date.now() - startTime;
    result.status = "down";
    result.error_message = err.message;
  }

  return result;
}

module.exports = { checkPing };
