'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useTheme } from '@/contexts/theme';

// Backend buckets are UTC "YYYY-MM-DD HH:MM:SS" (no zone): minute <=1h, hour <=7d, day beyond.
// Show only the time within a day, date+time for hourly buckets over several days, date only for daily buckets.
const labelOptions = {
  '1h': { hour: '2-digit', minute: '2-digit' },
  '24h': { hour: '2-digit', minute: '2-digit' },
  '7d': { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
};

export default function ResponseTimeChart({ data = [], height = 300, period = '24h' }) {
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center bg-[var(--color-bg-secondary)] rounded-lg" style={{ height }}>
        <p className="text-sm text-[var(--color-text-tertiary)]">No data available</p>
      </div>
    );
  }

  const formatted = data.map(d => ({
    ...d,
    time: d.bucket ? new Date(d.bucket.replace(' ', 'T') + 'Z').toLocaleString([], labelOptions[period] || { month: 'short', day: 'numeric' }) : '',
    avg: Math.round(d.avg_rt || 0),
    min: Math.round(d.min_rt || 0),
    max: Math.round(d.max_rt || 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
        <defs>
          <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#e5e7eb'} />
        <XAxis
          dataKey="time"
          tick={{ fill: isDark ? '#71717a' : '#9ca3af', fontSize: 11 }}
          axisLine={{ stroke: isDark ? '#27272a' : '#e5e7eb' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: isDark ? '#71717a' : '#9ca3af', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}ms`}
        />
        <Tooltip
          contentStyle={{
            background: isDark ? '#18181b' : '#fff',
            border: `1px solid ${isDark ? '#27272a' : '#e5e7eb'}`,
            borderRadius: '8px',
            fontSize: '12px',
            color: isDark ? '#fafafa' : '#111827',
          }}
          labelStyle={{ color: isDark ? '#a1a1aa' : '#6b7280' }}
          formatter={(value) => [`${value}ms`]}
        />
        <Area
          type="monotone"
          dataKey="avg"
          stroke="#3b82f6"
          fill="url(#colorAvg)"
          strokeWidth={2}
          name="Avg"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
