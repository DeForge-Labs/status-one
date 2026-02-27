'use client';

import clsx from 'clsx';
import { uptimeBgColor } from '@/lib/utils';

export default function UptimeBar({ days = [], checks, compact = false, monitorId, className }) {
  // Support both `days` array and `checks` array formats
  const data = days?.length > 0 ? days : checks || [];
  const barHeight = compact ? 'h-6' : 'h-8';
  const numBars = compact ? 45 : 90;

  if (!data || data.length === 0) {
    return (
      <div className={clsx('flex items-center gap-[2px]', className)}>
        {Array(numBars).fill(0).map((_, i) => (
          <div key={i} className={clsx('flex-1 rounded-[2px] bg-zinc-200 dark:bg-zinc-800', barHeight)} />
        ))}
      </div>
    );
  }

  const displayData = data.slice(compact ? -45 : -90);

  return (
    <div className={clsx('group relative', className)}>
      <div className="flex items-center gap-[2px]">
        {displayData.map((day, i) => (
          <div key={i} className="relative flex-1 group/day">
            <div
              className={clsx(
                'rounded-[2px] transition-all duration-150 hover:scale-y-125 hover:opacity-90 cursor-pointer',
                barHeight,
                uptimeBgColor(day.uptime ?? -1)
              )}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/day:block z-20 pointer-events-none">
              <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                <div className="font-medium">{day.date}</div>
                <div>{day.uptime != null ? `${(day.uptime * (day.uptime <= 1 ? 100 : 1)).toFixed(2)}%` : 'No data'}</div>
                {day.avg_response_time != null && (
                  <div>{Math.round(day.avg_response_time)}ms avg</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!compact && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-[var(--color-text-tertiary)]">{displayData.length} days ago</span>
          <span className="text-xs text-[var(--color-text-tertiary)]">Today</span>
        </div>
      )}
    </div>
  );
}
