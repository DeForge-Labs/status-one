'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateSettings, factoryReset, createBackup, getBackups, downloadBackup, purgeOldData, getSystemInfo } from '@/lib/api';
import { formatBytes, formatDuration, formatDate } from '@/lib/utils';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import ConfirmDialog from '@/components/confirm-dialog';
import { Save, AlertTriangle, Database, Download, Trash2, Info, Plus } from 'lucide-react';
import ThemeSelector from '@/components/theme-selector';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [systemInfo, setSystemInfo] = useState(null);
  const [backups, setBackups] = useState([]);
  const [backingUp, setBackingUp] = useState(false);
  const [showPurge, setShowPurge] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeDays, setPurgeDays] = useState(90);

  const loadSystem = async () => {
    const [info, list] = await Promise.all([getSystemInfo(), getBackups()]);
    setSystemInfo(info);
    setBackups(list || []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [s] = await Promise.all([getSettings(), loadSystem()]);
        setSettings(s.settings || s);
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    };
    load();
  }, []);

  const flash = (msg) => {
    setError('');
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

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
      await factoryReset('FACTORY_RESET');
      localStorage.removeItem('status_one_token');
      localStorage.removeItem('status_one_user');
      localStorage.removeItem('status_one_urls_initialized');
      window.location.href = '/setup';
      return;
    } catch (err) {
      setError(err.message);
      setShowReset(false);
    }
    setResetting(false);
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const { filename } = await createBackup();
      await downloadBackup(filename);
      await loadSystem();
      flash('Backup created and downloaded');
    } catch (err) {
      setError(err.message);
    }
    setBackingUp(false);
  };

  const handleDownload = async (filename) => {
    try {
      await downloadBackup(filename);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      const res = await purgeOldData(purgeDays);
      await loadSystem();
      flash(`Deleted ${res.deleted.toLocaleString()} checks older than ${purgeDays} days`);
    } catch (err) {
      setError(err.message);
    }
    setShowPurge(false);
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
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {[
              ['Version', systemInfo.version],
              ['Runtime', systemInfo.runtime],
              ['Uptime', formatDuration(systemInfo.uptime)],
              ['Memory (RSS)', formatBytes(systemInfo.memory?.rss)],
              ['Active monitors', systemInfo.engine?.activeMonitors ?? 0],
              ['Users', systemInfo.database?.users ?? 0],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[var(--color-text-tertiary)]">{label}</dt>
                <dd className="text-[var(--color-text)] font-medium mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {/* Database */}
      <Card>
        <h3 className="text-base font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2"><Database size={16} /> Database</h3>
        <div className="space-y-5">
          {systemInfo && (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {[
                ['Data size', formatBytes(systemInfo.database?.size_bytes)],
                ['On disk', formatBytes(systemInfo.database?.disk_bytes)],
                ['Monitors', (systemInfo.database?.monitors ?? 0).toLocaleString()],
                ['Checks stored', (systemInfo.database?.checks ?? 0).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[var(--color-text-tertiary)]">{label}</dt>
                  <dd className="text-[var(--color-text)] font-medium mt-0.5">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <p className="text-sm font-medium text-[var(--color-text)]">Backups</p>
              <Button variant="outline" size="sm" onClick={handleBackup} disabled={backingUp}>
                <Plus size={14} /> {backingUp ? 'Creating...' : 'Create & download backup'}
              </Button>
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-3">Automatic backups run every 12 hours. The latest two automatic and two manual backups are kept.</p>
            {backups.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">No backups yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg">
                {backups.map((b) => (
                  <li key={b.filename} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="text-[var(--color-text)] truncate">{b.filename.startsWith('manual-') ? 'Manual' : 'Automatic'} · {formatDate(b.created_at)}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">{formatBytes(b.size_bytes)}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(b.filename)} aria-label={`Download ${b.filename}`}>
                      <Download size={14} /> Download
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input label="Purge check history older than (days)" type="number" min="2" value={purgeDays} onChange={e => setPurgeDays(parseInt(e.target.value) || 90)} />
            </div>
            <Button variant="secondary" onClick={() => setShowPurge(true)} disabled={purging}>
              <Trash2 size={14} /> Purge
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
        open={showPurge}
        onClose={() => setShowPurge(false)}
        onConfirm={handlePurge}
        loading={purging}
        title="Purge check history"
        confirmText="Purge"
        message={`Delete all raw check results older than ${purgeDays} days? Daily uptime stats are kept. This cannot be undone.`}
      />

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
