'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { WeeklyHealthScore } from '@/types/index';

interface BottleneckChartProps {
  scores: WeeklyHealthScore[];
  height?: number;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 shadow-xl text-xs">
      <div className="text-zinc-400 font-medium mb-2">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.fill }} />
            <span className="text-zinc-400">{entry.name}</span>
          </div>
          <span className="text-zinc-200 font-medium tabular-nums">
            {entry.value < 24 ? `${Math.round(entry.value)}h` : `${(entry.value / 24).toFixed(1)}d`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BottleneckChart({ scores, height = 240 }: BottleneckChartProps) {
  if (!scores.length) {
    return (
      <div className="flex items-center justify-center text-zinc-500 text-sm" style={{ height }}>
        No lifecycle data yet
      </div>
    );
  }

  const data = [...scores]
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .slice(-13)
    .map((s) => ({
      date: formatDate(s.week_start),
      'Time to Review': Math.round((s.median_time_to_first_review_hrs ?? 0) * 10) / 10,
      'Time to Merge': Math.max(
        0,
        Math.round(((s.median_time_to_merge_hrs ?? 0) - (s.median_time_to_first_review_hrs ?? 0)) * 10) / 10
      ),
    }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barSize={16} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => v < 24 ? `${v}h` : `${(v / 24).toFixed(0)}d`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
        <Bar dataKey="Time to Review" fill="#10b981" radius={[4, 4, 0, 0]} stackId="time" />
        <Bar dataKey="Time to Merge" fill="#6366f1" radius={[4, 4, 0, 0]} stackId="time" />
      </BarChart>
    </ResponsiveContainer>
  );
}
