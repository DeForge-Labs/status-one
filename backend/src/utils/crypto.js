const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { randomBytes, createHash } = require("crypto");

const SALT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function generateResetToken() {
  return randomBytes(32).toString("hex");
}

function generateApiKey() {
  const key = `so_${randomBytes(32).toString("hex")}`;
  const prefix = key.substring(0, 10);
  const keyHash = createHash("sha256").update(key).digest("hex");
  return { key, prefix, keyHash };
}

function hashApiKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

function generatePushToken() {
  return randomBytes(24).toString("hex");
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  generateResetToken,
  generateApiKey,
  hashApiKey,
  generatePushToken,
};
