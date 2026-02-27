'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePolling } from '@/hooks/use-polling';
import { getIncidents, deleteIncident } from '@/lib/api';
import Card from '@/components/ui/card';
import { IncidentStatusBadge } from '@/components/ui/badge';
import Button from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import ConfirmDialog from '@/components/confirm-dialog';
import { Plus, AlertTriangle, Trash2, ArrowUpRight } from 'lucide-react';
import { relativeTime } from '@/lib/utils';

export default function IncidentsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const { data, loading, refresh } = usePolling(() => getIncidents({ page, limit: 20, ...(statusFilter && { status: statusFilter }) }), 30000, [page, statusFilter]);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  if (loading && !data) return <PageLoader />;

  const incidents = data?.incidents || [];
  const pagination = data?.pagination;

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await deleteIncident(deleteId); refresh(); } catch {}
    setDeleting(false);
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Incidents</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Track and manage incidents</p>
        </div>
        <Link href="/incidents/new">
          <Button><Plus size={16} /> Create Incident</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        {['', 'investigating', 'identified', 'monitoring', 'resolved'].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {incidents.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No incidents"
          description="All systems are running smoothly"
        />
      ) : (
        <div className="space-y-2">
          {incidents.map(incident => (
            <Card key={incident.id} className="p-0 overflow-hidden hover:border-[var(--color-text-tertiary)] transition-colors">
              <div className="flex items-center justify-between px-5 py-4">
                <Link href={`/incidents/${incident.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">{incident.title}</p>
                      <IncidentStatusBadge status={incident.status} />
                      {incident.type === 'auto' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">Auto</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                      {incident.monitor_name && <span>{incident.monitor_name} • </span>}
                      Started {relativeTime(incident.started_at)}
                      {incident.resolved_at && ` • Resolved ${relativeTime(incident.resolved_at)}`}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setDeleteId(incident.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                  <Link href={`/incidents/${incident.id}`} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] transition-colors">
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={setPage} />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Incident"
        message="This will permanently delete this incident and all its updates."
      />
    </div>
  );
}
