'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePolling } from '@/hooks/use-polling';
import { getIncident, addIncidentUpdate, resolveIncident, deleteIncident, updateIncident } from '@/lib/api';
import Card from '@/components/ui/card';
import { IncidentStatusBadge } from '@/components/ui/badge';
import Button from '@/components/ui/button';
import Select from '@/components/ui/select';
import Textarea from '@/components/ui/textarea';
import { PageLoader } from '@/components/ui/spinner';
import ConfirmDialog from '@/components/confirm-dialog';
import { ArrowLeft, Trash2, CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { relativeTime, formatDate, incidentStatusColor } from '@/lib/utils';
import clsx from 'clsx';

export default function IncidentDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, loading, refresh } = usePolling(() => getIncident(id), 15000, [id]);
  const [updateForm, setUpdateForm] = useState({ status: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (loading && !data) return <PageLoader />;

  const incident = data?.incident;
  if (!incident) return <div className="text-center py-20 text-[var(--color-text-secondary)]">Incident not found</div>;

  const handleAddUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await addIncidentUpdate(id, {
        status: updateForm.status || incident.status,
        message: updateForm.message,
      });
      setUpdateForm({ status: '', message: '' });
      refresh();
    } catch (err) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  const handleResolve = async () => {
    try {
      await resolveIncident(id, 'Incident resolved.');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await deleteIncident(id); router.push('/incidents'); } catch {}
    setDeleting(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/incidents" className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] transition-colors mt-0.5">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--color-text)]">{incident.title}</h1>
              <IncidentStatusBadge status={incident.status} />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {incident.monitor_name && <span className="font-medium">{incident.monitor_name}</span>}
              {incident.monitor_name && ' · '}
              Started {formatDate(incident.started_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {incident.status !== 'resolved' && (
            <Button variant="outline" size="sm" onClick={handleResolve}>
              <CheckCircle size={14} /> Resolve
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Timeline</h3>
        <div className="space-y-0">
          {(incident.updates || []).length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">No updates yet</p>
          ) : (
            <div className="relative pl-6 border-l-2 border-[var(--color-border)] space-y-6">
              {incident.updates.map((update) => (
                <div key={update.id} className="relative">
                  <div className={clsx(
                    'absolute -left-[25px] w-3 h-3 rounded-full border-2 border-[var(--color-surface)]',
                    incidentStatusColor(update.status)
                  )} />
                  <div>
                    <div className="flex items-center gap-2">
                      <IncidentStatusBadge status={update.status} />
                      <span className="text-xs text-[var(--color-text-tertiary)]">{relativeTime(update.created_at)}</span>
                    </div>
                    {update.message && (
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1">{update.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Add Update */}
      {incident.status !== 'resolved' && (
        <Card>
          <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Add Update</h3>
          {error && <div className="mb-3 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>}
          <form onSubmit={handleAddUpdate} className="space-y-4">
            <Select label="Status" value={updateForm.status || incident.status} onChange={e => setUpdateForm(prev => ({ ...prev, status: e.target.value }))}>
              <option value="investigating">Investigating</option>
              <option value="identified">Identified</option>
              <option value="monitoring">Monitoring</option>
              <option value="resolved">Resolved</option>
            </Select>
            <Textarea
              label="Message *"
              placeholder="Describe the update..."
              value={updateForm.message}
              onChange={e => setUpdateForm(prev => ({ ...prev, message: e.target.value }))}
              required
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Posting...' : 'Post Update'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Incident"
        message="This will permanently delete this incident and all its updates."
      />
    </div>
  );
}
