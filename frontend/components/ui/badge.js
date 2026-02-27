'use client';

import clsx from 'clsx';

const badgeVariants = {
  up: 'bg-green-500/10 text-green-600 dark:text-green-400',
  down: 'bg-red-500/10 text-red-600 dark:text-red-400',
  degraded: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  unknown: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  paused: 'bg-zinc-500/10 text-zinc-500',
  investigating: 'bg-red-500/10 text-red-600 dark:text-red-400',
  identified: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  monitoring: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  resolved: 'bg-green-500/10 text-green-600 dark:text-green-400',
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  maintenance: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  default: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
};

export default function Badge({ variant = 'default', children, className, dot = false }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        badgeVariants[variant] || badgeVariants.default,
        className
      )}
    >
      {dot && (
        <span className={clsx('h-1.5 w-1.5 rounded-full', {
          'bg-green-500': variant === 'up' || variant === 'resolved',
          'bg-red-500': variant === 'down' || variant === 'investigating',
          'bg-yellow-500': variant === 'degraded' || variant === 'warning',
          'bg-orange-500': variant === 'identified',
          'bg-blue-500': variant === 'monitoring' || variant === 'info',
          'bg-zinc-400': !['up','down','degraded','resolved','investigating','identified','monitoring','warning'].includes(variant),
        })} />
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status, active = true }) {
  if (!active) return <Badge variant="paused" dot>Paused</Badge>;
  const labels = { up: 'Up', down: 'Down', degraded: 'Degraded', unknown: 'Unknown' };
  return <Badge variant={status || 'unknown'} dot>{labels[status] || 'Unknown'}</Badge>;
}

export function IncidentStatusBadge({ status }) {
  const labels = { investigating: 'Investigating', identified: 'Identified', monitoring: 'Monitoring', resolved: 'Resolved' };
  return <Badge variant={status} dot>{labels[status] || status}</Badge>;
}
