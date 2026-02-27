const ApiKey = require("../models/apiKey");
const User = require("../models/user");

function apiKeyAuth(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey) {
    return next(); // Fall through to JWT auth if no API key
  }

  const keyRecord = ApiKey.findByKey(apiKey);
  if (!keyRecord) {
    return res.status(401).json({ error: "Invalid API key" });
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
  next();
}

module.exports = { apiKeyAuth };
