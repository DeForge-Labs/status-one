const express = require("express");
const router = express.Router();
const User = require("../models/user");
const {
  hashPassword,
  generateToken,
} = require("../utils/crypto");
const { isValidEmail, sanitizeString } = require("../utils/validators");

// GET /api/setup/status - Check if setup is needed
router.get("/status", (req, res) => {
  const count = User.count();
  res.json({ needsSetup: count === 0 });
});

// POST /api/setup - Create first admin account
router.post("/", async (req, res) => {
  try {
    const count = User.count();
    if (count > 0) {
      return res.status(403).json({ error: "Setup already completed" });
    }

    const { email, password, name } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!name || name.trim().length < 1) {
      return res.status(400).json({ error: "Name is required" });
    }

    const password_hash = await hashPassword(password);
    const user = User.create({
      email: email.toLowerCase().trim(),
      password_hash,
      name: sanitizeString(name),
    });

    const token = generateToken({ userId: user.id });

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
});

module.exports = router;
