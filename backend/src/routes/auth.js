const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Settings = require("../models/settings");
const {
  hashPassword,
  verifyPassword,
  generateResetToken,
} = require("../utils/crypto");
const { isValidEmail } = require("../utils/validators");
const { authMiddleware, asyncHandler, createSession, revokeSessions } = require("../middleware/auth");
const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");
const emailService = require("../services/email");

// POST /api/auth/login
router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = User.findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = createSession(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
}));

// POST /api/auth/logout
router.post("/logout", authMiddleware, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.substring(7);
  if (token) {
    const db = getDb();
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  res.json({ message: "Logged out" });
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/me - Update own profile
router.put("/me", authMiddleware, asyncHandler(async (req, res) => {
  const { name, email, current_password, new_password } = req.body;

  const updates = {};

  if (name) {
    if (typeof name !== "string") return res.status(400).json({ error: "Invalid name" });
    updates.name = name.trim();
  }
  if (email) {
    if (typeof email !== "string" || !isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email" });
    }
    updates.email = email;
  }

  if (new_password) {
    if (typeof new_password !== "string") {
      return res.status(400).json({ error: "Invalid password" });
    }
    if (!current_password || typeof current_password !== "string") {
      return res.status(400).json({ error: "Current password is required to change password" });
    }
    const fullUser = User.findByEmail(req.user.email);
    const valid = await verifyPassword(current_password, fullUser.password_hash);
    if (!valid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }
    updates.password_hash = await hashPassword(new_password);
  }

  let user;
  try {
    user = User.update(req.user.id, updates);
  } catch (err) {
    if (err.message?.includes("UNIQUE")) {
      return res.status(409).json({ error: "Email already exists" });
    }
    throw err;
  }
  if (updates.password_hash) {
    revokeSessions(req.user.id, req.headers.authorization.substring(7));
  }
  res.json({ user });
}));

// POST /api/auth/change-password - Dedicated change password endpoint
router.post("/change-password", authMiddleware, asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password || typeof current_password !== "string" || typeof new_password !== "string") {
    return res.status(400).json({ error: "Current password and new password are required" });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const fullUser = User.findByEmail(req.user.email);
  const valid = await verifyPassword(current_password, fullUser.password_hash);
  if (!valid) {
    return res.status(400).json({ error: "Current password is incorrect" });
  }

  const password_hash = await hashPassword(new_password);
  User.update(req.user.id, { password_hash });
  revokeSessions(req.user.id, req.headers.authorization.substring(7));

  res.json({ message: "Password changed successfully" });
}));

// POST /api/auth/forgot-password
router.post("/forgot-password", asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }

  // Always return success to prevent email enumeration
  const user = User.findByEmail(email);
  if (!user) {
    return res.json({ message: "If the email exists, a password reset link has been sent" });
  }

  try {
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const db = getDb();
    db.prepare(
      "INSERT INTO password_resets (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(generateId(), user.id, resetToken, expiresAt, nowISO());

    const appUrl = Settings.get("site_url") || Settings.get("app_url") || "http://localhost:3000";
    await emailService.sendPasswordReset(user.email, resetToken, appUrl);
  } catch (err) {
    // Log but don't expose SMTP errors
    console.error("Password reset email error:", err.message);
  }

  res.json({ message: "If the email exists, a password reset link has been sent" });
}));

// POST /api/auth/reset-password
router.post("/reset-password", asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password || typeof token !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Token and password are required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const db = getDb();
  const reset = db.prepare(
    "SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > ?"
  ).get(token, nowISO());

  if (!reset) {
    return res.status(400).json({ error: "Invalid or expired reset token" });
  }

  const password_hash = await hashPassword(password);
  User.update(reset.user_id, { password_hash });

  // Mark token as used
  db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(reset.id);

  // Invalidate all sessions for this user
  revokeSessions(reset.user_id);

  res.json({ message: "Password has been reset. Please log in with your new password." });
}));

module.exports = router;
