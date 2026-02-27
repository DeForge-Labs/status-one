const express = require("express");
const router = express.Router();
const StatusPage = require("../models/statusPage");
const { authMiddleware } = require("../middleware/auth");
const { slugify } = require("../utils/helpers");
const { sanitizeString, isValidStatusPageMessageType } = require("../utils/validators");

// GET /api/status-pages - List all status pages
router.get("/", authMiddleware, (req, res) => {
  const pages = StatusPage.findAll();
  res.json({ statusPages: pages });
});

// GET /api/status-pages/:id - Get status page with monitors
router.get("/:id", authMiddleware, (req, res) => {
  const page = StatusPage.findById(req.params.id);
  if (!page) {
    return res.status(404).json({ error: "Status page not found" });
  }

  const monitors = StatusPage.getMonitors(page.id);
  const messages = StatusPage.getMessages(page.id);

  res.json({
    statusPage: {
      ...page,
      monitors,
      messages,
    },
  });
});

// POST /api/status-pages - Create status page
router.post("/", authMiddleware, (req, res) => {
  const { name, slug, description, logo_url, custom_css, theme, published, show_values, header_text, footer_text, custom_domain } = req.body;

  if (!name || name.trim().length < 1) {
    return res.status(400).json({ error: "Name is required" });
  }

  const pageSlug = slug ? slugify(slug) : slugify(name);
  if (!pageSlug) {
    return res.status(400).json({ error: "Invalid slug" });
  }

  // Check slug uniqueness
  const existing = StatusPage.findBySlug(pageSlug);
  if (existing) {
    return res.status(409).json({ error: "Slug already in use" });
  }

  // Check custom domain uniqueness if provided
  if (custom_domain && custom_domain.trim()) {
    const existingDomain = StatusPage.findByCustomDomain(custom_domain.trim());
    if (existingDomain) {
      return res.status(409).json({ error: "Custom domain already in use" });
    }
  }

  const page = StatusPage.create({
    name: sanitizeString(name, 200),
    slug: pageSlug,
    description: description || "",
    logo_url: logo_url || "",
    custom_css: custom_css || "",
    theme: theme || "light",
    published: !!published,
    show_values: show_values !== false,
    header_text: header_text || "",
    footer_text: footer_text || "",
    custom_domain: custom_domain ? custom_domain.trim() : "",
    created_by: req.user.id,
  });

  res.status(201).json({ statusPage: page });
});

// PUT /api/status-pages/:id - Update status page
router.put("/:id", authMiddleware, (req, res) => {
  const page = StatusPage.findById(req.params.id);
  if (!page) {
    return res.status(404).json({ error: "Status page not found" });
  }

  // Check slug uniqueness if changing
  if (req.body.slug && req.body.slug !== page.slug) {
    const newSlug = slugify(req.body.slug);
    const existing = StatusPage.findBySlug(newSlug);
    if (existing && existing.id !== page.id) {
      return res.status(409).json({ error: "Slug already in use" });
    }
    req.body.slug = newSlug;
  }

  // Check custom domain uniqueness if changing
  if (req.body.custom_domain !== undefined) {
    const domain = req.body.custom_domain.trim();
    if (domain) {
      const existingDomain = StatusPage.findByCustomDomain(domain);
      if (existingDomain && existingDomain.id !== page.id) {
        return res.status(409).json({ error: "Custom domain already in use" });
      }
    }
    req.body.custom_domain = domain;
  }

  const updated = StatusPage.update(req.params.id, req.body);
  res.json({ statusPage: updated });
});

// DELETE /api/status-pages/:id - Delete status page
router.delete("/:id", authMiddleware, (req, res) => {
  const page = StatusPage.findById(req.params.id);
  if (!page) {
    return res.status(404).json({ error: "Status page not found" });
  }

  StatusPage.delete(req.params.id);
  res.json({ message: "Status page deleted" });
});

// POST /api/status-pages/:id/monitors - Add monitor to status page
router.post("/:id/monitors", authMiddleware, (req, res) => {
  const page = StatusPage.findById(req.params.id);
  if (!page) {
    return res.status(404).json({ error: "Status page not found" });
  }

  const { monitor_id, display_name, sort_order } = req.body;
  if (!monitor_id) {
    return res.status(400).json({ error: "monitor_id is required" });
  }

  StatusPage.addMonitor(page.id, monitor_id, display_name || "", sort_order || 0);
  const monitors = StatusPage.getMonitors(page.id);
  res.json({ monitors });
});

// DELETE /api/status-pages/:id/monitors/:monitorId - Remove monitor from status page
router.delete("/:id/monitors/:monitorId", authMiddleware, (req, res) => {
  StatusPage.removeMonitor(req.params.id, req.params.monitorId);
  const monitors = StatusPage.getMonitors(req.params.id);
  res.json({ monitors });
});

// PUT /api/status-pages/:id/monitors/:monitorId/order - Update monitor order
router.put("/:id/monitors/:monitorId/order", authMiddleware, (req, res) => {
  const { sort_order } = req.body;
  StatusPage.updateMonitorOrder(req.params.id, req.params.monitorId, sort_order || 0);
  res.json({ message: "Order updated" });
});

// --- Status Page Messages ---

// GET /api/status-pages/:id/messages
router.get("/:id/messages", authMiddleware, (req, res) => {
  const messages = StatusPage.getMessages(req.params.id);
  res.json({ messages });
});

// POST /api/status-pages/:id/messages
router.post("/:id/messages", authMiddleware, (req, res) => {
  const page = StatusPage.findById(req.params.id);
  if (!page) {
    return res.status(404).json({ error: "Status page not found" });
  }

  const { title, body, type, pinned, published } = req.body;

  if (!title || title.trim().length < 1) {
    return res.status(400).json({ error: "Title is required" });
  }

  if (type && !isValidStatusPageMessageType(type)) {
    return res.status(400).json({ error: "Invalid message type" });
  }

  const message = StatusPage.createMessage({
    status_page_id: page.id,
    title: sanitizeString(title, 500),
    body: body || "",
    type: type || "info",
    pinned: !!pinned,
    published: published !== false,
    created_by: req.user.id,
  });

  res.status(201).json({ message });
});

// PUT /api/status-pages/:id/messages/:messageId
router.put("/:id/messages/:messageId", authMiddleware, (req, res) => {
  const updated = StatusPage.updateMessage(req.params.messageId, req.body);
  if (!updated) {
    return res.status(404).json({ error: "Message not found" });
  }
  res.json({ message: updated });
});

// DELETE /api/status-pages/:id/messages/:messageId
router.delete("/:id/messages/:messageId", authMiddleware, (req, res) => {
  StatusPage.deleteMessage(req.params.messageId);
  res.json({ message: "Message deleted" });
});

module.exports = router;
