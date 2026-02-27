import { formatDistanceToNow, parseISO, format } from 'date-fns';

export function relativeTime(dateStr) {
  if (!dateStr) return 'Never';
  try {
    const date = dateStr.includes('T') ? parseISO(dateStr) : new Date(dateStr.replace(' ', 'T') + 'Z');
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function formatDate(dateStr, fmt = 'MMM d, yyyy HH:mm') {
  if (!dateStr) return '—';
  try {
    const date = dateStr.includes('T') ? parseISO(dateStr) : new Date(dateStr.replace(' ', 'T') + 'Z');
    return format(date, fmt);
  } catch {
    return dateStr;
  }
}

export function formatMs(ms) {
  if (ms == null || ms === 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function uptimeColor(pct) {
  if (pct >= 99) return 'text-green-500';
  if (pct >= 95) return 'text-yellow-500';
  return 'text-red-500';
}

export function uptimeBgColor(pct) {
  if (pct >= 99.5) return 'bg-green-500';
  if (pct >= 95) return 'bg-yellow-500';
  if (pct > 0) return 'bg-red-500';
  return 'bg-zinc-300 dark:bg-zinc-700';
}

export function statusColor(status) {
  switch (status) {
    case 'up': return 'bg-green-500';
    case 'down': return 'bg-red-500';
    case 'degraded': return 'bg-yellow-500';
    default: return 'bg-zinc-400';
  }
}

export function statusTextColor(status) {
  switch (status) {
    case 'up': return 'text-green-500';
    case 'down': return 'text-red-500';
    case 'degraded': return 'text-yellow-500';
    default: return 'text-zinc-400';
  }
}

export function statusLabel(status, active = true) {
  if (!active) return 'Paused';
  switch (status) {
    case 'up': return 'Up';
    case 'down': return 'Down';
    case 'degraded': return 'Degraded';
    default: return 'Unknown';
  }
}

export function incidentStatusColor(status) {
  switch (status) {
    case 'investigating': return 'bg-red-500';
    case 'identified': return 'bg-orange-500';
    case 'monitoring': return 'bg-blue-500';
    case 'resolved': return 'bg-green-500';
    default: return 'bg-zinc-400';
  }
}

export function overallStatusInfo(status) {
  switch (status) {
    case 'operational':
      return { label: 'All Systems Operational', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' };
    case 'degraded_performance':
      return { label: 'Degraded Performance', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
    case 'major_outage':
      return { label: 'Major Outage', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    case 'partial_outage':
      return { label: 'Partial Outage', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
    default:
      return { label: 'Unknown', color: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
  }
}

export function monitorTypeIcon(type) {
  switch (type) {
    case 'http': return 'Globe';
    case 'keyword': return 'Search';
    case 'ssl': return 'Lock';
    case 'ping': return 'Radio';
    case 'tcp': return 'Server';
    case 'dns': return 'Globe2';
    case 'push': return 'ArrowUpCircle';
    default: return 'Monitor';
  }
}

export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
