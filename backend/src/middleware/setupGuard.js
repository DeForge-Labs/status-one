const User = require("../models/user");

function setupGuard(req, res, next) {
  // Allow public routes always
  if (req.path.startsWith("/api/public/") || req.path.startsWith("/api/heartbeat/") || req.path.startsWith("/api/system/health")) {
    return next();
  }

  // Allow setup status check always
  if (req.path === "/api/setup/status") {
    return next();
  }

  const userCount = User.count();

  // If no users exist, only allow setup route
  if (userCount === 0) {
    if (req.path === "/api/setup" && req.method === "POST") {
      return next();
    }
    return res.status(503).json({
      error: "Setup required",
      needsSetup: true,
      message: "Please complete initial setup by creating an admin account",
    });
  }

  // If users exist, block setup route
  if (req.path === "/api/setup" && req.method === "POST") {
    return res.status(403).json({ error: "Setup already completed" });
  }

  next();
}

module.exports = { setupGuard };
