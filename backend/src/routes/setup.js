const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { hashPassword } = require("../utils/crypto");
const { isValidEmail, sanitizeString } = require("../utils/validators");
const { asyncHandler, createSession } = require("../middleware/auth");
const { getDb } = require("../database/connection");

// GET /api/setup/status - Check if setup is needed
router.get("/status", (req, res) => {
  const count = User.count();
  res.json({ needsSetup: count === 0 });
});

// POST /api/setup - Create first admin account
router.post("/", asyncHandler(async (req, res) => {
  try {
    if (User.count() > 0) {
      return res.status(403).json({ error: "Setup already completed" });
    }

    const { email, password, name } = req.body;

    if (typeof email !== "string" || !isValidEmail(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (typeof name !== "string" || name.trim().length < 1) {
      return res.status(400).json({ error: "Name is required" });
    }

    const password_hash = await hashPassword(password);

    // The count check must be re-run with the write in one transaction: the
    // hash above is async, so a concurrent request could have created the admin meanwhile.
    const result = getDb().transaction(() => {
      if (User.count() > 0) return null;
      const user = User.create({
        email: email.toLowerCase().trim(),
        password_hash,
        name: sanitizeString(name),
      });
      return { user, token: createSession(user.id) };
    }).immediate();
    if (!result) {
      return res.status(403).json({ error: "Setup already completed" });
    }
    const { user, token } = result;

    res.status(201).json({
      user,
      token,
      message: "Admin account created. Setup complete.",
    });
  } catch (err) {
    if (err.message?.includes("UNIQUE")) {
      return res.status(409).json({ error: "Email already exists" });
    }
    throw err;
  }
}));

module.exports = router;
