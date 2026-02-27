const dns = require("dns");
const { promisify } = require("util");

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);
const resolveCname = promisify(dns.resolveCname);
const resolveNs = promisify(dns.resolveNs);

async function checkDns(monitor) {
  const startTime = Date.now();
  const result = {
    status: "up",
    response_time_ms: 0,
    status_code: 0,
    error_message: "",
    metadata: {},
  };

  try {
    const hostname = monitor.hostname || (monitor.url ? new URL(monitor.url).hostname : "");
    const recordType = monitor.dns_record_type || "A";
    
    let records;
    switch (recordType.toUpperCase()) {
      case "A":
        records = await resolve4(hostname);
        break;
      case "AAAA":
        records = await resolve6(hostname);
        break;
      case "MX":
        records = await resolveMx(hostname);
        break;
      case "TXT":
        records = await resolveTxt(hostname);
        break;
      case "CNAME":
        records = await resolveCname(hostname);
        break;
      case "NS":
        records = await resolveNs(hostname);
        break;
      default:
        records = await resolve4(hostname);
    }

    result.response_time_ms = Date.now() - startTime;
    result.metadata.hostname = hostname;
    result.metadata.recordType = recordType;
    result.metadata.records = records;

    if (!records || records.length === 0) {
      result.status = "down";
      result.error_message = `No ${recordType} records found for ${hostname}`;
    } else if (monitor.degraded_threshold_ms && result.response_time_ms > monitor.degraded_threshold_ms) {
      result.status = "degraded";
    }
  } catch (err) {
    result.response_time_ms = Date.now() - startTime;
    result.status = "down";
    result.error_message = `DNS resolution failed: ${err.message}`;
  }

  return result;
}

module.exports = { checkDns };
