'use client';

import { useState, useEffect } from 'react';
import { getUsers, createUser, deleteUser, updateUser } from '@/lib/api';
import { useAuth } from '@/contexts/auth';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { PageLoader } from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import ConfirmDialog from '@/components/confirm-dialog';
import { Plus, Users, Trash2, Shield, User, UserCheck } from 'lucide-react';
import { relativeTime } from '@/lib/utils';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data.users || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await createUser(form);
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'viewer' });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await deleteUser(deleteId); fetchUsers(); } catch {}
    setDeleting(false);
    setDeleteId(null);
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await updateUser(userId, { role });
      fetchUsers();
    } catch {}
  };

  if (loading) return <PageLoader />;

  const roleIcon = (role) => {
    if (role === 'admin') return <Shield size={14} className="text-blue-500" />;
    if (role === 'editor') return <UserCheck size={14} className="text-green-500" />;
    return <User size={14} className="text-[var(--color-text-tertiary)]" />;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Users</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Manage user accounts</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Add User</Button>
      </div>

      {users.length === 0 ? (
        <EmptyState icon={Users} title="No users" description="Something went wrong loading users" />
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <Card key={u.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-xs font-semibold text-[var(--color-text-secondary)]">
                    {u.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">{u.name}</p>
                      {roleIcon(u.role)}
                      {u.id === currentUser?.id && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">You</span>}
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {u.id !== currentUser?.id && (
                    <>
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        className="text-xs px-2 py-1 rounded border border-[var(--color-input-border)] bg-[var(--color-input)] text-[var(--color-text)] cursor-pointer"
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button onClick={() => setDeleteId(u.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create User Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add User" size="md">
        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>}
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Name *" placeholder="John Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email *" type="email" placeholder="john@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <Input label="Password *" type="password" placeholder="Minimum 8 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          <Select label="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </Select>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create User'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete User"
        message="This user will be permanently deleted."
      />
    </div>
  );
}
