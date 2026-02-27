'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePolling } from '@/hooks/use-polling';
import { getMonitors, deleteMonitor, pauseMonitor, resumeMonitor } from '@/lib/api';
import Card from '@/components/ui/card';
import Badge, { StatusBadge } from '@/components/ui/badge';
import Button from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import ConfirmDialog from '@/components/confirm-dialog';
import { Plus, Monitor, Search, Pause, Play, Trash2, Edit, ExternalLink } from 'lucide-react';
import { relativeTime, formatMs, uptimeColor } from '@/lib/utils';
import clsx from 'clsx';

export default function MonitorsPage() {
  const { data, loading, refresh } = usePolling(getMonitors, 30000);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  if (loading && !data) return <PageLoader />;

  const monitors = data?.monitors || [];

  const filtered = monitors.filter(m => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.url?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all') {
      if (statusFilter === 'paused' && m.active) return false;
      if (statusFilter !== 'paused' && m.current_status !== statusFilter) return false;
    }
    if (typeFilter !== 'all' && m.type !== typeFilter) return false;
    return true;
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await deleteMonitor(deleteId); refresh(); } catch {}
    setDeleting(false);
    setDeleteId(null);
  };

  const handleToggle = async (monitor) => {
    try {
      if (monitor.active) await pauseMonitor(monitor.id);
      else await resumeMonitor(monitor.id);
      refresh();
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Monitors</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{monitors.length} monitor{monitors.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/monitors/new">
          <Button><Plus size={16} /> Add Monitor</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            placeholder="Search monitors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input)] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="all">All Status</option>
          <option value="up">Up</option>
          <option value="down">Down</option>
          <option value="degraded">Degraded</option>
          <option value="paused">Paused</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="all">All Types</option>
          <option value="http">HTTP</option>
          <option value="keyword">Keyword</option>
          <option value="ping">Ping</option>
          <option value="tcp">TCP</option>
          <option value="dns">DNS</option>
          <option value="push">Push</option>
          <option value="ssl">SSL</option>
        </select>
      </div>

      {/* Monitor List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="No monitors found"
          description={monitors.length === 0 ? "Create your first monitor to start tracking uptime" : "Try adjusting your filters"}
          action={monitors.length === 0 && <Link href="/monitors/new"><Button size="sm"><Plus size={14} /> Create Monitor</Button></Link>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((monitor) => (
            <Card key={monitor.id} className="p-0 overflow-hidden hover:border-[var(--color-text-tertiary)] transition-colors">
              <div className="flex items-center px-5 py-4">
                <Link href={`/monitors/${monitor.id}`} className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={clsx(
                    'w-3 h-3 rounded-full flex-shrink-0',
                    !monitor.active ? 'bg-zinc-400' :
                    monitor.current_status === 'up' ? 'bg-green-500' :
                    monitor.current_status === 'down' ? 'bg-red-500' :
                    monitor.current_status === 'degraded' ? 'bg-yellow-500' : 'bg-zinc-400'
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">{monitor.name}</p>
                      <Badge variant={monitor.active ? 'default' : 'paused'} className="text-[10px] px-1.5 py-0">
                        {monitor.type.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">{monitor.url || monitor.hostname || '—'}</p>
                  </div>
                </Link>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {monitor.tags?.length > 0 && (
                    <div className="hidden lg:flex gap-1">
                      {monitor.tags.slice(0, 2).map(tag => (
                        <span
                          key={tag.id}
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="hidden sm:block text-right min-w-[80px]">
                    <p className={clsx('text-sm font-medium', uptimeColor(monitor.uptime?.['24h']))}>
                      {monitor.uptime?.['24h'] != null ? `${monitor.uptime['24h'].toFixed(1)}%` : '—'}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">24h</p>
                  </div>
                  <div className="hidden md:block text-right min-w-[70px]">
                    <p className="text-sm text-[var(--color-text)]">{formatMs(monitor.last_response_time)}</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">Response</p>
                  </div>
                  <div className="hidden md:block text-right min-w-[80px]">
                    <p className="text-xs text-[var(--color-text-secondary)]">{relativeTime(monitor.last_check)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleToggle(monitor)} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] transition-colors cursor-pointer" title={monitor.active ? 'Pause' : 'Resume'}>
                      {monitor.active ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <Link href={`/monitors/${monitor.id}/edit`} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] transition-colors" title="Edit">
                      <Edit size={14} />
                    </Link>
                    <button onClick={() => setDeleteId(monitor.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors cursor-pointer" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Monitor"
        message="This will permanently delete this monitor and all its check history. This cannot be undone."
      />
    </div>
  );
}
