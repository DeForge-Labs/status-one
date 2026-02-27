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

// GET /api/monitors - List all monitors
router.get("/", authMiddleware, (req, res) => {
  const monitors = Monitor.findAll();

  // Enrich with latest status and tags
  const enriched = monitors.map((m) => {
    const latest = MonitorCheck.getLatestByMonitorId(m.id);
    const tags = Monitor.getTagsForMonitor(m.id);
    const notificationIds = Monitor.getLinkedNotificationIds(m.id);
    return {
      ...m,
      current_status: latest?.status || "unknown",
      last_check: latest?.created_at || null,
      last_response_time: latest?.response_time_ms || 0,
      tags,
      notification_channel_ids: notificationIds,
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

  res.json({
    monitor: {
      ...monitor,
      current_status: latest?.status || "unknown",
      last_check: latest?.created_at || null,
      last_response_time: latest?.response_time_ms || 0,
      tags,
      notification_channel_ids: notificationIds,
      uptime,
      avg_response_time_24h: avgResponseTime,
    },
  });
});

// POST /api/monitors - Create monitor
router.post("/", authMiddleware, (req, res) => {
  const errors = validateMonitorInput(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const data = { ...req.body, created_by: req.user.id };

  // Generate push token for push monitors
  if (data.type === "push") {
    data.push_token = generatePushToken();
  }

  const monitor = Monitor.create(data);

  // Link notification channels if provided
  if (req.body.notification_channel_ids && Array.isArray(req.body.notification_channel_ids)) {
    for (const channelId of req.body.notification_channel_ids) {
      Monitor.addNotificationChannel(monitor.id, channelId);
    }
  }

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

  // Only validate fields that are being updated
  if (req.body.name !== undefined || req.body.type !== undefined) {
    const checkData = { ...monitor, ...req.body };
    const errors = validateMonitorInput(checkData);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
  }

  const updated = Monitor.update(req.params.id, req.body);

  // Update notification channel links if provided
  if (req.body.notification_channel_ids && Array.isArray(req.body.notification_channel_ids)) {
    // Remove existing links
    const existing = Monitor.getLinkedNotificationIds(req.params.id);
    for (const id of existing) {
      Monitor.removeNotificationChannel(req.params.id, id);
    }
    // Add new links
    for (const channelId of req.body.notification_channel_ids) {
      Monitor.addNotificationChannel(req.params.id, channelId);
    }
  }

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

  res.json({ message: "Monitor paused" });
});

// POST /api/monitors/:id/resume - Resume monitor
router.post("/:id/resume", authMiddleware, (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  Monitor.update(req.params.id, { active: true });
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
