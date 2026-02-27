const tls = require("tls");

async function checkSsl(monitor) {
  const startTime = Date.now();
  const result = {
    status: "up",
    response_time_ms: 0,
    status_code: 0,
    error_message: "",
    metadata: {},
  };

  return new Promise((resolve) => {
    try {
      const url = new URL(monitor.url);
      const hostname = url.hostname;
      const port = parseInt(url.port) || 443;
      const timeout = monitor.timeout_ms || 10000;

      const socket = tls.connect(
        { host: hostname, port, servername: hostname, rejectUnauthorized: false },
        () => {
          result.response_time_ms = Date.now() - startTime;

          const cert = socket.getPeerCertificate();
          if (!cert || !cert.valid_to) {
            result.status = "down";
            result.error_message = "No SSL certificate found";
            socket.destroy();
            resolve(result);
            return;
          }

          const validTo = new Date(cert.valid_to);
          const validFrom = new Date(cert.valid_from);
          const now = new Date();
          const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));
          const warnDays = monitor.ssl_warn_days || 30;

          result.metadata = {
            hostname,
            issuer: cert.issuer,
            subject: cert.subject,
            valid_from: cert.valid_from,
            valid_to: cert.valid_to,
            days_until_expiry: daysUntilExpiry,
            serial_number: cert.serialNumber,
            fingerprint: cert.fingerprint,
          };

          if (now < validFrom || now > validTo) {
            result.status = "down";
            result.error_message = `SSL certificate expired on ${cert.valid_to}`;
          } else if (daysUntilExpiry <= warnDays) {
            result.status = "degraded";
            result.error_message = `SSL certificate expires in ${daysUntilExpiry} days`;
          }

          socket.destroy();
          resolve(result);
        }
      );

      socket.setTimeout(timeout);

      socket.on("timeout", () => {
        result.response_time_ms = Date.now() - startTime;
        result.status = "down";
        result.error_message = `SSL connection timed out after ${timeout}ms`;
        socket.destroy();
        resolve(result);
      });

      socket.on("error", (err) => {
        result.response_time_ms = Date.now() - startTime;
        result.status = "down";
        result.error_message = `SSL error: ${err.message}`;
        socket.destroy();
        resolve(result);
      });
    } catch (err) {
      result.response_time_ms = Date.now() - startTime;
      result.status = "down";
      result.error_message = err.message;
      resolve(result);
    }
  });
}

module.exports = { checkSsl };
