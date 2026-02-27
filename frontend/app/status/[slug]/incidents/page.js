'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getPublicStatusPage, getPublicStatusIncidents } from '@/lib/api';
import Spinner from '@/components/ui/spinner';
import { IncidentStatusBadge } from '@/components/ui/badge';
import { relativeTime, formatDate } from '@/lib/utils';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function IncidentHistoryPage({ params }) {
  const { slug } = use(params);
  const [page, setPage] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [pg, inc] = await Promise.all([
          getPublicStatusPage(slug),
          getPublicStatusIncidents(slug),
        ]);
        setPage(pg.statusPage);
        setIncidents(inc.incidents || []);
      } catch {}
      setLoading(false);
    };
    fetch();
  }, [slug]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size="lg" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8">
        <Link href={`/status/${slug}`} className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors mb-4">
          <ArrowLeft size={14} /> Back to status
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Incident History</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{page?.name}</p>
      </div>

      {incidents.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
          <CheckCircle2 size={40} className="mx-auto text-green-500 mb-3" />
          <p className="text-[var(--color-text)]">No incidents recorded</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">All systems have been running smoothly</p>
        </div>
      ) : (
        <div className="space-y-4">
          {incidents.map(incident => (
            <div key={incident.id} className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">{incident.title}</h3>
                    <IncidentStatusBadge status={incident.status} />
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                    {formatDate(incident.started_at)}
                    {incident.resolved_at && ` — Resolved ${formatDate(incident.resolved_at)}`}
                  </p>
                </div>
              </div>
              {incident.updates?.length > 0 && (
                <div className="border-t border-[var(--color-border)] pt-3 mt-3 space-y-3">
                  {incident.updates.map(update => (
                    <div key={update.id} className="flex gap-3">
                      <IncidentStatusBadge status={update.status} />
                      <div>
                        {update.message && <p className="text-xs text-[var(--color-text-secondary)]">{update.message}</p>}
                        <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{relativeTime(update.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 text-center">
        <Link href={`/status/${slug}`} className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors">
          ← Back to status page
        </Link>
      </div>
    </div>
  );
}
