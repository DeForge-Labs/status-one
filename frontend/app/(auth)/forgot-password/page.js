'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPassword } from '@/lib/api';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';
import { Activity, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword({ email });
      setSent(true);
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
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Reset Password</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">
          {sent ? 'Check your email for a reset link' : "Enter your email and we'll send you a reset link"}
        </p>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>
        )}

        {sent ? (
          <div className="text-center py-4">
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              If an account exists for <strong>{email}</strong>, you&apos;ll receive reset instructions.
            </p>
            <Link href="/login" className="text-sm text-blue-600 hover:text-blue-500 transition-colors inline-flex items-center gap-1">
              <ArrowLeft size={14} /> Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
            <div className="text-center">
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-500 transition-colors inline-flex items-center gap-1">
                <ArrowLeft size={14} /> Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
