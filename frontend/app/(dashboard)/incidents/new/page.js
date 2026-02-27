'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createIncident, getMonitors } from '@/lib/api';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Textarea from '@/components/ui/textarea';
import Button from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewIncidentPage() {
  const router = useRouter();
  const [monitors, setMonitors] = useState([]);
  const [form, setForm] = useState({ title: '', monitor_id: '', status: 'investigating', message: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMonitors().then(r => setMonitors(r.monitors || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await createIncident({
        ...form,
        monitor_id: form.monitor_id || undefined,
      });
      router.push(`/incidents/${res.incident.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/incidents" className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Create Incident</h1>
      </div>

      <Card>
        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title *" placeholder="e.g. API Service Degradation" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          <Select label="Monitor (optional)" value={form.monitor_id} onChange={e => setForm({ ...form, monitor_id: e.target.value })}>
            <option value="">No specific monitor</option>
            {monitors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select label="Initial Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="investigating">Investigating</option>
            <option value="identified">Identified</option>
            <option value="monitoring">Monitoring</option>
            <option value="resolved">Resolved</option>
          </Select>
          <Textarea label="Initial Message" placeholder="Describe what happened..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Incident'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
