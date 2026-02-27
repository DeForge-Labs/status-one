'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createMonitor, getNotificationChannels, getTags } from '@/lib/api';
import MonitorForm from '@/components/monitor-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewMonitorPage() {
  const router = useRouter();
  const [channels, setChannels] = useState([]);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    getNotificationChannels().then(r => setChannels(r.channels || [])).catch(() => {});
    getTags().then(r => setTags(r.tags || [])).catch(() => {});
  }, []);

  const handleSubmit = async (data) => {
    await createMonitor(data);
    router.push('/monitors');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/monitors" className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">New Monitor</h1>
      </div>
      <MonitorForm onSubmit={handleSubmit} channels={channels} tags={tags} />
    </div>
  );
}
