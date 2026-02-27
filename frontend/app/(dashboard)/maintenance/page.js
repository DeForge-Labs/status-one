'use client';

import { useState, useEffect } from 'react';
import {
  getMaintenanceWindows, createMaintenanceWindow, updateMaintenanceWindow, deleteMaintenanceWindow,
} from '@/lib/api';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { PageLoader } from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import ConfirmDialog from '@/components/confirm-dialog';
import { Plus, Wrench, Trash2, Calendar, CheckCircle, Clock } from 'lucide-react';
import { formatDate, relativeTime } from '@/lib/utils';

export default function MaintenancePage() {
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', starts_at: '', ends_at: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchWindows = async () => {
    try {
      const data = await getMaintenanceWindows();
      setWindows(data.maintenance_windows || data.windows || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchWindows(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await createMaintenanceWindow(form);
      setShowCreate(false);
      setForm({ title: '', description: '', starts_at: '', ends_at: '' });
      fetchWindows();
    } catch (err) {
      setError(err.message);
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await deleteMaintenanceWindow(deleteId); fetchWindows(); } catch {}
    setDeleting(false);
    setDeleteId(null);
  };

  if (loading) return <PageLoader />;

  const now = new Date();
  const active = windows.filter(w => new Date(w.starts_at) <= now && new Date(w.ends_at) >= now);
  const upcoming = windows.filter(w => new Date(w.starts_at) > now);
  const past = windows.filter(w => new Date(w.ends_at) < now);

  const renderWindow = (w) => {
    const isActive = new Date(w.starts_at) <= now && new Date(w.ends_at) >= now;
    const isPast = new Date(w.ends_at) < now;
    return (
      <Card key={w.id}>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-[var(--color-text)]">{w.title}</p>
              {isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600 font-medium">Active</span>}
              {isPast && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">Completed</span>}
            </div>
            {w.description && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{w.description}</p>}
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-[var(--color-text-tertiary)]">
                <Calendar size={11} className="inline mr-1" />
                {formatDate(w.starts_at)} – {formatDate(w.ends_at)}
              </span>
            </div>
          </div>
          <button onClick={() => setDeleteId(w.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors cursor-pointer">
            <Trash2 size={14} />
          </button>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Maintenance</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Schedule maintenance windows</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Schedule Maintenance</Button>
      </div>

      {windows.length === 0 ? (
        <EmptyState icon={Wrench} title="No maintenance windows" description="Schedule maintenance to let users know when you&apos;re working on things" />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-yellow-600 mb-3 flex items-center gap-2"><Clock size={14} /> Active Now</h2>
              <div className="space-y-2">{active.map(renderWindow)}</div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">Upcoming</h2>
              <div className="space-y-2">{upcoming.map(renderWindow)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-tertiary)] mb-3">Past</h2>
              <div className="space-y-2">{past.map(renderWindow)}</div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Schedule Maintenance" size="md">
        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>}
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Title *" placeholder="Database migration" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          <Textarea label="Description" placeholder="What will be affected..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Input label="Start Time *" type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} required />
          <Input label="End Time *" type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} required />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={creating}>{creating ? 'Scheduling...' : 'Schedule'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Maintenance Window"
        message="This will remove this maintenance window."
      />
    </div>
  );
}
