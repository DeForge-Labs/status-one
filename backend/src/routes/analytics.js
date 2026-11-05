const express = require("express");
const router = express.Router();
const Analytics = require("../services/analytics");
const Monitor = require("../models/monitor");
const MonitorCheck = require("../models/monitorCheck");
const Incident = require("../models/incident");
const { authMiddleware } = require("../middleware/auth");
const { dateToISO } = require("../utils/helpers");

// GET /api/analytics/overview - Dashboard overview
router.get("/overview", authMiddleware, (req, res) => {
  const overview = Analytics.getOverview();
  res.json(overview);
});

// GET /api/analytics/monitors/:id/response-times
router.get("/monitors/:id/response-times", authMiddleware, (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  const hours = Math.min(parseInt(req.query.hours) || 24, 720);
  const data = Analytics.getResponseTimes(req.params.id, hours);
  res.json({ monitor_id: req.params.id, hours, data });
});

// GET /api/analytics/monitors/:id/availability
router.get("/monitors/:id/availability", authMiddleware, (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  const days = Math.min(parseInt(req.query.days) || 30, 365);
  const data = Analytics.getAvailability(req.params.id, days);
  res.json({ monitor_id: req.params.id, days, data });
});

// GET /api/analytics/monitors/:id/daily-stats
router.get("/monitors/:id/daily-stats", authMiddleware, (req, res) => {
  const monitor = Monitor.findById(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: "Monitor not found" });
  }

  const days = Math.min(parseInt(req.query.days) || 30, 365);
  const since = dateToISO(new Date(Date.now() - days * 86400000));
  const stats = MonitorCheck.getDailyStatsRange(req.params.id, since, dateToISO(new Date()));

  res.json({ monitor_id: req.params.id, days, stats });
});

// GET /api/analytics/summary - Global summary stats
router.get("/summary", authMiddleware, (req, res) => {
  const totalMonitors = Monitor.countAll();
  const monitorsByStatus = Monitor.countByStatus();
  const activeIncidents = Incident.countActive();

  res.json({ totalMonitors, monitorsByStatus, activeIncidents, ...Analytics.getGlobalUptime() });
});

module.exports = router;
