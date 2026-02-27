'use client';

import { usePolling } from '@/hooks/use-polling';
import { getAnalyticsOverview, getAnalyticsSummary } from '@/lib/api';
import Card from '@/components/ui/card';
import Badge, { StatusBadge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/spinner';
import Link from 'next/link';
import { Monitor, AlertTriangle, CheckCircle, ArrowUpRight, Activity, TrendingUp, Clock, Plus } from 'lucide-react';
import Button from '@/components/ui/button';
import { relativeTime, formatMs, uptimeColor } from '@/lib/utils';
import clsx from 'clsx';

export default function DashboardPage() {
  const { data: overview, loading: loadingOverview } = usePolling(getAnalyticsOverview, 30000);
  const { data: summary, loading: loadingSummary } = usePolling(getAnalyticsSummary, 30000);

  if (loadingOverview && !overview) return <PageLoader />;

  const stats = summary || {};
  const monitors = overview?.monitors || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Dashboard</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Overview of all your monitors</p>
        </div>
        <Link href="/monitors/new">
          <Button size="md"><Plus size={16} /> Add Monitor</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Total Monitors</p>
              <p className="text-2xl font-bold text-[var(--color-text)] mt-1">{stats.totalMonitors || monitors.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10">
              <Monitor size={22} className="text-blue-500" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Up</p>
              <p className="text-2xl font-bold text-green-500 mt-1">{stats.monitorsByStatus?.up || monitors.filter(m => m.current_status === 'up').length}</p>
            </div>
            <div className="p-3 rounded-xl bg-green-500/10">
              <CheckCircle size={22} className="text-green-500" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Down</p>
              <p className="text-2xl font-bold text-red-500 mt-1">{stats.monitorsByStatus?.down || monitors.filter(m => m.current_status === 'down').length}</p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Uptime (24h)</p>
              <p className={clsx('text-2xl font-bold mt-1', uptimeColor(stats.uptime24h || 100))}>
                {stats.uptime24h != null ? `${stats.uptime24h.toFixed(2)}%` : '—'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10">
              <TrendingUp size={22} className="text-purple-500" />
            </div>
          </div>
        </Card>
      </div>

      {/* Monitor List */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">All Monitors</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {monitors.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Activity size={40} className="text-[var(--color-text-tertiary)] mx-auto mb-3" />
              <p className="text-[var(--color-text-secondary)]">No monitors yet</p>
              <Link href="/monitors/new">
                <Button size="sm" className="mt-3"><Plus size={14} /> Create Monitor</Button>
              </Link>
            </div>
          ) : (
            monitors.map((monitor) => (
              <Link
                key={monitor.id}
                href={`/monitors/${monitor.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-surface-hover)] transition-colors group"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={clsx(
                    'w-2.5 h-2.5 rounded-full flex-shrink-0',
                    monitor.current_status === 'up' ? 'bg-green-500' :
                    monitor.current_status === 'down' ? 'bg-red-500' :
                    monitor.current_status === 'degraded' ? 'bg-yellow-500' : 'bg-zinc-400'
                  )} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{monitor.name}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)] truncate">{monitor.url || monitor.hostname || monitor.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0">
                  <div className="hidden sm:block text-right">
                    <p className={clsx('text-sm font-medium', uptimeColor(monitor.uptime_24h))}>
                      {monitor.uptime_24h != null ? `${monitor.uptime_24h.toFixed(2)}%` : '—'}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">24h uptime</p>
                  </div>
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-medium text-[var(--color-text)]">{formatMs(monitor.response_time_ms || monitor.avg_response_time_24h)}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Avg response</p>
                  </div>
                  <div className="hidden lg:block text-right">
                    <p className="text-xs text-[var(--color-text-secondary)]">{relativeTime(monitor.last_check)}</p>
                  </div>
                  <ArrowUpRight size={16} className="text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text)] transition-colors" />
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
