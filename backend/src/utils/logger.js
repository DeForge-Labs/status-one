const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

function shouldLog(level) {
  return LEVELS[level] >= (LEVELS[LOG_LEVEL] || 1);
}

function formatTime() {
  return new Date().toISOString();
}

const logger = {
  debug(msg, ...args) {
    if (shouldLog("debug")) {
      console.log(`[${formatTime()}] [DEBUG] ${msg}`, ...args);
    }
  },
  info(msg, ...args) {
    if (shouldLog("info")) {
      console.log(`[${formatTime()}] [INFO]  ${msg}`, ...args);
    }
  },
  warn(msg, ...args) {
    if (shouldLog("warn")) {
      console.warn(`[${formatTime()}] [WARN]  ${msg}`, ...args);
    }
  },
  error(msg, ...args) {
    if (shouldLog("error")) {
      console.error(`[${formatTime()}] [ERROR] ${msg}`, ...args);
    }
  },
};

module.exports = logger;
