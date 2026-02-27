'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePolling } from '@/hooks/use-polling';
import { getStatusPages, deleteStatusPage } from '@/lib/api';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import ConfirmDialog from '@/components/confirm-dialog';
import { Plus, Globe, Trash2, ArrowUpRight, Eye, Copy, Check } from 'lucide-react';

export default function StatusPagesPage() {
  const { data, loading, refresh } = usePolling(getStatusPages, 30000, []);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(null);

  if (loading && !data) return <PageLoader />;

  const pages = data?.statusPages || [];

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await deleteStatusPage(deleteId); refresh(); } catch {}
    setDeleting(false);
    setDeleteId(null);
  };

  const copySlug = (slug) => {
    navigator.clipboard.writeText(`${window.location.origin}/status/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Status Pages</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Public pages showing service status</p>
        </div>
        <Link href="/status-pages/new">
          <Button><Plus size={16} /> Create Status Page</Button>
        </Link>
      </div>

      {pages.length === 0 ? (
        <EmptyState icon={Globe} title="No status pages" description="Create a public status page for your users" action={{ label: 'Create Status Page', href: '/status-pages/new' }} />
      ) : (
        <div className="grid gap-4">
          {pages.map(page => (
            <Card key={page.id} className="hover:border-[var(--color-text-tertiary)] transition-colors">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-[var(--color-text-tertiary)] flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-[var(--color-text)] truncate">{page.name}</h3>
                    {page.published && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 font-medium">Published</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[var(--color-text-tertiary)]">/status/{page.slug}</span>
                    <button onClick={() => copySlug(page.slug)} className="p-0.5 hover:bg-[var(--color-bg-tertiary)] rounded transition-colors cursor-pointer">
                      {copied === page.slug ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-[var(--color-text-tertiary)]" />}
                    </button>

                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a href={`/status/${page.slug}`} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] transition-colors">
                    <Eye size={14} />
                  </a>
                  <Link href={`/status-pages/${page.id}`} className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] transition-colors">
                    <ArrowUpRight size={14} />
                  </Link>
                  <button onClick={() => setDeleteId(page.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Status Page"
        message="This will permanently delete this status page."
      />
    </div>
  );
}
