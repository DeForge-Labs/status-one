const express = require("express");
const router = express.Router();
const Maintenance = require("../models/maintenance");
const Monitor = require("../models/monitor");
const { authMiddleware } = require("../middleware/auth");
const { sanitizeString, validatePagination } = require("../utils/validators");
const { nowISO, paginationMeta } = require("../utils/helpers");

// Shared by POST and PUT. Returns ISO bounds, or an error message.
function parseWindowTimes(startValue, endValue) {
  const startDate = new Date(startValue);
  const endDate = new Date(endValue);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { error: "Invalid date format" };
  }
  if (endDate <= startDate) {
    return { error: "end_time must be after start_time" };
  }
  return { start: startDate.toISOString(), end: endDate.toISOString() };
}

// Returns an error message when the list is not an array or contains an unknown monitor.
function checkMonitorIds(ids) {
  if (!Array.isArray(ids)) return "monitor_ids must be an array";
  const bad = ids.find((id) => typeof id !== "string" || !Monitor.findById(id));
  return bad === undefined ? null : `Monitor not found: ${bad}`;
}

function checkRecurrence(recurring, interval) {
  if (recurring && !Maintenance.RECURRING_INTERVALS.includes(interval)) {
    return `recurring_interval must be one of: ${Maintenance.RECURRING_INTERVALS.join(", ")}`;
  }
  return null;
}

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

  const times = parseWindowTimes(start_time, end_time);
  if (times.error) {
    return res.status(400).json({ error: times.error });
  }
  const recurrenceError = checkRecurrence(recurring, recurring_interval);
  if (recurrenceError) {
    return res.status(400).json({ error: recurrenceError });
  }
  if (monitor_ids != null) {
    const monitorError = checkMonitorIds(monitor_ids);
    if (monitorError) {
      return res.status(400).json({ error: monitorError });
    }
  }

  const window = Maintenance.create({
    title: sanitizeString(title, 500),
    description: description || "",
    start_time: times.start,
    end_time: times.end,
    recurring: !!recurring,
    recurring_interval: recurring ? recurring_interval : "",
    monitor_ids: monitor_ids || [],
    created_by: req.user.id,
  });

  res.status(201).json({ maintenance: window });
});

// PUT /api/maintenance/:id - Update maintenance window
router.put("/:id", authMiddleware, (req, res) => {
  const window = Maintenance.findById(req.params.id);
  if (!window) {
    return res.status(404).json({ error: "Maintenance window not found" });
  }

  const body = req.body;
  const updates = {};
  if (body.title) updates.title = sanitizeString(body.title, 500);
  if (body.description !== undefined) updates.description = body.description;

  // Validate the merged schedule so a partial update cannot leave end before start
  const times = parseWindowTimes(body.start_time || window.start_time, body.end_time || window.end_time);
  if (times.error) {
    return res.status(400).json({ error: times.error });
  }
  updates.start_time = times.start;
  updates.end_time = times.end;

  const recurring = body.recurring !== undefined ? !!body.recurring : window.recurring;
  const interval = body.recurring_interval !== undefined ? body.recurring_interval : window.recurring_interval;
  const recurrenceError = checkRecurrence(recurring, interval);
  if (recurrenceError) {
    return res.status(400).json({ error: recurrenceError });
  }
  updates.recurring = recurring;
  updates.recurring_interval = recurring ? interval : "";

  // "status" uses the list filter's values; a plain "active" boolean is accepted too
  if (body.status !== undefined) {
    if (!["active", "inactive"].includes(body.status)) {
      return res.status(400).json({ error: "status must be active or inactive" });
    }
    updates.active = body.status === "active";
  }
  if (body.active !== undefined) updates.active = !!body.active;

  if (body.monitor_ids != null) {
    const monitorError = checkMonitorIds(body.monitor_ids);
    if (monitorError) {
      return res.status(400).json({ error: monitorError });
    }
    updates.monitor_ids = body.monitor_ids;
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
