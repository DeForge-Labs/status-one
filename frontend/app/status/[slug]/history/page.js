'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getPublicStatusPage, getPublicStatusHistory } from '@/lib/api';
import { uptimeColor } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

export default function HistoryPage({ params }) {
  const { slug } = use(params);
  const [page, setPage] = useState(null);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [pg, hist] = await Promise.all([
          getPublicStatusPage(slug),
          getPublicStatusHistory(slug),
        ]);
        setPage(pg.statusPage);
        setMonitors(hist.history || []);
      } catch {}
      setLoading(false);
    };
    fetch();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 animate-pulse">
        <div className="h-4 bg-[var(--color-border)] rounded w-24 mb-4" />
        <div className="h-8 bg-[var(--color-border)] rounded w-48 mb-2" />
        <div className="h-4 bg-[var(--color-border)] rounded w-32 mb-8" />
        <div className="space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-[var(--color-border)] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8">
        <Link href={`/status/${slug}`} className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors mb-4">
          <ArrowLeft size={14} /> Back to status
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Uptime History</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{page?.name}</p>
      </div>

      <div className="space-y-6">
        {monitors.map(monitor => {
          const days = monitor.days || [];
          const calcUptime = (n) => {
            const slice = days.slice(-n);
            if (slice.length === 0) return null;
            return slice.reduce((sum, d) => sum + d.uptime, 0) / slice.length;
          };
          const periods = [
            { label: '24 hours', value: calcUptime(1) },
            { label: '7 days', value: calcUptime(7) },
            { label: '30 days', value: calcUptime(30) },
            { label: '90 days', value: calcUptime(90) },
          ];
          return (
            <div key={monitor.id} className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
              <h3 className="text-sm font-semibold text-[var(--color-text)] mb-4">{monitor.name}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {periods.map(p => (
                  <div key={p.label} className="text-center">
                    <p className={`text-xl font-bold ${p.value != null ? uptimeColor(p.value) : 'text-[var(--color-text-tertiary)]'}`}>
                      {p.value != null ? `${p.value.toFixed(2)}%` : 'N/A'}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{p.label}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 text-center">
        <Link href={`/status/${slug}`} className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors">
          ← Back to status page
        </Link>
      </div>
    </div>
  );
}
