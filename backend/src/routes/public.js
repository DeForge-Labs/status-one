const express = require("express");
const router = express.Router();
const StatusPage = require("../models/statusPage");
const Monitor = require("../models/monitor");
const MonitorCheck = require("../models/monitorCheck");
const Incident = require("../models/incident");
const { daysAgo, dateToISO } = require("../utils/helpers");
const { validatePagination } = require("../utils/validators");

// GET /api/public/status/:slug - Public status page data
router.get("/status/:slug", (req, res) => {
  const page = StatusPage.findBySlug(req.params.slug);
  if (!page || !page.published) {
    return res.status(404).json({ error: "Status page not found" });
  }

  const pageMonitors = StatusPage.getMonitors(page.id);

  // Get current status for each monitor
  const monitors = pageMonitors.map((pm) => {
    const monitor = Monitor.findById(pm.monitor_id);
    const latest = MonitorCheck.getLatestByMonitorId(pm.monitor_id);
    const uptime90 = MonitorCheck.getUptimePercentage(pm.monitor_id, daysAgo(90));

    return {
      id: pm.monitor_id,
      name: pm.display_name || pm.monitor_name,
      type: pm.monitor_type,
      sort_order: pm.sort_order,
      current_status: latest?.status || "unknown",
      last_check: latest?.created_at || null,
      response_time_ms: page.show_values ? (latest?.response_time_ms || 0) : undefined,
      uptime_90d: uptime90,
    };
  });

  // Get active incidents for this page's monitors
  const monitorIds = pageMonitors.map((pm) => pm.monitor_id);
  const activeIncidents = Incident.findAll({ status: "investigating" })
    .concat(Incident.findAll({ status: "identified" }))
    .concat(Incident.findAll({ status: "monitoring" }))
    .filter((inc) => !inc.monitor_id || monitorIds.includes(inc.monitor_id));

  // Determine overall status
  let overallStatus = "operational";
  const hasDown = monitors.some((m) => m.current_status === "down");
  const hasDegraded = monitors.some((m) => m.current_status === "degraded");
  if (hasDown) overallStatus = "major_outage";
  else if (hasDegraded) overallStatus = "degraded_performance";
  else if (activeIncidents.length > 0) overallStatus = "partial_outage";

  // Get published messages
  const messages = StatusPage.getMessages(page.id, { published: true, limit: 10 });

  res.json({
    statusPage: {
      name: page.name,
      slug: page.slug,
      description: page.description,
      logo_url: page.logo_url,
      theme: page.theme,
      custom_css: page.custom_css,
      header_text: page.header_text,
      footer_text: page.footer_text,
    },
    overallStatus,
    monitors,
    activeIncidents: activeIncidents.map((inc) => ({
      id: inc.id,
      title: inc.title,
      status: inc.status,
      started_at: inc.started_at,
      updates: Incident.getUpdates(inc.id),
    })),
    messages: messages.map((msg) => ({
      id: msg.id,
      title: msg.title,
      body: msg.body,
      type: msg.type,
      pinned: msg.pinned,
      created_at: msg.created_at,
    })),
  });
});

// GET /api/public/status/:slug/history - 90-day uptime history
router.get("/status/:slug/history", (req, res) => {
  const page = StatusPage.findBySlug(req.params.slug);
  if (!page || !page.published) {
    return res.status(404).json({ error: "Status page not found" });
  }

  const days = Math.min(parseInt(req.query.days) || 90, 365);
  const pageMonitors = StatusPage.getMonitors(page.id);

  const history = pageMonitors.map((pm) => {
    const dailyStats = MonitorCheck.getDailyStatsRange(
      pm.monitor_id,
      dateToISO(new Date(Date.now() - days * 86400000)),
      dateToISO(new Date())
    );

    return {
      monitor_id: pm.monitor_id,
      name: pm.display_name || pm.monitor_name,
      days: dailyStats.map((d) => ({
        date: d.date,
        uptime: d.total_checks > 0
          ? parseFloat((((d.up_count + d.degraded_count) / d.total_checks) * 100).toFixed(2))
          : 100,
        avg_response_time: Math.round(d.avg_response_time),
        total_checks: d.total_checks,
        down_count: d.down_count,
      })),
    };
  });

  res.json({ history, days });
});

// GET /api/public/status/:slug/incidents - Public incident list
router.get("/status/:slug/incidents", (req, res) => {
  const page = StatusPage.findBySlug(req.params.slug);
  if (!page || !page.published) {
    return res.status(404).json({ error: "Status page not found" });
  }

  const { page: pageNum, limit, offset } = validatePagination(req.query);
  const monitorIds = StatusPage.getMonitorIds(page.id);

  const incidents = Incident.getForMonitorIds(monitorIds, { limit, offset });
  const enriched = incidents.map((inc) => ({
    id: inc.id,
    title: inc.title,
    status: inc.status,
    type: inc.type,
    started_at: inc.started_at,
    resolved_at: inc.resolved_at,
    updates: Incident.getUpdates(inc.id).map((u) => ({
      status: u.status,
      message: u.message,
      created_at: u.created_at,
    })),
  }));

  res.json({ incidents: enriched });
});

module.exports = router;
