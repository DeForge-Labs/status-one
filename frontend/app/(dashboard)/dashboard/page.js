'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePolling } from '@/hooks/use-polling';
import { getAnalyticsOverview, getAnalyticsSummary } from '@/lib/api';
import Card from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import Button from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { Monitor, AlertTriangle, CheckCircle, ArrowUpRight, Activity, TrendingUp, Clock, Plus, Search, ShieldAlert } from 'lucide-react';
import { relativeTime, formatMs, uptimeColor } from '@/lib/utils';
import clsx from 'clsx';

// Problems first, then healthy, then monitors that are expected to be quiet.
const STATUS_RANK = { down: 0, degraded: 1, unknown: 2, up: 3, maintenance: 4, paused: 5 };

const FILTERS = [
  ['all', 'All status'],
  ['up', 'Up'],
  ['down', 'Down'],
  ['degraded', 'Degraded'],
  ['maintenance', 'Maintenance'],
  ['paused', 'Paused'],
];

const inputCls = 'text-sm rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500/40';

// One request for both endpoints so the page has a single loading/error/updated state.
async function fetchDashboard() {
  const [overview, summary] = await Promise.all([getAnalyticsOverview(), getAnalyticsSummary()]);
  return { monitors: overview?.monitors || [], summary: summary || {}, fetchedAt: Date.now() };
}

const pct = (v) => (v != null ? `${v.toFixed(2)}%` : '—');

