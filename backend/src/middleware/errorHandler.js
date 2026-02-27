const logger = require("../utils/logger");

function errorHandler(err, req, res, _next) {
  logger.error(`${req.method} ${req.path} - ${err.message}`, err.stack);

  // Handle specific error types
  if (err.name === "SyntaxError" && err.status === 400) {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }

  if (err.name === "UnauthorizedError") {
    return res.status(401).json({ error: "Authentication required" });
  }

  const status = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
