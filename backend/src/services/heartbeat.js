const Monitor = require("../models/monitor");
const MonitorCheck = require("../models/monitorCheck");
const Incident = require("../models/incident");
const Maintenance = require("../models/maintenance");
const notifier = require("./notifier");
const logger = require("../utils/logger");
const { nowISO } = require("../utils/helpers");

// Track last heartbeat received for each push monitor
const lastHeartbeat = new Map();
// When the last "missed" down check was recorded, so one is written per push interval, not per tick
const lastMissRecorded = new Map();
let checkInterval = null;

function recordHeartbeat(monitorId) {
  lastHeartbeat.set(monitorId, Date.now());
  lastMissRecorded.delete(monitorId);

  // Record an UP check
  MonitorCheck.create({
    monitor_id: monitorId,
    status: "up",
    response_time_ms: 0,
    status_code: 0,
    error_message: "",
    metadata: { type: "heartbeat" },
  });

  // Resolve any active incident
  const activeIncident = Incident.findActiveByMonitorId(monitorId);
  if (activeIncident && activeIncident.type === "auto") {
    Incident.addUpdate({
      incident_id: activeIncident.id,
      status: "resolved",
      message: "Heartbeat received, service is back online",
    });
    Incident.resolve(activeIncident.id);

    const monitor = Monitor.findById(monitorId);
    if (monitor) {
      notifier.sendMonitorUp(monitor, activeIncident, { status: "up", response_time_ms: 0 });
    }
  }
}

// Forget a monitor's timing (pause/resume/delete); the next tick restarts its grace period
function resetMonitor(monitorId) {
  lastHeartbeat.delete(monitorId);
  lastMissRecorded.delete(monitorId);
}

function checkMissedHeartbeats() {
  const pushMonitors = Monitor.findAll({ active: true }).filter(
    (m) => m.type === "push"
  );

  const now = Date.now();

  for (const monitor of pushMonitors) {
    const lastBeat = lastHeartbeat.get(monitor.id);
    const expectedInterval = (monitor.push_interval_seconds || 60) * 1000;
    // Allow 1.5x grace period
    const gracePeriod = expectedInterval * 1.5;

    // New, resumed or in-maintenance monitors: (re)start the grace period instead of alerting on stale time
    if (lastBeat === undefined || Maintenance.isMonitorInMaintenance(monitor.id)) {
      lastHeartbeat.set(monitor.id, now);
      continue;
    }

    if (now - lastBeat > gracePeriod) {
      // Uptime is derived from check counts, so keep recording a down check each push interval while missed
      const lastMiss = lastMissRecorded.get(monitor.id);
      if (lastMiss === undefined || now - lastMiss >= expectedInterval) {
        lastMissRecorded.set(monitor.id, now);
        MonitorCheck.create({
          monitor_id: monitor.id,
          status: "down",
          response_time_ms: 0,
          status_code: 0,
          error_message: `No heartbeat received for ${Math.round((now - lastBeat) / 1000)}s`,
          metadata: { type: "heartbeat_missed" },
        });
      }

      const activeIncident = Incident.findActiveByMonitorId(monitor.id);
      if (!activeIncident) {
        const incident = Incident.create({
          monitor_id: monitor.id,
          title: `${monitor.name} heartbeat missed`,
          type: "auto",
          status: "investigating",
        });

        Incident.addUpdate({
          incident_id: incident.id,
          status: "investigating",
          message: `No heartbeat received for ${Math.round((now - lastBeat) / 1000)} seconds`,
        });

        notifier.sendMonitorDown(monitor, incident, {
          status: "down",
          response_time_ms: 0,
          error_message: `No heartbeat for ${Math.round((now - lastBeat) / 1000)}s`,
        });
      }
    }
  }
}

function start() {
  // Check for missed heartbeats every 30 seconds
  checkInterval = setInterval(checkMissedHeartbeats, 30000);

  // Grace period starts at boot: after downtime the last stored check is old and would flag every push monitor as missed
  const now = Date.now();
  for (const monitor of Monitor.findAll({ active: true })) {
    if (monitor.type === "push") lastHeartbeat.set(monitor.id, now);
  }
}

function stop() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  lastHeartbeat.clear();
  lastMissRecorded.clear();
}

function startExpiredCheck() { start(); }
function stopExpiredCheck() { stop(); }

module.exports = { recordHeartbeat, resetMonitor, start, stop, startExpiredCheck, stopExpiredCheck };
