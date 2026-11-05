const { verifyToken, generateToken } = require("../utils/crypto");
const User = require("../models/user");
const { keyAuthenticated } = require("./apiKeyAuth");
const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");

// Issue a JWT and store the session row that authMiddleware requires
function createSession(userId) {
  const token = generateToken({ userId });
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowISO());
  db.prepare(
    "INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(generateId(), userId, token, new Date(verifyToken(token).exp * 1000).toISOString(), nowISO());
  return token;
}

// Delete a user's sessions, optionally keeping the one for `exceptToken`
function revokeSessions(userId, exceptToken = "") {
  getDb().prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").run(userId, exceptToken);
}

function hasLiveSession(token) {
  return !!getDb().prepare("SELECT 1 FROM sessions WHERE token = ? AND expires_at > ?").get(token, nowISO());
}

// Express 4 does not catch rejected promises from async handlers
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function authMiddleware(req, res, next) {
  // Already verified by apiKeyAuth (/api/ext)
  if (keyAuthenticated.has(req)) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload || !hasLiveSession(token)) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const user = User.findById(payload.userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  req.user = user;
  next();
}

// Optional auth - does not fail if no token, just sets req.user if valid
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload && hasLiveSession(token)) {
      const user = User.findById(payload.userId);
      if (user) req.user = user;
    }
  }
  next();
}

module.exports = { authMiddleware, optionalAuth, createSession, revokeSessions, asyncHandler };
