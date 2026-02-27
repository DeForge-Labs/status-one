'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getMonitor, updateMonitor, getNotificationChannels, getTags } from '@/lib/api';
import MonitorForm from '@/components/monitor-form';
import { PageLoader } from '@/components/ui/spinner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditMonitorPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [monitor, setMonitor] = useState(null);
  const [channels, setChannels] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMonitor(id),
      getNotificationChannels(),
      getTags(),
    ]).then(([m, c, t]) => {
      setMonitor(m.monitor);
      setChannels(c.channels || []);
      setTags(t.tags || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!monitor) return <div className="text-center py-20 text-[var(--color-text-secondary)]">Monitor not found</div>;

  const handleSubmit = async (data) => {
    await updateMonitor(id, data);
    router.push(`/monitors/${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/monitors/${id}`} className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Edit Monitor</h1>
      </div>
      <MonitorForm initialData={monitor} onSubmit={handleSubmit} channels={channels} tags={tags} isEdit />
    </div>
  );
}
