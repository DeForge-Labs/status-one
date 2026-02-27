'use client';

import { useTheme } from '@/contexts/theme';
import { Sun, Moon, Monitor } from 'lucide-react';
import clsx from 'clsx';

export default function ThemeSelector({ compact = false }) {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-[var(--color-bg-tertiary)] p-1">
        {options.map(({ value, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={clsx(
              'p-1.5 rounded-md transition-all duration-150 cursor-pointer',
              theme === value
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
            )}
            title={value.charAt(0).toUpperCase() + value.slice(1)}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 cursor-pointer',
            theme === value
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
          )}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </div>
  );
}
