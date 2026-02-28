'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import Sidebar from '@/components/dashboard/sidebar';
import { PageLoader } from '@/components/ui/spinner';
import { getSettings, updateSettings } from '@/lib/api';

const APP_URL_INIT_KEY = 'status_one_app_url_initialized';

/** Derive the public-facing origin from NEXT_PUBLIC_API_URL. */
function resolveAppUrl() {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api').origin;
  } catch {
    return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/api(\/.*)?$/, '');
  }
}

export default function DashboardLayout({ children }) {
  const { user, loading, needsSetup } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (needsSetup) router.replace('/setup');
    else if (!user) router.replace('/login');
  }, [user, loading, needsSetup, router]);

  // One-time: seed app_url in settings after initial setup so the backend
  // knows its own public URL without manual configuration.
  useEffect(() => {
    if (!user) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(APP_URL_INIT_KEY)) return;

    const appUrl = resolveAppUrl();
    (async () => {
      try {
        const data = await getSettings();
        const current = data?.settings ?? data ?? {};
        await updateSettings({ ...current, app_url: appUrl });
        localStorage.setItem(APP_URL_INIT_KEY, '1');
      } catch {
        // non-fatal — will retry on next load until it succeeds
      }
    })();
  }, [user]);

  if (loading || !user) return <PageLoader />;

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Sidebar />
      <main className="lg:pl-64 transition-all duration-300">
        <div className="px-4 sm:px-6 lg:px-8 py-6 pt-16 lg:pt-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
