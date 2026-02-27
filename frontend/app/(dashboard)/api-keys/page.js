'use client';

import { useState, useEffect } from 'react';
import { getApiKeys, createApiKey, deleteApiKey } from '@/lib/api';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { PageLoader } from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import ConfirmDialog from '@/components/confirm-dialog';
import { Plus, Key, Trash2, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { relativeTime, formatDate } from '@/lib/utils';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', expires_in_days: 0 });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    try {
      const data = await getApiKeys();
      setKeys(data.api_keys || data.keys || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const data = await createApiKey({
        name: form.name,
        expires_in_days: form.expires_in_days > 0 ? form.expires_in_days : undefined,
      });
      setNewKey(data.api_key || data.key);
      setForm({ name: '', expires_in_days: 0 });
      fetchKeys();
    } catch (err) {
      setError(err.message);
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await deleteApiKey(deleteId); fetchKeys(); } catch {}
    setDeleting(false);
    setDeleteId(null);
  };

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(typeof newKey === 'string' ? newKey : newKey.key || newKey.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">API Keys</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Manage API key access</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setNewKey(null); }}><Plus size={16} /> Create Key</Button>
      </div>

      {keys.length === 0 ? (
        <EmptyState icon={Key} title="No API keys" description="Create an API key to access the API programmatically" />
      ) : (
        <div className="space-y-2">
          {keys.map(k => (
            <Card key={k.id}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Key size={14} className="text-[var(--color-text-tertiary)]" />
                    <p className="text-sm font-medium text-[var(--color-text)]">{k.name}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-[var(--color-text-tertiary)] font-mono">{k.key_preview || k.prefix || '••••••••'}</span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">Created {relativeTime(k.created_at)}</span>
                    {k.last_used_at && <span className="text-xs text-[var(--color-text-tertiary)]">Last used {relativeTime(k.last_used_at)}</span>}
                    {k.expires_at && (
                      <span className={`text-xs ${new Date(k.expires_at) < new Date() ? 'text-red-500' : 'text-[var(--color-text-tertiary)]'}`}>
                        Expires {formatDate(k.expires_at)}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setDeleteId(k.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors cursor-pointer">
                  <Trash2 size={14} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setNewKey(null); }} title={newKey ? 'API Key Created' : 'Create API Key'} size="md">
        {newKey ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-600 font-medium mb-2">Copy this key now. You won&apos;t be able to see it again.</p>
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs bg-[var(--color-bg-tertiary)] px-3 py-2 rounded flex-1 overflow-x-auto text-[var(--color-text)]">
                  {typeof newKey === 'string' ? newKey : newKey.key || newKey.token}
                </code>
                <Button variant="outline" size="sm" onClick={copyKey}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => { setShowCreate(false); setNewKey(null); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <Input label="Name *" placeholder="My integration" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              <Input label="Expires in (days)" type="number" min="0" placeholder="0 = never expires" value={form.expires_in_days} onChange={e => setForm({ ...form, expires_in_days: parseInt(e.target.value) || 0 })} />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Key'}</Button>
              </div>
            </form>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Revoke Key"
        message="This key will be permanently revoked and can no longer be used for API access."
      />
    </div>
  );
}
