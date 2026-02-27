'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createStatusPage, getMonitors } from '@/lib/api';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Textarea from '@/components/ui/textarea';
import Button from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

export default function NewStatusPage() {
  const router = useRouter();
  const [monitors, setMonitors] = useState([]);
  const [form, setForm] = useState({ name: '', slug: '', description: '', logo_url: '', theme: 'light', published: false });
  const [selectedMonitors, setSelectedMonitors] = useState([]);
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
      const res = await createStatusPage(form);
      router.push(`/status-pages/${res.statusPage.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/status-pages" className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Create Status Page</h1>
      </div>

      <Card>
        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title *"
            placeholder="My Service Status"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value, slug: form.slug || generateSlug(e.target.value) })}
            required
          />
          <Input
            label="Slug *"
            placeholder="my-service"
            value={form.slug}
            onChange={e => setForm({ ...form, slug: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            placeholder="Short description of your service"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
          <Input
            label="Logo URL"
            placeholder="https://example.com/logo.png"
            value={form.logo_url}
            onChange={e => setForm({ ...form, logo_url: e.target.value })}
          />
          <Select
            label="Theme"
            value={form.theme}
            onChange={e => setForm({ ...form, theme: e.target.value })}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} className="rounded" />
            <span className="text-sm text-[var(--color-text)]">Publish this status page</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Status Page'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
