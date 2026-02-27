'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePolling } from '@/hooks/use-polling';
import { getMonitor, getMonitorChecks, getMonitorResponseTimes, deleteMonitor, pauseMonitor, resumeMonitor, testMonitor, getAnalyticsAvailability } from '@/lib/api';
import Card, { CardTitle } from '@/components/ui/card';
import Badge, { StatusBadge } from '@/components/ui/badge';
import Button from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import Pagination from '@/components/ui/pagination';
import ConfirmDialog from '@/components/confirm-dialog';
import ResponseTimeChart from '@/components/response-chart';
import UptimeBar from '@/components/uptime-bar';
import { ArrowLeft, Edit, Trash2, Pause, Play, Zap, Clock, Globe, Server, Lock, Radio, Search, ArrowUpCircle, Share2, Copy, ExternalLink } from 'lucide-react';
import { relativeTime, formatMs, uptimeColor, formatDate } from '@/lib/utils';
import clsx from 'clsx';

const typeIcons = { http: Globe, keyword: Search, ssl: Lock, ping: Radio, tcp: Server, dns: Share2, push: ArrowUpCircle };

export default function MonitorDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [period, setPeriod] = useState('24h');
  const [checksPage, setChecksPage] = useState(1);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { data: monitorData, loading, refresh } = usePolling(() => getMonitor(id), 15000, [id]);
  const { data: checksData, refresh: refreshChecks } = usePolling(() => getMonitorChecks(id, checksPage, 20), 15000, [id, checksPage]);
  const { data: rtData } = usePolling(() => getMonitorResponseTimes(id, period), 30000, [id, period]);
  const [availData, setAvailData] = useState(null);

  useEffect(() => {
    getAnalyticsAvailability(id, 90).then(setAvailData).catch(() => {});
  }, [id]);

  if (loading && !monitorData) return <PageLoader />;

  const monitor = monitorData?.monitor;
  if (!monitor) return <div className="text-center py-20 text-[var(--color-text-secondary)]">Monitor not found</div>;

  const TypeIcon = typeIcons[monitor.type] || Globe;

  const handleDelete = async () => {
    setDeleting(true);
    try { await deleteMonitor(id); router.push('/monitors'); } catch {}
    setDeleting(false);
  };

  const handleToggle = async () => {
    try {
      if (monitor.active) await pauseMonitor(id);
      else await resumeMonitor(id);
      refresh();
    } catch {}
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testMonitor(id);
      setTestResult(res.result);
    } catch (err) {
      setTestResult({ status: 'error', error_message: err.message });
    }
    setTesting(false);
  };

  const uptime = monitor.uptime || {};
  const checks = checksData?.checks || [];
  const pagination = checksData?.pagination;
  const uptimeDays = availData?.data?.daily || [];

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
  const heartbeatUrl = monitor.type === 'push' && monitor.push_token ? `${API_BASE.replace('/api', '')}/api/monitors/heartbeat/${monitor.push_token}` : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/monitors" className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="p-2 rounded-lg bg-[var(--color-bg-tertiary)]">
            <TypeIcon size={20} className="text-[var(--color-text-secondary)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--color-text)]">{monitor.name}</h1>
              <StatusBadge status={monitor.current_status} active={monitor.active} />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">{monitor.url || monitor.hostname || monitor.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
            <Zap size={14} /> {testing ? 'Testing...' : 'Test'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleToggle}>
            {monitor.active ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}
          </Button>
          <Link href={`/monitors/${id}/edit`}>
            <Button variant="outline" size="sm"><Edit size={14} /> Edit</Button>
          </Link>
          <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <Card className={clsx('p-4', testResult.status === 'up' ? 'border-green-500/50' : 'border-red-500/50')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Test Result: <span className={testResult.status === 'up' ? 'text-green-500' : 'text-red-500'}>{testResult.status}</span></p>
              {testResult.response_time_ms != null && <p className="text-xs text-[var(--color-text-secondary)]">Response: {formatMs(testResult.response_time_ms)} • Status: {testResult.status_code}</p>}
              {testResult.error_message && <p className="text-xs text-red-500 mt-1">{testResult.error_message}</p>}
            </div>
            <button onClick={() => setTestResult(null)} className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] cursor-pointer">Dismiss</button>
          </div>
        </Card>
      )}

      {/* Push Monitor Heartbeat URL */}
      {heartbeatUrl && (
        <Card className="p-4">
          <p className="text-sm font-medium text-[var(--color-text)] mb-2">Heartbeat URL</p>
          <div className="flex items-center gap-2 bg-[var(--color-bg-tertiary)] rounded-lg px-3 py-2">
            <code className="text-xs text-[var(--color-text-secondary)] flex-1 truncate">{heartbeatUrl}</code>
            <button onClick={() => navigator.clipboard.writeText(heartbeatUrl)} className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] cursor-pointer">
              <Copy size={14} />
            </button>
          </div>
        </Card>
      )}

      {/* Uptime Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {['24h', '7d', '30d', '90d'].map(period => (
          <Card key={period} className="p-4 text-center">
            <p className={clsx('text-xl font-bold', uptimeColor(uptime[period]))}>
              {uptime[period] != null ? `${uptime[period].toFixed(2)}%` : '—'}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{period} uptime</p>
          </Card>
        ))}
      </div>

      {/* Uptime Bar */}
      <Card>
        <CardTitle>Uptime History (90d)</CardTitle>
        <div className="mt-4">
          <UptimeBar days={uptimeDays} />
        </div>
      </Card>

      {/* Response Time Chart */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Response Time</CardTitle>
          <div className="flex gap-1">
            {['1h', '24h', '7d', '30d'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={clsx(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                  period === p ? 'bg-blue-600 text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <ResponseTimeChart data={rtData?.series || []} />
      </Card>

      {/* Recent Checks */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-semibold text-[var(--color-text)]">Recent Checks</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="text-left px-6 py-3 text-xs font-medium text-[var(--color-text-secondary)]">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[var(--color-text-secondary)]">Response Time</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[var(--color-text-secondary)] hidden sm:table-cell">Status Code</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[var(--color-text-secondary)] hidden md:table-cell">Error</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-[var(--color-text-secondary)]">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {checks.map(check => (
                <tr key={check.id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                  <td className="px-6 py-3"><StatusBadge status={check.status} /></td>
                  <td className="px-6 py-3 text-[var(--color-text)]">{formatMs(check.response_time_ms)}</td>
                  <td className="px-6 py-3 text-[var(--color-text-secondary)] hidden sm:table-cell">{check.status_code || '—'}</td>
                  <td className="px-6 py-3 text-red-500 text-xs truncate max-w-[200px] hidden md:table-cell">{check.error_message || '—'}</td>
                  <td className="px-6 py-3 text-right text-xs text-[var(--color-text-secondary)]">{relativeTime(check.created_at)}</td>
                </tr>
              ))}
              {checks.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-[var(--color-text-tertiary)]">No checks yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 pb-4">
          <Pagination pagination={pagination} onPageChange={setChecksPage} />
        </div>
      </Card>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Monitor"
        message="This will permanently delete this monitor, all check history, and associated data."
      />
    </div>
  );
}
