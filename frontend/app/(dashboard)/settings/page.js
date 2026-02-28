'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateSettings, factoryReset, getDatabaseBackup, purgeOldData, getSystemInfo } from '@/lib/api';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import ConfirmDialog from '@/components/confirm-dialog';
import { Save, AlertTriangle, Database, Download, Trash2, Info } from 'lucide-react';
import ThemeSelector from '@/components/theme-selector';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeDays, setPurgeDays] = useState(90);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, info] = await Promise.all([getSettings(), getSystemInfo()]);
        setSettings(s.settings || s);
        setSystemInfo(info);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateSettings(settings);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await factoryReset();
      localStorage.removeItem('status_one_token');
      localStorage.removeItem('status_one_app_url_initialized');
      window.location.href = '/setup';
    } catch {}
    setResetting(false);
  };

  const handleBackup = async () => {
    try {
      const blob = await getDatabaseBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `status-one-backup-${new Date().toISOString().split('T')[0]}.sqlite`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      await purgeOldData(purgeDays);
      setSuccess(`Purged data older than ${purgeDays} days`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
    setPurging(false);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Settings</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">System configuration</p>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-green-500/10 text-green-500 text-sm">{success}</div>}

      {/* Appearance */}
      <Card>
        <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Appearance</h3>
        <ThemeSelector mode="full" />
      </Card>

      {/* General */}
      <Card>
        <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">General Settings</h3>
        <div className="space-y-4">
          <Input label="Site Title" value={settings.site_title || ''} onChange={e => setSettings({ ...settings, site_title: e.target.value })} />
          <Input label="Site URL" placeholder="https://status.example.com" value={settings.site_url || ''} onChange={e => setSettings({ ...settings, site_url: e.target.value })} />
          <Input label="Server URL" placeholder="https://statusapi.example.com" value={settings.app_url || ''} onChange={e => setSettings({ ...settings, app_url: e.target.value })} />
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}><Save size={14} /> {saving ? 'Saving...' : 'Save Settings'}</Button>
          </div>
        </div>
      </Card>

      {/* System Info */}
      {systemInfo && (
        <Card>
          <h3 className="text-base font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2"><Info size={16} /> System Information</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(systemInfo).map(([key, value]) => (
              <div key={key}>
                <span className="text-[var(--color-text-tertiary)]">{key.replace(/_/g, ' ')}: </span>
                <span className="text-[var(--color-text)] break-words">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Database */}
      <Card>
        <h3 className="text-base font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2"><Database size={16} /> Database</h3>
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <Button variant="outline" onClick={handleBackup}><Download size={14} /> Download Backup</Button>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input label="Purge data older than (days)" type="number" min="7" value={purgeDays} onChange={e => setPurgeDays(parseInt(e.target.value) || 90)} />
            </div>
            <Button variant="secondary" onClick={handlePurge} disabled={purging}>
              <Trash2 size={14} /> {purging ? 'Purging...' : 'Purge'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/20">
        <h3 className="text-base font-semibold text-red-500 mb-2 flex items-center gap-2"><AlertTriangle size={16} /> Danger Zone</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Factory reset will delete all data and reset the application to its initial state.
        </p>
        <Button variant="danger" onClick={() => setShowReset(true)}>Factory Reset</Button>
      </Card>

      <ConfirmDialog
        open={showReset}
        onClose={() => setShowReset(false)}
        onConfirm={handleReset}
        loading={resetting}
        title="Factory Reset"
        message="This will DELETE ALL DATA including monitors, incidents, users, and settings. This action cannot be undone."
      />
    </div>
  );
}
