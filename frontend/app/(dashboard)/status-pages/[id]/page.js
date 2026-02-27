'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  getStatusPage, updateStatusPage, addMonitorToStatusPage,
  removeMonitorFromStatusPage, getStatusPageMessages, addStatusPageMessage,
  deleteStatusPageMessage, getMonitors, deleteStatusPage,
} from '@/lib/api';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Textarea from '@/components/ui/textarea';
import Button from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import ConfirmDialog from '@/components/confirm-dialog';
import { ArrowLeft, Plus, Trash2, Eye, Grip, Save, X, MessageSquare, Monitor } from 'lucide-react';
import Link from 'next/link';
import { formatDate, relativeTime } from '@/lib/utils';

export default function StatusPageEditorPage({ params }) {
  const { id } = use(params);
  const router = useRouter();

  const [pageData, setPageData] = useState(null);
  const [pageMonitors, setPageMonitors] = useState([]);
  const [allMonitors, setAllMonitors] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [form, setForm] = useState({});
  const [newMessage, setNewMessage] = useState({ title: '', body: '', type: 'info' });
  const [addMonitorId, setAddMonitorId] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState('settings');

  const fetchAll = async () => {
    try {
      const [pg, msgs, all] = await Promise.all([
        getStatusPage(id),
        getStatusPageMessages(id),
        getMonitors(),
      ]);
      const sp = pg.statusPage;
      setPageData(sp);
      setForm({
        name: sp.name || '',
        slug: sp.slug || '',
        description: sp.description || '',
        logo_url: sp.logo_url || '',
        theme: sp.theme || 'light',
        published: sp.published || false,
        show_values: sp.show_values !== false,
        header_text: sp.header_text || '',
        footer_text: sp.footer_text || '',
      });
      setPageMonitors(sp.monitors || []);
      setMessages(msgs.messages || []);
      setAllMonitors(all.monitors || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateStatusPage(id, form);
      await fetchAll();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const handleAddMonitor = async () => {
    if (!addMonitorId) return;
    try {
      await addMonitorToStatusPage(id, addMonitorId, pageMonitors.length);
      setAddMonitorId('');
      await fetchAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveMonitor = async (monitorId) => {
    try {
      await removeMonitorFromStatusPage(id, monitorId);
      await fetchAll();
    } catch {}
  };

  const handleAddMessage = async (e) => {
    e.preventDefault();
    try {
      await addStatusPageMessage(id, newMessage);
      setNewMessage({ title: '', body: '', type: 'info' });
      await fetchAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    try {
      await deleteStatusPageMessage(id, msgId);
      await fetchAll();
    } catch {}
  };

  const handleDeletePage = async () => {
    setDeleting(true);
    try { await deleteStatusPage(id); router.push('/status-pages'); } catch {}
    setDeleting(false);
  };

  if (loading) return <PageLoader />;
  if (!pageData) return <div className="text-center py-20 text-[var(--color-text-secondary)]">Status page not found</div>;

  const availableMonitors = allMonitors.filter(m => !pageMonitors.some(pm => pm.monitor_id === m.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/status-pages" className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text)]">{pageData.name}</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">/status/{pageData.slug}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <a href={`/status/${pageData.slug}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm"><Eye size={14} /> Preview</Button>
          </a>
          <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {['settings', 'monitors', 'messages'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Settings Tab */}
      {tab === 'settings' && (
        <Card className="max-w-2xl">
          <div className="space-y-4">
            <Input label="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            <Input label="Slug *" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} required />
            <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <Input label="Logo URL" placeholder="https://example.com/logo.png" value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} />
            <Select label="Theme" value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value })}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
            <Input label="Header Text" placeholder="Welcome to our status page" value={form.header_text} onChange={e => setForm({ ...form, header_text: e.target.value })} />
            <Input label="Footer Text" placeholder="© 2025 Company" value={form.footer_text} onChange={e => setForm({ ...form, footer_text: e.target.value })} />
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} className="rounded" />
              <span className="text-sm text-[var(--color-text)]">Published</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.show_values} onChange={e => setForm({ ...form, show_values: e.target.checked })} className="rounded" />
              <span className="text-sm text-[var(--color-text)]">Show response time values</span>
            </label>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}><Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Monitors Tab */}
      {tab === 'monitors' && (
        <div className="space-y-4 max-w-2xl">
          <Card>
            <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Monitors on this page</h3>
            {pageMonitors.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No monitors added yet</p>
            ) : (
              <div className="space-y-2">
                {pageMonitors.map((m, i) => (
                  <div key={m.monitor_id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                    <div className="flex items-center gap-3">
                      <Grip size={14} className="text-[var(--color-text-tertiary)]" />
                      <span className="text-sm text-[var(--color-text)]">{m.display_name || m.monitor_name}</span>
                      <span className="text-xs text-[var(--color-text-tertiary)]">{m.monitor_type}</span>
                    </div>
                    <button onClick={() => handleRemoveMonitor(m.monitor_id)} className="p-1.5 rounded hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors cursor-pointer">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {availableMonitors.length > 0 && (
            <Card>
              <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Add a monitor</h3>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={addMonitorId} onChange={e => setAddMonitorId(e.target.value)}>
                    <option value="">Select a monitor...</option>
                    {availableMonitors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                </div>
                <Button onClick={handleAddMonitor} disabled={!addMonitorId}><Plus size={14} /> Add</Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Messages Tab */}
      {tab === 'messages' && (
        <div className="space-y-4 max-w-2xl">
          <Card>
            <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Add Message</h3>
            <form onSubmit={handleAddMessage} className="space-y-3">
              <Input label="Title *" placeholder="Scheduled maintenance" value={newMessage.title} onChange={e => setNewMessage({ ...newMessage, title: e.target.value })} required />
              <Textarea label="Body *" placeholder="We will be performing maintenance..." value={newMessage.body} onChange={e => setNewMessage({ ...newMessage, body: e.target.value })} required />
              <Select label="Type" value={newMessage.type} onChange={e => setNewMessage({ ...newMessage, type: e.target.value })}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="maintenance">Maintenance</option>
              </Select>
              <div className="flex justify-end">
                <Button type="submit"><MessageSquare size={14} /> Post Message</Button>
              </div>
            </form>
          </Card>

          {messages.length > 0 && (
            <Card>
              <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Messages</h3>
              <div className="space-y-3">
                {messages.map(msg => {
                  const colors = { info: 'bg-blue-500/10 border-blue-500/20', warning: 'bg-yellow-500/10 border-yellow-500/20', maintenance: 'bg-purple-500/10 border-purple-500/20' };
                  return (
                    <div key={msg.id} className={`p-3 rounded-lg border ${colors[msg.type] || colors.info}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text)]">{msg.title}</p>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{msg.body}</p>
                          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{relativeTime(msg.created_at)}</p>
                        </div>
                        <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 rounded hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDeletePage}
        loading={deleting}
        title="Delete Status Page"
        message="This will permanently delete this status page."
      />
    </div>
  );
}
