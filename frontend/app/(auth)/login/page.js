'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import Link from 'next/link';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';
import { Activity } from 'lucide-react';
import { PageLoader } from '@/components/ui/spinner';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, needsSetup, login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && needsSetup) router.replace('/setup');
    if (!authLoading && user) router.replace('/dashboard');
  }, [authLoading, needsSetup, user, router]);

  if (authLoading) return <PageLoader />;
  if (needsSetup || user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-4">
          <Activity size={28} />
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Sign in to Status One</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Monitor your services with ease</p>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="admin@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500 transition-colors">
            Forgot your password?
          </Link>
        </div>
      </div>
    </div>
  );
}
