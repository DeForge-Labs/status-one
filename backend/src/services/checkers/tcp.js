const net = require("net");

async function checkTcp(monitor) {
  const startTime = Date.now();
  const result = {
    status: "up",
    response_time_ms: 0,
    status_code: 0,
    error_message: "",
    metadata: {},
  };

  const host = monitor.hostname || (monitor.url ? new URL(monitor.url).hostname : "");
  const port = monitor.port;
  const timeout = monitor.timeout_ms || 10000;

  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(timeout);

    socket.on("connect", () => {
      result.response_time_ms = Date.now() - startTime;
      result.metadata.host = host;
      result.metadata.port = port;

      if (monitor.degraded_threshold_ms && result.response_time_ms > monitor.degraded_threshold_ms) {
        result.status = "degraded";
      }

      socket.destroy();
      resolve(result);
    });

    socket.on("timeout", () => {
      result.response_time_ms = Date.now() - startTime;
      result.status = "down";
      result.error_message = `Connection to ${host}:${port} timed out after ${timeout}ms`;
      socket.destroy();
      resolve(result);
    });

    socket.on("error", (err) => {
      result.response_time_ms = Date.now() - startTime;
      result.status = "down";
      result.error_message = `TCP connection to ${host}:${port} failed: ${err.message}`;
      socket.destroy();
      resolve(result);
    });

    socket.connect(port, host);
  });
}

module.exports = { checkTcp };
