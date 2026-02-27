'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { PageLoader } from '@/components/ui/spinner';

export default function Home() {
  const router = useRouter();
  const { user, loading, needsSetup } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (needsSetup) {
      router.replace('/setup');
    } else if (user) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [user, loading, needsSetup, router]);

  return <PageLoader />;
}
