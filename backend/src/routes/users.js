const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { hashPassword } = require("../utils/crypto");
const { isValidEmail, sanitizeString } = require("../utils/validators");
const { authMiddleware, asyncHandler, revokeSessions } = require("../middleware/auth");

// GET /api/users - List all users
router.get("/", authMiddleware, (req, res) => {
  const users = User.findAll();
  res.json({ users });
});

// GET /api/users/:id - Get user by id
router.get("/:id", authMiddleware, (req, res) => {
  const user = User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ user });
});

// POST /api/users - Create new admin user
router.post("/", authMiddleware, asyncHandler(async (req, res) => {
  try {
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
    const user = User.create({
      email,
      password_hash,
      name: sanitizeString(name),
    });

    res.status(201).json({ user });
  } catch (err) {
    if (err.message?.includes("UNIQUE")) {
      return res.status(409).json({ error: "Email already exists" });
    }
    throw err;
  }
}));

// PUT /api/users/:id - Update user
router.put("/:id", authMiddleware, asyncHandler(async (req, res) => {
  const user = User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const { email, name, password } = req.body;
  const updates = {};

  if (email) {
    if (typeof email !== "string" || !isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email" });
    }
    updates.email = email;
  }

  if (name) updates.name = sanitizeString(name);

  if (password) {
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    updates.password_hash = await hashPassword(password);
  }

  let updated;
  try {
    updated = User.update(req.params.id, updates);
  } catch (err) {
    if (err.message?.includes("UNIQUE")) {
      return res.status(409).json({ error: "Email already exists" });
    }
    throw err;
  }
  if (updates.password_hash) {
    const ownToken = req.params.id === req.user.id ? req.headers.authorization?.substring(7) : undefined;
    revokeSessions(req.params.id, ownToken);
  }
  res.json({ user: updated });
}));

// DELETE /api/users/:id - Delete user
router.delete("/:id", authMiddleware, (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  const user = User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Prevent deleting the last user
  if (User.count() <= 1) {
    return res.status(400).json({ error: "Cannot delete the last admin account" });
  }

  User.delete(req.params.id);
  res.json({ message: "User deleted" });
});

module.exports = router;
