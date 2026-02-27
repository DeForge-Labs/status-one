'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';

const Select = forwardRef(({ className, label, error, children, ...props }, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{label}</label>
      )}
      <select
        ref={ref}
        className={clsx(
          'w-full rounded-lg border px-3 py-2 text-sm transition-colors duration-150 appearance-none',
          'bg-[var(--color-input)] border-[var(--color-input-border)] text-[var(--color-text)]',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-red-500',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;
