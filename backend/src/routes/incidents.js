const express = require("express");
const router = express.Router();
const Incident = require("../models/incident");
const Monitor = require("../models/monitor");
const { authMiddleware } = require("../middleware/auth");
const { validatePagination, isValidIncidentStatus, sanitizeString } = require("../utils/validators");
const { paginationMeta } = require("../utils/helpers");
const notifier = require("../services/notifier");

// GET /api/incidents - List incidents
router.get("/", authMiddleware, (req, res) => {
  const { page, limit, offset } = validatePagination(req.query);
  const filters = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.monitor_id) filters.monitor_id = req.query.monitor_id;

  const total = Incident.count(filters);
  const incidents = Incident.findAll({ ...filters, limit, offset });

  // Enrich with monitor name
  const enriched = incidents.map((inc) => {
    const monitor = inc.monitor_id ? Monitor.findById(inc.monitor_id) : null;
    return {
      ...inc,
      monitor_name: monitor?.name || null,
      monitor_type: monitor?.type || null,
    };
  });

  res.json({
    incidents: enriched,
    pagination: paginationMeta(total, page, limit),
  });
});

// GET /api/incidents/:id - Get single incident with updates
router.get("/:id", authMiddleware, (req, res) => {
  const incident = Incident.findById(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: "Incident not found" });
  }

  const updates = Incident.getUpdates(incident.id);
  const monitor = incident.monitor_id ? Monitor.findById(incident.monitor_id) : null;

  res.json({
    incident: {
      ...incident,
      monitor_name: monitor?.name || null,
      monitor_type: monitor?.type || null,
      updates,
    },
  });
});

// POST /api/incidents - Create manual incident
router.post("/", authMiddleware, (req, res) => {
  const { title, monitor_id, status, message } = req.body;

  if (!title || title.trim().length < 1) {
    return res.status(400).json({ error: "Title is required" });
  }

  if (status && !isValidIncidentStatus(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const incident = Incident.create({
    monitor_id: monitor_id || null,
    title: sanitizeString(title, 500),
    type: "manual",
    status: status || "investigating",
    created_by: req.user.id,
  });

  // Add initial update if message provided
  if (message) {
    Incident.addUpdate({
      incident_id: incident.id,
      status: incident.status,
      message: sanitizeString(message, 5000),
      created_by: req.user.id,
    });
  }

  res.status(201).json({ incident });
});

// PUT /api/incidents/:id - Update incident
router.put("/:id", authMiddleware, (req, res) => {
  const incident = Incident.findById(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: "Incident not found" });
  }

  const { title, status } = req.body;
  const updates = {};

  if (title) updates.title = sanitizeString(title, 500);
  if (status) {
    if (!isValidIncidentStatus(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    updates.status = status;
    if (status === "resolved") {
      updates.resolved_at = new Date().toISOString();
    }
  }

  const updated = Incident.update(req.params.id, updates);
  res.json({ incident: updated });
});

// POST /api/incidents/:id/updates - Add update to incident
router.post("/:id/updates", authMiddleware, async (req, res) => {
  const incident = Incident.findById(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: "Incident not found" });
  }

  const { status, message } = req.body;

  if (!message || message.trim().length < 1) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (status && !isValidIncidentStatus(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const update = Incident.addUpdate({
    incident_id: incident.id,
    status: status || incident.status,
    message: sanitizeString(message, 5000),
    created_by: req.user.id,
  });

  // If resolving, set resolved_at
  if (status === "resolved") {
    Incident.resolve(incident.id);
  }

  // Send notification about the update
  const monitor = incident.monitor_id ? Monitor.findById(incident.monitor_id) : null;
  await notifier.sendIncidentUpdate(monitor, incident, update);

  res.status(201).json({ update });
});

// POST /api/incidents/:id/resolve - Resolve incident
router.post("/:id/resolve", authMiddleware, async (req, res) => {
  const incident = Incident.findById(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: "Incident not found" });
  }

  if (incident.status === "resolved") {
    return res.status(400).json({ error: "Incident is already resolved" });
  }

  const update = Incident.addUpdate({
    incident_id: incident.id,
    status: "resolved",
    message: req.body.message || "Incident resolved",
    created_by: req.user.id,
  });

  const resolved = Incident.resolve(incident.id);

  // Send notification
  const monitor = incident.monitor_id ? Monitor.findById(incident.monitor_id) : null;
  await notifier.sendIncidentUpdate(monitor, resolved, update);

  res.json({ incident: resolved });
});

// DELETE /api/incidents/:id - Delete incident
router.delete("/:id", authMiddleware, (req, res) => {
  const incident = Incident.findById(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: "Incident not found" });
  }

  Incident.delete(req.params.id);
  res.json({ message: "Incident deleted" });
});

module.exports = router;
