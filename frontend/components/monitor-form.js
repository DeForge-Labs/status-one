'use client';

import { useState } from 'react';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Textarea from '@/components/ui/textarea';
import Button from '@/components/ui/button';

const monitorTypes = [
  { value: 'http', label: 'HTTP(S)' },
  { value: 'keyword', label: 'Keyword' },
  { value: 'ssl', label: 'SSL Certificate' },
  { value: 'ping', label: 'Ping' },
  { value: 'tcp', label: 'TCP Port' },
  { value: 'dns', label: 'DNS' },
  { value: 'push', label: 'Push (Heartbeat)' },
];

const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const dnsTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA'];

export default function MonitorForm({ initialData, onSubmit, channels = [], tags = [], isEdit = false }) {
  const [form, setForm] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'http',
    url: initialData?.url || '',
    method: initialData?.method || 'GET',
    headers: initialData?.headers || {},
    body: initialData?.body || '',
    interval_seconds: initialData?.interval_seconds || 60,
    timeout_ms: initialData?.timeout_ms || 10000,
    retries: initialData?.retries || 3,
    retry_interval_seconds: initialData?.retry_interval_seconds || 10,
    expected_status: initialData?.expected_status || 200,
    keyword: initialData?.keyword || '',
    keyword_type: initialData?.keyword_type || 'contains',
    degraded_threshold_ms: initialData?.degraded_threshold_ms || 2000,
    hostname: initialData?.hostname || '',
    port: initialData?.port || '',
    dns_record_type: initialData?.dns_record_type || 'A',
    push_interval_seconds: initialData?.push_interval_seconds || 60,
    ssl_warn_days: initialData?.ssl_warn_days || 30,
    active: initialData?.active ?? true,
    accepted_status_codes: initialData?.accepted_status_codes || '200-299',
    max_redirects: initialData?.max_redirects || 5,
    auth_method: initialData?.auth_method || 'none',
    auth_user: initialData?.auth_user || '',
    auth_pass: initialData?.auth_pass || '',
    description: initialData?.description || '',
    notification_channel_ids: initialData?.notification_channel_ids || [],
  });
  const [headerKey, setHeaderKey] = useState('');
  const [headerVal, setHeaderVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addHeader = () => {
    if (headerKey.trim()) {
      update('headers', { ...form.headers, [headerKey.trim()]: headerVal });
      setHeaderKey('');
      setHeaderVal('');
    }
  };

  const removeHeader = (key) => {
    const h = { ...form.headers };
    delete h[key];
    update('headers', h);
  };

  const showUrl = ['http', 'keyword', 'ssl'].includes(form.type);
  const showHostname = ['ping', 'tcp', 'dns'].includes(form.type);
  const showHttp = ['http', 'keyword'].includes(form.type);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>}

      {/* Basic */}
      <Card>
        <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Basic Settings</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Name *" placeholder="My Website" value={form.name} onChange={e => update('name', e.target.value)} required />
            <Select label="Type" value={form.type} onChange={e => update('type', e.target.value)}>
              {monitorTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </div>
          {showUrl && <Input label="URL *" placeholder="https://example.com" value={form.url} onChange={e => update('url', e.target.value)} required />}
          {showHostname && <Input label="Hostname *" placeholder="example.com" value={form.hostname} onChange={e => update('hostname', e.target.value)} required />}
          {form.type === 'tcp' && <Input label="Port *" type="number" min="1" max="65535" placeholder="443" value={form.port} onChange={e => update('port', parseInt(e.target.value) || '')} required />}
          {form.type === 'dns' && (
            <Select label="DNS Record Type" value={form.dns_record_type} onChange={e => update('dns_record_type', e.target.value)}>
              {dnsTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          )}
          <Textarea label="Description" placeholder="Optional description" value={form.description} onChange={e => update('description', e.target.value)} />
        </div>
      </Card>

      {/* HTTP Settings */}
      {showHttp && (
        <Card>
          <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">HTTP Settings</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label="Method" value={form.method} onChange={e => update('method', e.target.value)}>
                {httpMethods.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
              <Input label="Expected Status" type="number" value={form.expected_status} onChange={e => update('expected_status', parseInt(e.target.value) || 200)} />
              <Input label="Accepted Status Codes" placeholder="200-299" value={form.accepted_status_codes} onChange={e => update('accepted_status_codes', e.target.value)} />
            </div>
            {['POST', 'PUT', 'PATCH'].includes(form.method) && (
              <Textarea label="Request Body" placeholder='{"key": "value"}' value={form.body} onChange={e => update('body', e.target.value)} />
            )}
            <Input label="Max Redirects" type="number" min="0" max="20" value={form.max_redirects} onChange={e => update('max_redirects', parseInt(e.target.value) || 0)} />
            {/* Headers */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Headers</label>
              {Object.entries(form.headers).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-[var(--color-bg-tertiary)] px-2 py-1 rounded">{k}: {v}</span>
                  <button type="button" onClick={() => removeHeader(k)} className="text-xs text-red-500 hover:underline cursor-pointer">Remove</button>
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <input placeholder="Key" value={headerKey} onChange={e => setHeaderKey(e.target.value)} className="flex-1 px-2 py-1.5 text-xs rounded border border-[var(--color-input-border)] bg-[var(--color-input)] text-[var(--color-text)]" />
                <input placeholder="Value" value={headerVal} onChange={e => setHeaderVal(e.target.value)} className="flex-1 px-2 py-1.5 text-xs rounded border border-[var(--color-input-border)] bg-[var(--color-input)] text-[var(--color-text)]" />
                <Button type="button" variant="secondary" size="sm" onClick={addHeader}>Add</Button>
              </div>
            </div>
            {/* Auth */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label="Auth Method" value={form.auth_method} onChange={e => update('auth_method', e.target.value)}>
                <option value="none">None</option>
                <option value="basic">Basic Auth</option>
                <option value="bearer">Bearer Token</option>
              </Select>
              {form.auth_method !== 'none' && (
                <>
                  <Input label={form.auth_method === 'bearer' ? 'Token' : 'Username'} value={form.auth_user} onChange={e => update('auth_user', e.target.value)} />
                  {form.auth_method === 'basic' && <Input label="Password" type="password" value={form.auth_pass} onChange={e => update('auth_pass', e.target.value)} />}
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Keyword */}
      {form.type === 'keyword' && (
        <Card>
          <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Keyword Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Keyword *" placeholder="Expected keyword in response" value={form.keyword} onChange={e => update('keyword', e.target.value)} required />
            <Select label="Keyword Type" value={form.keyword_type} onChange={e => update('keyword_type', e.target.value)}>
              <option value="contains">Contains</option>
              <option value="not_contains">Does Not Contain</option>
            </Select>
          </div>
        </Card>
      )}

      {/* SSL */}
      {form.type === 'ssl' && (
        <Card>
          <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">SSL Settings</h3>
          <Input label="Warning Days Before Expiry" type="number" min="1" value={form.ssl_warn_days} onChange={e => update('ssl_warn_days', parseInt(e.target.value) || 30)} />
        </Card>
      )}

      {/* Push */}
      {form.type === 'push' && (
        <Card>
          <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Push Settings</h3>
          <Input label="Expected Heartbeat Interval (seconds)" type="number" min="10" value={form.push_interval_seconds} onChange={e => update('push_interval_seconds', parseInt(e.target.value) || 60)} />
        </Card>
      )}

      {/* Timing */}
      <Card>
        <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Timing & Retries</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input label="Check Interval (s)" type="number" min="10" max="86400" value={form.interval_seconds} onChange={e => update('interval_seconds', parseInt(e.target.value) || 60)} />
          <Input label="Timeout (ms)" type="number" min="1000" value={form.timeout_ms} onChange={e => update('timeout_ms', parseInt(e.target.value) || 10000)} />
          <Input label="Retries" type="number" min="0" max="10" value={form.retries} onChange={e => update('retries', parseInt(e.target.value) || 0)} />
          <Input label="Retry Interval (s)" type="number" min="1" value={form.retry_interval_seconds} onChange={e => update('retry_interval_seconds', parseInt(e.target.value) || 10)} />
        </div>
        <div className="mt-4">
          <Input label="Degraded Threshold (ms)" type="number" min="0" value={form.degraded_threshold_ms} onChange={e => update('degraded_threshold_ms', parseInt(e.target.value) || 2000)} />
        </div>
      </Card>

      {/* Notifications */}
      {channels.length > 0 && (
        <Card>
          <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Notification Channels</h3>
          <div className="space-y-2">
            {channels.map(ch => (
              <label key={ch.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.notification_channel_ids.includes(ch.id)}
                  onChange={(e) => {
                    const ids = e.target.checked
                      ? [...form.notification_channel_ids, ch.id]
                      : form.notification_channel_ids.filter(id => id !== ch.id);
                    update('notification_channel_ids', ids);
                  }}
                  className="rounded border-[var(--color-input-border)]"
                />
                <span className="text-sm text-[var(--color-text)]">{ch.name}</span>
                <span className="text-xs text-[var(--color-text-tertiary)]">({ch.type})</span>
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* Active */}
      <Card>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">Active</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Start monitoring immediately after creation</p>
          </div>
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => update('active', e.target.checked)}
            className="w-5 h-5 rounded border-[var(--color-input-border)]"
          />
        </label>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" type="button" onClick={() => window.history.back()}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Update Monitor' : 'Create Monitor'}
        </Button>
      </div>
    </form>
  );
}
