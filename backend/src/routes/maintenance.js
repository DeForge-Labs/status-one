const express = require("express");
const router = express.Router();
const Maintenance = require("../models/maintenance");
const Monitor = require("../models/monitor");
const { authMiddleware } = require("../middleware/auth");
const { sanitizeString, validatePagination } = require("../utils/validators");
const { nowISO, paginationMeta } = require("../utils/helpers");

// GET /api/maintenance - List maintenance windows
router.get("/", authMiddleware, (req, res) => {
  const { page, limit, offset } = validatePagination(req.query);
  const filters = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.monitor_id) filters.monitor_id = req.query.monitor_id;

  const windows = Maintenance.findAll({ ...filters, limit, offset });
  const total = Maintenance.count(filters);

  res.json({
    maintenance: windows,
    pagination: paginationMeta(total, page, limit),
  });
});

// GET /api/maintenance/:id
router.get("/:id", authMiddleware, (req, res) => {
  const window = Maintenance.findById(req.params.id);
  if (!window) {
    return res.status(404).json({ error: "Maintenance window not found" });
  }
  res.json({ maintenance: window });
});

// POST /api/maintenance - Create maintenance window
router.post("/", authMiddleware, (req, res) => {
  const { title, description, monitor_ids, start_time, end_time, recurring, recurring_interval } = req.body;

  if (!title || title.trim().length < 1) {
    return res.status(400).json({ error: "Title is required" });
  }
  if (!start_time || !end_time) {
    return res.status(400).json({ error: "start_time and end_time are required" });
  }

  const startDate = new Date(start_time);
  const endDate = new Date(end_time);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ error: "Invalid date format" });
  }
  if (endDate <= startDate) {
    return res.status(400).json({ error: "end_time must be after start_time" });
  }

  // Validate monitor IDs if provided
  const validMonitorIds = [];
  if (monitor_ids && Array.isArray(monitor_ids)) {
    for (const id of monitor_ids) {
      const monitor = Monitor.findById(id);
      if (!monitor) {
        return res.status(400).json({ error: `Monitor not found: ${id}` });
      }
      validMonitorIds.push(id);
    }
  }

  const window = Maintenance.create({
    title: sanitizeString(title, 500),
    description: description || "",
    start_time: startDate.toISOString(),
    end_time: endDate.toISOString(),
    recurring: !!recurring,
    recurring_interval: recurring_interval || null,
    created_by: req.user.id,
  });

  // Link monitors
  for (const monitorId of validMonitorIds) {
    Maintenance.addMonitor(window.id, monitorId);
  }

  res.status(201).json({
    maintenance: {
      ...window,
      monitor_ids: validMonitorIds,
    },
  });
});

// PUT /api/maintenance/:id - Update maintenance window
router.put("/:id", authMiddleware, (req, res) => {
  const window = Maintenance.findById(req.params.id);
  if (!window) {
    return res.status(404).json({ error: "Maintenance window not found" });
  }

  const updates = {};
  if (req.body.title) updates.title = sanitizeString(req.body.title, 500);
  if (req.body.description !== undefined) updates.description = req.body.description;
  if (req.body.start_time) updates.start_time = new Date(req.body.start_time).toISOString();
  if (req.body.end_time) updates.end_time = new Date(req.body.end_time).toISOString();
  if (req.body.recurring !== undefined) updates.recurring = req.body.recurring ? 1 : 0;
  if (req.body.recurring_interval !== undefined) updates.recurring_interval = req.body.recurring_interval;
  if (req.body.status) updates.status = req.body.status;

  // Update monitor links if provided
  if (req.body.monitor_ids && Array.isArray(req.body.monitor_ids)) {
    Maintenance.clearMonitors(window.id);
    for (const monitorId of req.body.monitor_ids) {
      Maintenance.addMonitor(window.id, monitorId);
    }
  }

  const updated = Maintenance.update(req.params.id, updates);
  res.json({ maintenance: updated });
});

// DELETE /api/maintenance/:id
router.delete("/:id", authMiddleware, (req, res) => {
  const window = Maintenance.findById(req.params.id);
  if (!window) {
    return res.status(404).json({ error: "Maintenance window not found" });
  }

  Maintenance.delete(req.params.id);
  res.json({ message: "Maintenance window deleted" });
});

module.exports = router;
