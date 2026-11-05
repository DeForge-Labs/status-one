const express = require("express");
const router = express.Router();
const Monitor = require("../models/monitor");
const MonitorCheck = require("../models/monitorCheck");
const { authMiddleware } = require("../middleware/auth");
const { validateMonitorInput, validatePagination } = require("../utils/validators");
const { generatePushToken } = require("../utils/crypto");
const { paginationMeta, daysAgo } = require("../utils/helpers");
const monitorEngine = require("../services/monitorEngine");
const heartbeat = require("../services/heartbeat");
const Maintenance = require("../models/maintenance");
const incidentManager = require("../services/incidentManager");
const { getDb } = require("../database/connection");

// Shape validation first, then check that the linked channel ids exist (avoids an FK 500)
function inputErrors(data) {
  const errors = validateMonitorInput(data);
  if (errors.length || !Array.isArray(data.notification_channel_ids)) return errors;
  const missing = Monitor.findUnknownChannelIds(data.notification_channel_ids);
  return missing.length ? [`Unknown notification channel(s): ${missing.join(", ")}`] : [];
}

// GET /api/monitors - List all monitors
router.get("/", authMiddleware, (req, res) => {
  const monitors = Monitor.findAll();
  const uptime24h = MonitorCheck.getUptimeByMonitor(daysAgo(1));

  // Enrich with latest status and tags
  const enriched = monitors.map((m) => {
    const latest = MonitorCheck.getLatestByMonitorId(m.id);
    const tags = Monitor.getTagsForMonitor(m.id);
    const notificationIds = Monitor.getLinkedNotificationIds(m.id);
    const is_paused = !m.active;
    const in_maintenance = !is_paused && Maintenance.isMonitorInMaintenance(m.id);
    let current_status = latest?.status || "unknown";
    if (is_paused) current_status = "paused";
    else if (in_maintenance) current_status = "maintenance";
    return {
      ...m,
      current_status,
      last_check: latest?.created_at || null,
      last_response_time: latest?.response_time_ms || 0,
      is_paused,
      in_maintenance,
      tags,
      notification_channel_ids: notificationIds,
      uptime: { "24h": uptime24h[m.id] ?? null },
    };
  });

  res.json({ monitors: enriched });
});

// GET /api/monitors/:id - Get single monitor
router.get("/:id", authMiddleware, (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  const latest = MonitorCheck.getLatestByMonitorId(monitor.id);
  const tags = Monitor.getTagsForMonitor(monitor.id);
  const notificationIds = Monitor.getLinkedNotificationIds(monitor.id);

  // Calculate uptime percentages
  const uptime = {
    "24h": MonitorCheck.getUptimePercentage(monitor.id, daysAgo(1)),
    "7d": MonitorCheck.getUptimePercentage(monitor.id, daysAgo(7)),
    "30d": MonitorCheck.getUptimePercentage(monitor.id, daysAgo(30)),
    "90d": MonitorCheck.getUptimePercentage(monitor.id, daysAgo(90)),
  };

  const avgResponseTime = MonitorCheck.getAvgResponseTime(monitor.id, daysAgo(1));
  const is_paused = !monitor.active;
  const in_maintenance = !is_paused && Maintenance.isMonitorInMaintenance(monitor.id);
  let current_status = latest?.status || "unknown";
  if (is_paused) current_status = "paused";
  else if (in_maintenance) current_status = "maintenance";

  res.json({
    monitor: {
      ...monitor,
      current_status,
      last_check: latest?.created_at || null,
      last_response_time: latest?.response_time_ms || 0,
      is_paused,
      in_maintenance,
      tags,
      notification_channel_ids: notificationIds,
      uptime,
      avg_response_time_24h: avgResponseTime,
    },
  });
});

