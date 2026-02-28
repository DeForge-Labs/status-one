'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getPublicStatusPage } from '@/lib/api';
import UptimeBar from '@/components/uptime-bar';
import { overallStatusInfo, relativeTime, formatMs, uptimeColor } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, Clock, ExternalLink, MessageSquare } from 'lucide-react';
import clsx from 'clsx';

const statusIcons = {
  up: CheckCircle2,
  down: XCircle,
  degraded: AlertTriangle,
  maintenance: MinusCircle,
  unknown: Clock,
};

export default function PublicStatusPage({ params }) {
  const { slug } = use(params);
  const [page, setPage] = useState(null);
  const [monitors, setMonitors] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [overallStatus, setOverallStatus] = useState('operational');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getPublicStatusPage(slug);
        setPage(data.statusPage);
        setMonitors(data.monitors || []);
        setIncidents(data.activeIncidents || []);
        setMessages(data.messages || []);
        setOverallStatus(data.overallStatus || 'operational');
      } catch (err) {
        setError('Status page not found');
      }
      setLoading(false);
    };
    fetch();

    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 animate-pulse">
        <div className="h-8 bg-[var(--color-border)] rounded w-48 mb-2" />
        <div className="h-4 bg-[var(--color-border)] rounded w-72 mb-8" />
        <div className="h-16 bg-[var(--color-border)] rounded-lg mb-8" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-[var(--color-border)] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text)]">404</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const statusInfo = overallStatusInfo(overallStatus);
  const iconMap = { operational: 'up', degraded_performance: 'degraded', major_outage: 'down', partial_outage: 'down' };
  const StatusIcon = statusIcons[iconMap[overallStatus] || 'unknown'] || Clock;

  const messageColors = {
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-600',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600',
    maintenance: 'bg-purple-500/10 border-purple-500/20 text-purple-600',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="text-center mb-8">
        {page?.logo_url && (
          <img src={page.logo_url} alt={page.title} className="h-10 mx-auto mb-4 object-contain" />
        )}
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{page?.name || 'Status'}</h1>
        {page?.description && (
          <p className="text-sm text-[var(--color-text-secondary)] mt-2">{page.description}</p>
        )}
      </div>

      {/* Overall Status Banner */}
      <div className={clsx(
        'rounded-xl p-5 mb-8 flex items-center gap-3',
        statusInfo.bg,
      )}>
        <StatusIcon
          size={24}
          className={statusInfo.color}
        />
        <div>
          <p className="text-lg font-semibold text-[var(--color-text)]">{statusInfo.label}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Last updated {new Date().toLocaleString()}
          </p>
        </div>
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div className="space-y-3 mb-8">
          {messages.map(msg => (
            <div key={msg.id} className={clsx('rounded-lg border p-4', messageColors[msg.type] || messageColors.info)}>
              <p className="font-medium text-sm">{msg.title}</p>
              {msg.body && <p className="text-xs mt-1 opacity-80">{msg.body}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Monitor List */}
      <div className="space-y-3">
        {monitors.map(monitor => {
          const status = monitor.current_status || 'unknown';
          const Icon = statusIcons[status] || Clock;
          const uptime = monitor.uptime_90d;
          return (
            <div key={monitor.id} className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon
                    size={16}
                    className={clsx(
                      status === 'up' && 'text-green-500',
                      status === 'degraded' && 'text-yellow-500',
                      status === 'down' && 'text-red-500',
                      !['up', 'degraded', 'down'].includes(status) && 'text-[var(--color-text-tertiary)]',
                    )}
                  />
                  <span className="text-sm font-medium text-[var(--color-text)] truncate">{monitor.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)] flex-shrink-0">
                  {uptime != null && (
                    <span className={uptimeColor(uptime)}>{uptime.toFixed(2)}%</span>
                  )}
                  {monitor.response_time_ms != null && (
                    <span>{formatMs(monitor.response_time_ms)}</span>
                  )}
                </div>
              </div>
              <UptimeBar days={monitor.daily_uptime} compact />
            </div>
          );
        })}
      </div>

      {/* Active Incidents */}
      {incidents.filter(i => i.status !== 'resolved').length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Active Incidents</h2>
          <div className="space-y-3">
            {incidents.filter(i => i.status !== 'resolved').map(incident => (
              <div key={incident.id} className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{incident.title}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      <span className="capitalize">{incident.status}</span> • Started {relativeTime(incident.started_at)}
                    </p>
                    {incident.updates?.length > 0 && (
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                        Latest: {incident.updates[0]?.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Resolved Incidents */}
      {incidents.filter(i => i.status === 'resolved').length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Recent Incidents</h2>
          <div className="space-y-2">
            {incidents.filter(i => i.status === 'resolved').slice(0, 5).map(incident => (
              <div key={incident.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                <div>
                  <p className="text-sm text-[var(--color-text)]">{incident.title}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">Resolved {relativeTime(incident.resolved_at)}</p>
                </div>
                <CheckCircle2 size={14} className="text-green-500" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Links */}
      <div className="mt-12 pt-6 border-t border-[var(--color-border)] flex items-center justify-center gap-6 text-xs text-[var(--color-text-tertiary)]">
        <Link href={`/status/${slug}/history`} className="hover:text-[var(--color-text-secondary)] transition-colors">Uptime History</Link>
        <Link href={`/status/${slug}/incidents`} className="hover:text-[var(--color-text-secondary)] transition-colors">Incident History</Link>
        <span>Powered by Status One</span>
      </div>
    </div>
  );
}