function StatCard({ label, value, valueClass, hint, icon: Icon, tint, href }) {
  const body = (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm text-[var(--color-text-secondary)] truncate">{label}</p>
        <p className={clsx('text-2xl font-bold mt-1', valueClass || 'text-[var(--color-text)]')}>{value}</p>
        {hint && <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 truncate">{hint}</p>}
      </div>
      <div className={clsx('p-3 rounded-xl flex-shrink-0 hidden sm:block', tint.bg)}>
        <Icon size={22} className={tint.text} />
      </div>
    </div>
  );
  return (
    <Card className="p-4">
      {href ? <Link href={href} className="block -m-4 p-4 rounded-xl hover:bg-[var(--color-surface-hover)] transition-colors">{body}</Link> : body}
    </Card>
  );
}

function UptimeCell({ label, value, className }) {
  return (
    <div className={clsx('text-right w-16', className)}>
      <p className={clsx('text-sm font-medium', value != null ? uptimeColor(value) : 'text-[var(--color-text-tertiary)]')}>{pct(value)}</p>
      <p className="text-xs text-[var(--color-text-tertiary)]">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data, loading, error, refresh } = usePolling(fetchDashboard, 30000);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const monitors = useMemo(() => data?.monitors || [], [data]);

  const counts = useMemo(() => {
    const c = { up: 0, down: 0, degraded: 0, maintenance: 0, paused: 0 };
    for (const m of monitors) if (m.status in c) c[m.status]++;
    return c;
  }, [monitors]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monitors
      .filter((m) => (statusFilter === 'all' || m.status === statusFilter)
        && (!q || [m.name, m.url, m.hostname].some((f) => f?.toLowerCase().includes(q))))
      .sort((a, b) => (STATUS_RANK[a.status] ?? 2) - (STATUS_RANK[b.status] ?? 2) || a.name.localeCompare(b.name));
  }, [monitors, search, statusFilter]);

  if (loading && !data) return <PageLoader />;

  if (!data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load the dashboard"
        description={error?.message || 'The server could not be reached.'}
        action={<Button onClick={refresh}>Try again</Button>}
      />
    );
  }

  const { summary } = data;
  const updated = new Date(data.fetchedAt).toLocaleTimeString();
  const filtered = search.trim() !== '' || statusFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Dashboard</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 flex items-center gap-1.5">
            <Clock size={13} className="flex-shrink-0" /> Updated {updated}
          </p>
        </div>
        <Link href="/monitors/new" className="flex-shrink-0">
          <Button size="md"><Plus size={16} /> Add Monitor</Button>
        </Link>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <span>Couldn&apos;t refresh ({error.message || 'request failed'}). Showing data from {updated}.</span>
          <Button size="sm" variant="outline" onClick={refresh}>Retry</Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Monitors" value={monitors.length} icon={Monitor} tint={{ bg: 'bg-blue-500/10', text: 'text-blue-500' }}
          hint={counts.paused + counts.maintenance > 0 ? `${counts.paused} paused · ${counts.maintenance} maintenance` : undefined} />
        <StatCard label="Up" value={counts.up} valueClass="text-green-500" icon={CheckCircle} tint={{ bg: 'bg-green-500/10', text: 'text-green-500' }} />
        <StatCard label="Down" value={counts.down} valueClass={counts.down > 0 ? 'text-red-500' : undefined} icon={AlertTriangle} tint={{ bg: 'bg-red-500/10', text: 'text-red-500' }}
          hint={counts.degraded > 0 ? `${counts.degraded} degraded` : undefined} />
        <StatCard label="Active incidents" value={summary.activeIncidents ?? 0} valueClass={summary.activeIncidents > 0 ? 'text-orange-500' : undefined}
          icon={ShieldAlert} tint={{ bg: 'bg-orange-500/10', text: 'text-orange-500' }} href="/incidents" />
        <StatCard label="Uptime (24h)" value={pct(summary.uptime24h)} valueClass={summary.uptime24h != null ? uptimeColor(summary.uptime24h) : undefined}
          icon={TrendingUp} tint={{ bg: 'bg-purple-500/10', text: 'text-purple-500' }} />
        <StatCard label="Uptime (30d)" value={pct(summary.uptime30d)} valueClass={summary.uptime30d != null ? uptimeColor(summary.uptime30d) : undefined}
          icon={TrendingUp} tint={{ bg: 'bg-purple-500/10', text: 'text-purple-500' }} />
      </div>

      {/* Monitor List */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-[var(--color-border)] flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-[var(--color-text)] mr-auto" aria-live="polite">
            Monitors <span className="font-normal text-[var(--color-text-tertiary)]">({filtered ? `${visible.length} of ${monitors.length}` : monitors.length})</span>
          </h2>
          <div className="relative flex-1 sm:flex-none min-w-[160px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search monitors"
              placeholder="Search monitors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={clsx(inputCls, 'w-full sm:w-56 pl-9 pr-3 py-2 placeholder:text-[var(--color-text-tertiary)]')}
            />
          </div>
          <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={clsx(inputCls, 'px-3 py-2')}>
            {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={Activity}
            className="py-12"
            title={monitors.length === 0 ? 'No monitors yet' : 'No matching monitors'}
            description={monitors.length === 0 ? 'Create your first monitor to start tracking uptime' : 'Try a different search or status filter'}
            action={monitors.length === 0
              ? <Link href="/monitors/new"><Button size="sm"><Plus size={14} /> Create Monitor</Button></Link>
              : <Button size="sm" variant="outline" onClick={() => { setSearch(''); setStatusFilter('all'); }}>Clear filters</Button>}
          />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {visible.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/monitors/${m.id}`}
                  className="flex items-center gap-4 px-4 sm:px-6 py-3.5 hover:bg-[var(--color-surface-hover)] transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">{m.name}</p>
                      <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] uppercase">{m.type}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)] truncate">{m.url || m.hostname || m.type}</p>
                    <p className="lg:hidden mt-1 text-xs text-[var(--color-text-secondary)]">
                      <span className="sm:hidden">{pct(m.uptime_24h)} · </span>
                      {formatMs(m.response_time_ms || m.avg_response_time_24h)} · {relativeTime(m.last_check)}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                    <UptimeCell label="24h" value={m.uptime_24h} />
                    <UptimeCell label="7d" value={m.uptime_7d} className="hidden md:block" />
                    <UptimeCell label="30d" value={m.uptime_30d} className="hidden md:block" />
                    <div className="hidden lg:block text-right w-24">
                      <p className="text-sm font-medium text-[var(--color-text)]">{formatMs(m.response_time_ms || m.avg_response_time_24h)}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">{relativeTime(m.last_check)}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0"><StatusBadge status={m.status} active={m.active} /></div>
                  <ArrowUpRight size={16} className="hidden sm:block flex-shrink-0 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text)] transition-colors" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
