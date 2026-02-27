'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { performSetup } from '@/lib/api';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';
import { Activity, Eye, EyeOff } from 'lucide-react';
import { PageLoader } from '@/components/ui/spinner';

export default function SetupPage() {
  const router = useRouter();
  const { needsSetup, loading: authLoading, loginWithToken } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !needsSetup) {
      router.replace('/login');
    }
  }, [authLoading, needsSetup, router]);

  if (authLoading) return <PageLoader />;
  if (!needsSetup) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await performSetup({ name: form.name, email: form.email, password: form.password });
      loginWithToken(res.token, res.user);
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
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Welcome to Status One</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Create your admin account to get started</p>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            placeholder="Your name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
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
            type={showPassword ? 'text' : 'password'}
            placeholder="Minimum 8 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
            suffix={
              <button type="button" onClick={() => setShowPassword(v => !v)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors cursor-pointer">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
          />
          <Input
            label="Confirm Password"
            type={showConfirm ? 'text' : 'password'}
            placeholder="Repeat password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            required
            minLength={8}
            suffix={
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors cursor-pointer">
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Admin Account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
