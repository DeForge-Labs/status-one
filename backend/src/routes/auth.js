const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Settings = require("../models/settings");
const {
  hashPassword,
  verifyPassword,
  generateToken,
  generateResetToken,
} = require("../utils/crypto");
const { isValidEmail } = require("../utils/validators");
const { authMiddleware } = require("../middleware/auth");
const { getDb } = require("../database/connection");
const { generateId, nowISO } = require("../utils/helpers");
const emailService = require("../services/email");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
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

  const token = generateToken({ userId: user.id });

  // Store session
  const db = getDb();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    "INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(generateId(), user.id, token, expiresAt, nowISO());

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
});

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
router.put("/me", authMiddleware, async (req, res) => {
  const { name, email, current_password, new_password } = req.body;

  const updates = {};

  if (name) updates.name = name.trim();
  if (email) {
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email" });
    }
    updates.email = email;
  }

  if (new_password) {
    if (!current_password) {
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

  const user = User.update(req.user.id, updates);
  res.json({ user });
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
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

    const appUrl = Settings.get("app_url") || "http://localhost:3000";
    await emailService.sendPasswordReset(user.email, resetToken, appUrl);
  } catch (err) {
    // Log but don't expose SMTP errors
    console.error("Password reset email error:", err.message);
  }

  res.json({ message: "If the email exists, a password reset link has been sent" });
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
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
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(reset.user_id);

  res.json({ message: "Password has been reset. Please log in with your new password." });
});

module.exports = router;
