const Incident = require("../models/incident");
const MonitorCheck = require("../models/monitorCheck");
const Monitor = require("../models/monitor");
const notifier = require("./notifier");
const logger = require("../utils/logger");

// Track consecutive failures per monitor for retry logic
const failureCounters = new Map();

async function evaluate(monitor, checkResult) {
  try {
    const retries = monitor.retries || 3;
    const currentCount = failureCounters.get(monitor.id) || 0;

    if (checkResult.status === "down") {
      const newCount = currentCount + 1;
      failureCounters.set(monitor.id, newCount);

      logger.debug(`Monitor ${monitor.name} failure count: ${newCount}/${retries}`);

      // Only create incident after consecutive failures exceed retries
      if (newCount >= retries) {
        const activeIncident = Incident.findActiveByMonitorId(monitor.id);
        if (!activeIncident) {
          // Create new incident
          const incident = Incident.create({
            monitor_id: monitor.id,
            title: `${monitor.name} is down`,
            type: "auto",
            status: "investigating",
          });

          Incident.addUpdate({
            incident_id: incident.id,
            status: "investigating",
            message: checkResult.error_message || `Monitor ${monitor.name} is not responding`,
          });

          logger.warn(`Incident created for monitor ${monitor.name}: ${incident.id}`);

          // Send notifications
          await notifier.sendMonitorDown(monitor, incident, checkResult);
        }
      }
    } else {
      // Monitor is up or degraded
      if (currentCount > 0) {
        failureCounters.set(monitor.id, 0);

        // Check if there's an active incident to resolve
        const activeIncident = Incident.findActiveByMonitorId(monitor.id);
        if (activeIncident && activeIncident.type === "auto") {
          Incident.addUpdate({
            incident_id: activeIncident.id,
            status: "resolved",
            message: `${monitor.name} is back online. Response time: ${checkResult.response_time_ms}ms`,
          });

          Incident.resolve(activeIncident.id);
          logger.info(`Incident ${activeIncident.id} auto-resolved for monitor ${monitor.name}`);

          // Send recovery notification
          await notifier.sendMonitorUp(monitor, activeIncident, checkResult);
        }
      }

      // Notify on degraded state change (optional)
      if (checkResult.status === "degraded") {
        const recentChecks = MonitorCheck.getRecentByMonitorId(monitor.id, 5);
        const wasPreviouslyOk = recentChecks.length > 1 && recentChecks[1]?.status === "up";
        if (wasPreviouslyOk) {
          await notifier.sendMonitorDegraded(monitor, checkResult);
        }
      }
    }
  } catch (err) {
    logger.error(`Error evaluating incident for monitor ${monitor.id}: ${err.message}`);
  }
}

function resetCounter(monitorId) {
  failureCounters.delete(monitorId);
}

function resetAll() {
  failureCounters.clear();
}

module.exports = { evaluate, resetCounter, resetAll };
