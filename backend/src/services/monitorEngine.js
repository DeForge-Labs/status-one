const Monitor = require("../models/monitor");
const MonitorCheck = require("../models/monitorCheck");
const Maintenance = require("../models/maintenance");
const { checkHttp } = require("./checkers/http");
const { checkPing } = require("./checkers/ping");
const { checkTcp } = require("./checkers/tcp");
const { checkDns } = require("./checkers/dns");
const { checkKeyword } = require("./checkers/keyword");
const { checkSsl } = require("./checkers/ssl");
const incidentManager = require("./incidentManager");
const logger = require("../utils/logger");

// Stores active monitor intervals: Map<monitorId, intervalId>
const activeMonitors = new Map();
// Tracks last check time to prevent overlapping checks
const checkInProgress = new Set();

const checkers = {
  http: checkHttp,
  ping: checkPing,
  tcp: checkTcp,
  dns: checkDns,
  keyword: checkKeyword,
  ssl: checkSsl,
  push: null, // Push monitors are passive; handled by heartbeat service
};

async function runCheck(monitor) {
  if (checkInProgress.has(monitor.id)) {
    logger.debug(`Check already in progress for monitor ${monitor.id}, skipping`);
    return null;
  }

  checkInProgress.add(monitor.id);

  try {
    // Check if monitor is in maintenance
    if (Maintenance.isMonitorInMaintenance(monitor.id)) {
      logger.debug(`Monitor ${monitor.id} is in maintenance, skipping check`);
      return null;
    }

    const checker = checkers[monitor.type];
    if (!checker) {
      logger.warn(`No checker for monitor type: ${monitor.type}`);
      return null;
    }

    const result = await checker(monitor);

    // Store the check result
    MonitorCheck.create({
      monitor_id: monitor.id,
      status: result.status,
      response_time_ms: result.response_time_ms,
      status_code: result.status_code,
      error_message: result.error_message,
      metadata: result.metadata,
    });

    // Evaluate for incidents
    await incidentManager.evaluate(monitor, result);

    logger.debug(
      `Monitor ${monitor.name} (${monitor.type}): ${result.status} - ${result.response_time_ms}ms`
    );

    return result;
  } catch (err) {
    logger.error(`Error checking monitor ${monitor.id}: ${err.message}`);
    return null;
  } finally {
    checkInProgress.delete(monitor.id);
  }
}

function scheduleMonitor(monitor) {
  if (activeMonitors.has(monitor.id)) {
    clearInterval(activeMonitors.get(monitor.id));
  }

  const intervalMs = (monitor.interval_seconds || 60) * 1000;

  // Run first check immediately
  const freshMonitor = Monitor.findById(monitor.id);
  if (freshMonitor && freshMonitor.active) {
    runCheck(freshMonitor);
  }

  // Schedule recurring checks
  const intervalId = setInterval(() => {
    const current = Monitor.findById(monitor.id);
    if (!current || !current.active) {
      // Monitor was deleted or deactivated
      clearInterval(intervalId);
      activeMonitors.delete(monitor.id);
      return;
    }
    runCheck(current);
  }, intervalMs);

  activeMonitors.set(monitor.id, intervalId);
  logger.info(`Scheduled monitor: ${monitor.name} (${monitor.type}) every ${monitor.interval_seconds}s`);
}

function start() {
  const monitors = Monitor.findAll({ active: true });
  logger.info(`Starting monitor engine with ${monitors.length} active monitors`);

  for (const monitor of monitors) {
    if (monitor.type !== "push") {
      scheduleMonitor(monitor);
    }
  }
}

function stop() {
  logger.info("Stopping monitor engine");
  for (const [id, intervalId] of activeMonitors) {
    clearInterval(intervalId);
  }
  activeMonitors.clear();
  checkInProgress.clear();
}

function addMonitor(monitorId) {
  const monitor = Monitor.findById(monitorId);
  if (monitor && monitor.active && monitor.type !== "push") {
    scheduleMonitor(monitor);
  }
}

function removeMonitor(monitorId) {
  if (activeMonitors.has(monitorId)) {
    clearInterval(activeMonitors.get(monitorId));
    activeMonitors.delete(monitorId);
    logger.info(`Removed monitor ${monitorId} from engine`);
  }
}

function restartMonitor(monitorId) {
  removeMonitor(monitorId);
  addMonitor(monitorId);
}

function getActiveCount() {
  return activeMonitors.size;
}

// Run a one-off check without scheduling
async function testMonitor(monitor) {
  const checker = checkers[monitor.type];
  if (!checker) {
    return { status: "error", error_message: `No checker for type: ${monitor.type}` };
  }
  return checker(monitor);
}

function stopAll() { stop(); }

module.exports = {
  start,
  stop,
  stopAll,
  addMonitor,
  removeMonitor,
  restartMonitor,
  runCheck,
  testMonitor,
  getActiveCount,
};
