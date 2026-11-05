'use client';

import { useState, useEffect } from 'react';
import {
  getMaintenanceWindows, createMaintenanceWindow, updateMaintenanceWindow, deleteMaintenanceWindow,
  getMonitors,
} from '@/lib/api';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import Select from '@/components/ui/select';
import Pagination from '@/components/ui/pagination';
import { PageLoader } from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import ConfirmDialog from '@/components/confirm-dialog';
import { Plus, Wrench, Trash2, Calendar, Clock, Pencil, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';

const RECURRING_MS = { daily: 86400000, weekly: 7 * 86400000 };

const EMPTY_FORM = { title: '', description: '', start_time: '', end_time: '', recurring: false, recurring_interval: 'weekly', monitor_ids: [] };

function toDatetimeLocal(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MaintenancePage() {
  const [windows, setWindows] = useState([]);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editWindow, setEditWindow] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [listError, setListError] = useState('');

  const fetchData = async () => {
    setListError('');
    try {
      const [mData, monData] = await Promise.all([getMaintenanceWindows({ page, limit: 20 }), getMonitors()]);
      // Deleting the last row on a later page would leave it empty; step back instead of showing a false empty state
      if ((mData.maintenance || []).length === 0 && page > 1) {
        setPage(page - 1);
        return;
      }
      setWindows(mData.maintenance || []);
      setPagination(mData.pagination);
      setMonitors(monData.monitors || []);
    } catch (err) {
      setListError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [page]);

  const openCreate = () => {
    setEditWindow(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (w) => {
    setEditWindow(w);
    setForm({
      title: w.title || '',
      description: w.description || '',
      start_time: toDatetimeLocal(w.start_time),
      end_time: toDatetimeLocal(w.end_time),
      recurring: !!w.recurring,
      recurring_interval: w.recurring_interval || 'weekly',
      monitor_ids: w.monitor_ids || [],
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title,
        description: form.description,
        start_time: form.start_time ? new Date(form.start_time).toISOString() : '',
        end_time: form.end_time ? new Date(form.end_time).toISOString() : '',
        recurring: form.recurring,
        recurring_interval: form.recurring ? form.recurring_interval : null,
        monitor_ids: form.monitor_ids,
      };
      if (editWindow) {
        await updateMaintenanceWindow(editWindow.id, payload);
      } else {
        await createMaintenanceWindow(payload);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await deleteMaintenanceWindow(deleteId); fetchData(); } catch (err) { setListError(err.message); }
    setDeleting(false);
    setDeleteId(null);
  };

  const toggleMonitor = (id) => {
    setForm(f => ({
      ...f,
      monitor_ids: f.monitor_ids.includes(id)
        ? f.monitor_ids.filter(m => m !== id)
        : [...f.monitor_ids, id],
    }));
  };

  if (loading) return <PageLoader />;

  const now = new Date();
  // Recurring windows are judged by their current or next occurrence, matching the backend
  const occurrence = (w) => {
    const start = new Date(w.start_time), end = new Date(w.end_time);
    const step = w.recurring && RECURRING_MS[w.recurring_interval];
    if (!step || end >= now) return { start, end };
    const k = Math.ceil((now - end) / step);
    return { start: new Date(+start + k * step), end: new Date(+end + k * step) };
  };
  const isActiveNow = (w) => { const o = occurrence(w); return w.active !== false && o.start <= now && o.end >= now; };
  const isPastNow = (w) => occurrence(w).end < now;
  const active = windows.filter(isActiveNow);
  const upcoming = windows.filter(w => !isActiveNow(w) && !isPastNow(w));
  const past = windows.filter(w => !isActiveNow(w) && isPastNow(w));

  const renderWindow = (w) => {
    const isActive = isActiveNow(w);
    const isPast = isPastNow(w);
    return (
      <Card key={w.id}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-[var(--color-text)]">{w.title}</p>
              {isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600 font-medium">Active</span>}
              {isPast && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">Completed</span>}
              {w.recurring && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium flex items-center gap-1">
                  <RefreshCw size={9} /> Recurring{w.recurring_interval ? ` · ${w.recurring_interval}` : ''}
                </span>
              )}
            </div>
            {w.description && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{w.description}</p>}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="text-xs text-[var(--color-text-tertiary)]">
                <Calendar size={11} className="inline mr-1" />
                {formatDate(w.start_time)} – {formatDate(w.end_time)}
              </span>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {w.is_global
                  ? 'All monitors'
                  : `${w.monitor_ids?.length || 0} monitor${w.monitor_ids?.length === 1 ? '' : 's'}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => openEdit(w)} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors cursor-pointer">
              <Pencil size={14} />
            </button>
            <button onClick={() => setDeleteId(w.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors cursor-pointer">
              <Trash2 size={14} />
            </button>
          </div>
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
        <Button onClick={openCreate}><Plus size={16} /> Schedule Maintenance</Button>
      </div>

      {listError && <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{listError}</div>}

      {windows.length === 0 ? (
        <EmptyState icon={Wrench} title="No maintenance windows" description="Schedule maintenance to let users know when you're working on things" />
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
          <Pagination pagination={pagination} onPageChange={setPage} />
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editWindow ? 'Edit Maintenance Window' : 'Schedule Maintenance'} size="md">
        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title *" placeholder="Database migration" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          <Textarea label="Description" placeholder="What will be affected..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Time *" type="datetime-local" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
            <Input label="End Time *" type="datetime-local" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="recurring"
              type="checkbox"
              checked={form.recurring}
              onChange={e => setForm({ ...form, recurring: e.target.checked })}
              className="rounded border-[var(--color-input-border)] accent-blue-500"
            />
            <label htmlFor="recurring" className="text-sm text-[var(--color-text)] cursor-pointer">Recurring maintenance</label>
          </div>
          {form.recurring && (
            <Select label="Repeats" value={form.recurring_interval} onChange={e => setForm({ ...form, recurring_interval: e.target.value })}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </Select>
          )}
          {monitors.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Affected Monitors</label>
              <p className="text-xs text-[var(--color-text-tertiary)] mb-1.5">
                {form.monitor_ids.length === 0 ? 'None selected: applies to All monitors' : `${form.monitor_ids.length} selected`}
              </p>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input)] divide-y divide-[var(--color-border)]">
                {monitors.map(m => (
                  <label key={m.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-colors">
                    <input
                      type="checkbox"
                      checked={form.monitor_ids.includes(m.id)}
                      onChange={() => toggleMonitor(m.id)}
                      className="rounded border-[var(--color-input-border)] accent-blue-500"
                    />
                    <span className="text-sm text-[var(--color-text)]">{m.name}</span>
                    <span className="text-xs text-[var(--color-text-tertiary)] ml-auto truncate max-w-[120px]">{m.url}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? (editWindow ? 'Saving...' : 'Scheduling...') : (editWindow ? 'Save Changes' : 'Schedule')}</Button>
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
