'use client';

import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

export default function Spinner({ size = 20, className }) {
  return <Loader2 size={size} className={clsx('animate-spin text-[var(--color-text-secondary)]', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-sm text-[var(--color-text-secondary)]">Loading...</p>
      </div>
    </div>
  );
}
