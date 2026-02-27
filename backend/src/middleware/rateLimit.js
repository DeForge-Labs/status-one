const logger = require("../utils/logger");

// Simple in-memory sliding window rate limiter
const store = new Map();

function createRateLimiter({ windowMs = 60000, maxRequests = 120 } = {}) {
  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of store.entries()) {
      // Remove requests older than the window
      data.timestamps = data.timestamps.filter((t) => now - t < windowMs);
      if (data.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, windowMs);

  return function rateLimit(req, res, next) {
    // Use IP as key, fallback to a default
    const key = req.ip || req.connection?.remoteAddress || "unknown";
    const now = Date.now();

    if (!store.has(key)) {
      store.set(key, { timestamps: [] });
    }

    const data = store.get(key);
    // Remove expired timestamps
    data.timestamps = data.timestamps.filter((t) => now - t < windowMs);

    if (data.timestamps.length >= maxRequests) {
      logger.warn(`Rate limit exceeded for ${key}`);
      return res.status(429).json({
        error: "Too many requests",
        retryAfter: Math.ceil(windowMs / 1000),
      });
    }

    data.timestamps.push(now);

    // Set rate limit headers
    res.set("X-RateLimit-Limit", String(maxRequests));
    res.set("X-RateLimit-Remaining", String(maxRequests - data.timestamps.length));
    res.set("X-RateLimit-Reset", String(Math.ceil((data.timestamps[0] + windowMs) / 1000)));

    next();
  };
}

module.exports = { createRateLimiter };