// POST /api/monitors - Create monitor
router.post("/", authMiddleware, (req, res) => {
  const errors = inputErrors(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const data = { ...req.body, created_by: req.user.id };

  // Generate push token for push monitors
  if (data.type === "push") {
    data.push_token = generatePushToken();
  }

  // Monitor and its channel links are written together or not at all
  const monitor = getDb().transaction(() => {
    const created = Monitor.create(data);
    if (req.body.notification_channel_ids) {
      Monitor.setNotificationChannels(created.id, req.body.notification_channel_ids);
    }
    return created;
  })();

  // Start monitoring
  monitorEngine.addMonitor(monitor.id);

  res.status(201).json({ monitor });
});

// PUT /api/monitors/:id - Update monitor
router.put("/:id", authMiddleware, (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  // Validate the merged result, exactly like POST; push_token is server-generated, never client-set
  const body = { ...req.body };
  delete body.push_token;
  const merged = { ...monitor, ...body };
  const errors = inputErrors(merged);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  if (merged.type === "push" && !monitor.push_token) {
    body.push_token = generatePushToken();
  }

  const updated = getDb().transaction(() => {
    const row = Monitor.update(req.params.id, body);
    if (body.notification_channel_ids) {
      Monitor.setNotificationChannels(req.params.id, body.notification_channel_ids);
    }
    return row;
  })();

  // Restart monitor with new settings
  monitorEngine.restartMonitor(req.params.id);

  res.json({ monitor: updated });
});

// DELETE /api/monitors/:id - Delete monitor
router.delete("/:id", authMiddleware, (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  monitorEngine.removeMonitor(req.params.id);
  incidentManager.resetCounter(req.params.id);
  heartbeat.resetMonitor(req.params.id);
  Monitor.delete(req.params.id);

  res.json({ message: "Monitor deleted" });
});

// POST /api/monitors/:id/pause - Pause monitor
router.post("/:id/pause", authMiddleware, (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  Monitor.update(req.params.id, { active: false });
  monitorEngine.removeMonitor(req.params.id);
  incidentManager.resetCounter(req.params.id);
  heartbeat.resetMonitor(req.params.id);

  res.json({ message: "Monitor paused" });
});

// POST /api/monitors/:id/resume - Resume monitor
router.post("/:id/resume", authMiddleware, (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  Monitor.update(req.params.id, { active: true });
  incidentManager.resetCounter(req.params.id);
  heartbeat.resetMonitor(req.params.id);
  monitorEngine.addMonitor(req.params.id);

  res.json({ message: "Monitor resumed" });
});

// POST /api/monitors/:id/test - Run one-off check
router.post("/:id/test", authMiddleware, async (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  const result = await monitorEngine.testMonitor(monitor);
  res.json({ result });
});

// GET /api/monitors/:id/checks - Get check history (paginated)
router.get("/:id/checks", authMiddleware, (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  const { page, limit, offset } = validatePagination(req.query);
  const total = MonitorCheck.countByMonitorId(req.params.id);
  const checks = MonitorCheck.findByMonitorId(req.params.id, { limit, offset });

  res.json({
    checks,
    pagination: paginationMeta(total, page, limit),
  });
});

// GET /api/monitors/:id/uptime - Get uptime stats
router.get("/:id/uptime", authMiddleware, (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  const uptime = {
    "1h": MonitorCheck.getUptimePercentage(monitor.id, daysAgo(1 / 24)),
    "24h": MonitorCheck.getUptimePercentage(monitor.id, daysAgo(1)),
    "7d": MonitorCheck.getUptimePercentage(monitor.id, daysAgo(7)),
    "30d": MonitorCheck.getUptimePercentage(monitor.id, daysAgo(30)),
    "90d": MonitorCheck.getUptimePercentage(monitor.id, daysAgo(90)),
  };

  const avgResponseTime = {
    "24h": MonitorCheck.getAvgResponseTime(monitor.id, daysAgo(1)),
    "7d": MonitorCheck.getAvgResponseTime(monitor.id, daysAgo(7)),
    "30d": MonitorCheck.getAvgResponseTime(monitor.id, daysAgo(30)),
  };

  res.json({ uptime, avgResponseTime });
});

// GET /api/monitors/:id/response-times - Get response time series
router.get("/:id/response-times", authMiddleware, (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  const period = req.query.period || "24h";
  const periodMap = { "1h": 1 / 24, "24h": 1, "7d": 7, "30d": 30, "90d": 90 };
  const days = periodMap[period] || 1;

  const series = MonitorCheck.getResponseTimeSeries(monitor.id, daysAgo(days));
  res.json({ series });
});

// POST /api/monitors/:id/tags - Add tag to monitor
router.post("/:id/tags", authMiddleware, (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  const { tag_id } = req.body;
  if (!tag_id) {
    return res.status(400).json({ error: "tag_id is required" });
  }

  Monitor.addTag(req.params.id, tag_id);
  const tags = Monitor.getTagsForMonitor(req.params.id);
  res.json({ tags });
});

// DELETE /api/monitors/:id/tags/:tagId - Remove tag from monitor
router.delete("/:id/tags/:tagId", authMiddleware, (req, res) => {
  Monitor.removeTag(req.params.id, req.params.tagId);
  const tags = Monitor.getTagsForMonitor(req.params.id);
  res.json({ tags });
});

// POST /api/heartbeat/:pushToken - Receive heartbeat for push monitors
router.post("/heartbeat/:pushToken", (req, res) => {
  const monitor = Monitor.findByPushToken(req.params.pushToken);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }
  if (!monitor.active) {
    return res.status(400).json({ error: "Monitor is paused" });
  }

  heartbeat.recordHeartbeat(monitor.id);
  res.json({ ok: true, msg: "Heartbeat received" });
});

// Also support GET for easier integration (e.g., from simple HTTP clients / cron)
router.get("/heartbeat/:pushToken", (req, res) => {
  const monitor = Monitor.findByPushToken(req.params.pushToken);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }
  if (!monitor.active) {
    return res.status(400).json({ error: "Monitor is paused" });
  }

  heartbeat.recordHeartbeat(monitor.id);
  res.json({ ok: true, msg: "Heartbeat received" });
});

module.exports = router;
