'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { updateProfile, changePassword } from '@/lib/api';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';
import { Save, Lock, User } from 'lucide-react';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg({ type: '', text: '' });
    try {
      await updateProfile(profile);
      await refreshUser();
      setProfileMsg({ type: 'success', text: 'Profile updated successfully' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message });
    }
    setSavingProfile(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    setSavingPassword(true);
    setPasswordMsg({ type: '', text: '' });
    try {
      await changePassword({ current_password: passwords.current_password, new_password: passwords.new_password });
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully' });
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message });
    }
    setSavingPassword(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Profile</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Manage your account</p>
      </div>

      {/* Profile */}
      <Card>
        <h3 className="text-base font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2"><User size={16} /> Profile Information</h3>
        {profileMsg.text && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${profileMsg.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {profileMsg.text}
          </div>
        )}
        <form onSubmit={handleProfileSave} className="space-y-4">
          <Input label="Name" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} required />
          <Input label="Email" type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} required />
          <div className="flex justify-end">
            <Button type="submit" disabled={savingProfile}><Save size={14} /> {savingProfile ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Card>

      {/* Change Password */}
      <Card>
        <h3 className="text-base font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2"><Lock size={16} /> Change Password</h3>
        {passwordMsg.text && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${passwordMsg.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {passwordMsg.text}
          </div>
        )}
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <Input label="Current Password" type="password" value={passwords.current_password} onChange={e => setPasswords({ ...passwords, current_password: e.target.value })} required />
          <Input label="New Password" type="password" value={passwords.new_password} onChange={e => setPasswords({ ...passwords, new_password: e.target.value })} required />
          <Input label="Confirm New Password" type="password" value={passwords.confirm_password} onChange={e => setPasswords({ ...passwords, confirm_password: e.target.value })} required />
          <div className="flex justify-end">
            <Button type="submit" disabled={savingPassword}><Lock size={14} /> {savingPassword ? 'Changing...' : 'Change Password'}</Button>
          </div>
        </form>
      </Card>

      {/* Account Info */}
      <Card className="text-sm text-[var(--color-text-secondary)]">
        <p>Role: <span className="font-medium text-[var(--color-text)]">{user?.role || 'Unknown'}</span></p>
        <p className="mt-1">User ID: <span className="font-mono text-xs">{user?.id}</span></p>
      </Card>
    </div>
  );
}
