const { v4: uuidv4 } = require("uuid");

function generateId() {
  return uuidv4();
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function paginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

function parseStatusCodes(accepted) {
  // Accepts formats like "200-299" or "200,201,204" or "200-299,301,302"
  if (!accepted) return null;
  const ranges = [];
  const parts = accepted.split(",").map((s) => s.trim());
  for (const part of parts) {
    if (part.includes("-")) {
      const [min, max] = part.split("-").map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        ranges.push({ min, max });
      }
    } else {
      const code = Number(part);
      if (!isNaN(code)) {
        ranges.push({ min: code, max: code });
      }
    }
  }
  return ranges;
}

function isStatusCodeAccepted(statusCode, accepted) {
  const ranges = parseStatusCodes(accepted);
  if (!ranges || ranges.length === 0) {
    return statusCode >= 200 && statusCode < 300;
  }
  return ranges.some((r) => statusCode >= r.min && statusCode <= r.max);
}

function nowISO() {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

function dateToISO(date) {
  return date.toISOString().split("T")[0];
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().replace("T", " ").substring(0, 19);
}

module.exports = {
  generateId,
  slugify,
  paginationMeta,
  parseStatusCodes,
  isStatusCodeAccepted,
  nowISO,
  dateToISO,
  daysAgo,
};
