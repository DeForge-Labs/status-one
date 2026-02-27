'use client';

import { useState, useEffect } from 'react';
import { getNotificationChannels, createNotificationChannel, deleteNotificationChannel, testNotificationChannel, updateNotificationChannel } from '@/lib/api';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { PageLoader } from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import ConfirmDialog from '@/components/confirm-dialog';
import { Plus, Bell, Trash2, Send, Pencil, Check, X } from 'lucide-react';

const channelTypes = [
  { value: 'email', label: 'Email' },
  { value: 'slack', label: 'Slack Webhook' },
  { value: 'discord', label: 'Discord Webhook' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'webhook', label: 'Custom Webhook' },
];

const configFields = {
  email: [{ key: 'email', label: 'Email Address', type: 'email', placeholder: 'alerts@example.com' }],
  slack: [{ key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...' }],
  discord: [{ key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/...' }],
  telegram: [
    { key: 'bot_token', label: 'Bot Token', placeholder: '123456:ABC-DEF...' },
    { key: 'chat_id', label: 'Chat ID', placeholder: '-1001234567890' },
  ],
  webhook: [
    { key: 'url', label: 'Webhook URL', placeholder: 'https://example.com/webhook' },
    { key: 'secret', label: 'Secret (optional)', placeholder: 'webhook-secret' },
  ],
};

export default function NotificationsPage() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'email', enabled: true, config: {} });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState({});

  const fetchChannels = async () => {
    try {
      const data = await getNotificationChannels();
      setChannels(data.channels || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchChannels(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await createNotificationChannel(form);
      setShowCreate(false);
      setForm({ name: '', type: 'email', enabled: true, config: {} });
      fetchChannels();
    } catch (err) {
      setError(err.message);
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await deleteNotificationChannel(deleteId); fetchChannels(); } catch {}
    setDeleting(false);
    setDeleteId(null);
  };

  const handleTest = async (channelId) => {
    setTesting(channelId);
    setTestResult({});
    try {
      const result = await testNotificationChannel(channelId);
      setTestResult({ [channelId]: { success: true } });
    } catch (err) {
      setTestResult({ [channelId]: { success: false, message: err.message } });
    }
    setTesting(null);
  };

  const handleToggle = async (channel) => {
    try {
      await updateNotificationChannel(channel.id, { enabled: !channel.enabled });
      fetchChannels();
    } catch {}
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Notifications</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Configure alert channels</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Add Channel</Button>
      </div>

      {channels.length === 0 ? (
        <EmptyState icon={Bell} title="No notification channels" description="Add a channel to receive alerts when monitors go down" action={{ label: 'Add Channel', onClick: () => setShowCreate(true) }} />
      ) : (
        <div className="space-y-2">
          {channels.map(ch => (
            <Card key={ch.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ch.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{ch.name}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{channelTypes.find(t => t.value === ch.type)?.label || ch.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {testResult[ch.id] && (
                    <span className={`text-xs mr-2 ${testResult[ch.id].success ? 'text-green-500' : 'text-red-500'}`}>
                      {testResult[ch.id].success ? 'Sent!' : testResult[ch.id].message}
                    </span>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleTest(ch.id)} disabled={testing === ch.id}>
                    <Send size={13} /> {testing === ch.id ? '...' : 'Test'}
                  </Button>
                  <button onClick={() => handleToggle(ch)} className={`p-1.5 rounded-lg transition-colors cursor-pointer ${ch.enabled ? 'text-green-500 hover:bg-green-500/10' : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)]'}`}>
                    {ch.enabled ? <Check size={14} /> : <X size={14} />}
                  </button>
                  <button onClick={() => setDeleteId(ch.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Notification Channel" size="md">
        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>}
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Channel Name *" placeholder="e.g. Team Slack" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <Select label="Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value, config: {} })}>
            {channelTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          {(configFields[form.type] || []).map(field => (
            <Input
              key={field.key}
              label={field.label}
              type={field.type || 'text'}
              placeholder={field.placeholder}
              value={form.config[field.key] || ''}
              onChange={e => setForm({ ...form, config: { ...form.config, [field.key]: e.target.value } })}
              required={!field.key.includes('optional') && !field.key.includes('secret')}
            />
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Channel'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Channel"
        message="This channel will no longer send notifications."
      />
    </div>
  );
}
