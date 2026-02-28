const express = require("express");
const router = express.Router();
const StatusPage = require("../models/statusPage");
const Monitor = require("../models/monitor");
const MonitorCheck = require("../models/monitorCheck");
const Incident = require("../models/incident");
const { daysAgo, dateToISO } = require("../utils/helpers");
const { validatePagination } = require("../utils/validators");

// GET /api/public/status/by-domain/:hostname - Lookup status page by custom domain
router.get("/status/by-domain/:hostname", (req, res) => {
  const page = StatusPage.findByCustomDomain(req.params.hostname);
  if (!page || !page.published) {
    return res.status(404).json({ error: "Status page not found" });
  }
  res.json({ slug: page.slug });
});

// GET /api/public/status/:slug - Public status page data
router.get("/status/:slug", (req, res) => {
  const page = StatusPage.findBySlug(req.params.slug);
  if (!page || !page.published) {
    return res.status(404).json({ error: "Status page not found" });
  }

  const pageMonitors = StatusPage.getMonitors(page.id);

  // Get current status for each monitor (including 30-day daily uptime)
  const monitors = pageMonitors.map((pm) => {
    const monitor = Monitor.findById(pm.monitor_id);
    const latest = MonitorCheck.getLatestByMonitorId(pm.monitor_id);
    const uptime90 = MonitorCheck.getUptimePercentage(pm.monitor_id, daysAgo(90));

    const dailyStats = MonitorCheck.getDailyStatsRange(
      pm.monitor_id,
      dateToISO(new Date(Date.now() - 30 * 86400000)),
      dateToISO(new Date())
    );

    return {
      id: pm.monitor_id,
      name: pm.display_name || pm.monitor_name,
      type: pm.monitor_type,
      sort_order: pm.sort_order,
      current_status: latest?.status || "unknown",
      last_check: latest?.created_at || null,
      response_time_ms: page.show_values ? (latest?.response_time_ms || 0) : undefined,
      uptime_90d: uptime90,
      daily_uptime: dailyStats.map((d) => ({
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

// GET /api/public/status/:slug/monitors - Public monitors for a status page
router.get("/status/:slug/monitors", (req, res) => {
  const page = StatusPage.findBySlug(req.params.slug);
  if (!page || !page.published) {
    return res.status(404).json({ error: "Status page not found" });
  }

  const pageMonitors = StatusPage.getMonitors(page.id);

  const monitors = pageMonitors.map((pm) => {
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

  res.json({ monitors });
});

// GET /api/public/status/:slug/messages - Public messages for a status page
router.get("/status/:slug/messages", (req, res) => {
  const page = StatusPage.findBySlug(req.params.slug);
  if (!page || !page.published) {
    return res.status(404).json({ error: "Status page not found" });
  }

  const messages = StatusPage.getMessages(page.id, { published: true, limit: 50 });

  res.json({
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

// Helpers for badge SVG generation
function badgeColor(uptime) {
  if (uptime >= 99.9) return "#4c1";
  if (uptime >= 99)   return "#97ca00";
  if (uptime >= 95)   return "#dfb317";
  if (uptime >= 90)   return "#fe7d37";
  return "#e05d44";
}

function buildBadgeSvg(label, value, color, style) {
  const FONT = "DejaVu Sans,Verdana,Geneva,sans-serif";

  if (style === "for-the-badge") {
    const L = label.toUpperCase();
    const V = value.toUpperCase();
    // ~7.5px per uppercase char + 20px padding each side
    const lw = Math.max(L.length * 7.5 + 40, 50);
    const vw = Math.max(V.length * 7.5 + 40, 40);
    const tw = lw + vw;
    const lx = Math.round(lw / 2);
    const vx = lw + Math.round(vw / 2);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="28">
  <g shape-rendering="crispEdges">
    <rect width="${lw}" height="28" fill="#555"/>
    <rect x="${lw}" width="${vw}" height="28" fill="${color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="bold" letter-spacing="1">
    <text x="${lx}" y="19" fill="#010101" fill-opacity=".3">${L}</text>
    <text x="${lx}" y="18">${L}</text>
    <text x="${vx}" y="19" fill="#010101" fill-opacity=".3">${V}</text>
    <text x="${vx}" y="18">${V}</text>
  </g>
</svg>`;
  }

  if (style === "plastic") {
    // height=18, rx=4, stronger top-to-bottom gradient
    const lw = 52;
    const vw = Math.max(value.length * 7 + 20, 30);
    const tw = lw + vw;
    const lx = Math.round(lw / 2);
    const vx = lw + Math.round(vw / 2);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="18">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0"  stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-opacity=".3"/>
    <stop offset="1"  stop-opacity=".5"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${tw}" height="18" rx="4" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="18" fill="#555"/>
    <rect x="${lw}" width="${vw}" height="18" fill="${color}"/>
    <rect width="${tw}" height="18" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="${FONT}" font-size="11">
    <text x="${lx}" y="14" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${lx}" y="13">${label}</text>
    <text x="${vx}" y="14" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${vx}" y="13">${value}</text>
  </g>
</svg>`;
  }

  if (style === "social") {
    // Rounded pill (rx=10), label in grey, value in blue tint, outlined value box
    const lw = Math.max(label.length * 6.5 + 16, 40);
    const vw = Math.max(value.length * 6.5 + 16, 30);
    const tw = lw + vw + 6; // small gap between panels
    const lx = Math.round(lw / 2);
    const vx = lw + 6 + Math.round(vw / 2);
    const valueColor = color === "#9f9f9f" ? "#9f9f9f" : "#4078c8";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="20">
  <linearGradient id="a" x2="0" y2="100%">
    <stop offset="0" stop-color="#fcfcfc" stop-opacity="0"/>
    <stop offset="1" stop-opacity=".15"/>
  </linearGradient>
  <rect x=".5" y=".5" width="${lw - 1}" height="19" rx="2" fill="#fafafa" stroke="#d5d5d5"/>
  <rect x="${lw + 5}.5" y=".5" width="${vw - 1}" height="19" rx="2" fill="${valueColor}" stroke="${valueColor}cc"/>
  <rect x="${lw + 5}.5" y=".5" width="${vw - 1}" height="19" rx="2" fill="url(#a)"/>
  <g fill="#333" text-anchor="middle" font-family="DejaVu Sans,Helvetica,Arial,sans-serif" font-size="11">
    <text x="${lx}" y="15">${label}</text>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Helvetica,Arial,sans-serif" font-size="11">
    <text x="${vx}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${vx}" y="14">${value}</text>
  </g>
</svg>`;
  }

  // flat (default) and flat-square
  const rx = style === "flat-square" ? 0 : 3;
  const lw = 52;
  const vw = Math.max(value.length * 7 + 20, 30);
  const tw = lw + vw;
  const lx = Math.round(lw / 2);
  const vx = lw + Math.round(vw / 2);
  const clipRect = rx > 0
    ? `<rect width="${tw}" height="20" rx="${rx}" fill="#fff"/>`
    : `<rect width="${tw}" height="20" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="20">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">${clipRect}</clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${vw}" height="20" fill="${color}"/>
    <rect width="${tw}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="${FONT}" font-size="11">
    <text x="${lx}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${lx}" y="14">${label}</text>
    <text x="${vx}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${vx}" y="14">${value}</text>
  </g>
</svg>`;
}

const VALID_STYLES = new Set(["flat", "flat-square", "plastic", "for-the-badge", "social"]);

// GET /api/public/monitors/:id/badge - Self-hosted uptime badge (SVG)
// ?style=flat|flat-square|plastic|for-the-badge|social  (default: flat)
router.get("/monitors/:id/badge", (req, res) => {
  const style = VALID_STYLES.has(req.query.style) ? req.query.style : "flat";
  const monitor = Monitor.findById(req.params.id);

  let label = "uptime";
  let value, color;

  if (!monitor) {
    value = "not found";
    color = "#9f9f9f";
  } else if (!monitor.active) {
    value = "paused";
    color = "#9f9f9f";
  } else {
    const uptime = MonitorCheck.getUptimePercentage(monitor.id, daysAgo(1));
    const latest = MonitorCheck.getLatestByMonitorId(monitor.id);
    if (!latest) {
      value = "no data";
      color = "#9f9f9f";
    } else {
      value = uptime.toFixed(2).replace(/\.?0+$/, "") + "%";
      color = badgeColor(uptime);
    }
  }

  res.set({
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    "Access-Control-Allow-Origin": "*",
  });
  res.send(buildBadgeSvg(label, value, color, style));
});

module.exports = router;
