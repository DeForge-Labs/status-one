const ApiKey = require("../models/apiKey");
const User = require("../models/user");

// Requests that passed API key verification. A WeakSet (not a req field) so
// nothing a client sends can mark a request as key-authenticated.
const keyAuthenticated = new WeakSet();

function apiKeyAuth(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || typeof apiKey !== "string") {
    return next(); // Fall through to JWT auth if no API key
  }

  const keyRecord = ApiKey.findByKey(apiKey);
  if (!keyRecord) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  // Keys without write access are read-only
  const readOnly = req.method === "GET" || req.method === "HEAD";
  const perms = keyRecord.permissions;
  if (!readOnly && !perms.includes("write") && !perms.includes("monitors")) {
    return res.status(403).json({ error: "API key does not have write permission" });
  }

  // Update last used timestamp
  ApiKey.updateLastUsed(keyRecord.id);

  // Load the user who created the key
  const user = User.findById(keyRecord.created_by);
  if (!user) {
    return res.status(401).json({ error: "API key owner not found" });
  }

  req.user = user;
  req.apiKey = keyRecord;
  keyAuthenticated.add(req);
  next();
}

module.exports = { apiKeyAuth, keyAuthenticated };
