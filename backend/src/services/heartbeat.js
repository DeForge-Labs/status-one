const Monitor = require("../models/monitor");
const MonitorCheck = require("../models/monitorCheck");
const Incident = require("../models/incident");
const notifier = require("./notifier");
const logger = require("../utils/helpers");
const { nowISO } = require("../utils/helpers");

// Track last heartbeat received for each push monitor
const lastHeartbeat = new Map();
let checkInterval = null;

function recordHeartbeat(monitorId) {
  lastHeartbeat.set(monitorId, Date.now());

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

    if (lastBeat && now - lastBeat > gracePeriod) {
      // Missed heartbeat — check if already in incident
      const activeIncident = Incident.findActiveByMonitorId(monitor.id);
      if (!activeIncident) {
        // Record a DOWN check
        MonitorCheck.create({
          monitor_id: monitor.id,
          status: "down",
          response_time_ms: 0,
          status_code: 0,
          error_message: `No heartbeat received for ${Math.round((now - lastBeat) / 1000)}s`,
          metadata: { type: "heartbeat_missed" },
        });

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

  // Initialize last heartbeat times for existing push monitors
  const pushMonitors = Monitor.findAll({ active: true }).filter(
    (m) => m.type === "push"
  );
  const now = Date.now();
  for (const monitor of pushMonitors) {
    // Check if there's a recent check; if so, use that as last heartbeat
    const latestCheck = MonitorCheck.getLatestByMonitorId(monitor.id);
    if (latestCheck) {
      lastHeartbeat.set(monitor.id, new Date(latestCheck.created_at).getTime());
    } else {
      // Set to now so we don't immediately trigger on startup
      lastHeartbeat.set(monitor.id, now);
    }
  }
}

function stop() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  lastHeartbeat.clear();
}

function startExpiredCheck() { start(); }
function stopExpiredCheck() { stop(); }

module.exports = { recordHeartbeat, start, stop, startExpiredCheck, stopExpiredCheck };
