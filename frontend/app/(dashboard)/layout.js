'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import Sidebar from '@/components/dashboard/sidebar';
import { PageLoader } from '@/components/ui/spinner';

export default function DashboardLayout({ children }) {
  const { user, loading, needsSetup } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (needsSetup) router.replace('/setup');
    else if (!user) router.replace('/login');
  }, [user, loading, needsSetup, router]);

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
