'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { WeeklyHealthScore } from '@/types/index';

interface ScoreTrendChartProps {
  scores: WeeklyHealthScore[];
  height?: number;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981'; // emerald-500
  if (score >= 60) return '#f59e0b'; // amber-500
  return '#f43f5e';                  // rose-500
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: WeeklyHealthScore }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const score = payload[0].value;
  const data = payload[0].payload;
  const color = getScoreColor(score);

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 shadow-xl">
      <div className="text-xs text-zinc-400 mb-1">{formatDate(data.week_start)}</div>
      <div className="font-bold text-2xl" style={{ color }}>{Math.round(score)}</div>
      <div className="text-xs text-zinc-500 mt-0.5">Health Score</div>
      <div className="mt-2 pt-2 border-t border-zinc-800 space-y-1">
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-zinc-500">PRs opened</span>
          <span className="text-zinc-300">{data.total_prs_opened}</span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-zinc-500">Contributors</span>
          <span className="text-zinc-300">{data.active_contributors}</span>
        </div>
        {data.stale_pr_count > 0 && (
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-zinc-500">Stale PRs</span>
            <span className="text-rose-400">{data.stale_pr_count}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ScoreTrendChart({ scores, height = 200 }: ScoreTrendChartProps) {
  if (!scores.length) {
    return (
      <div
        className="flex items-center justify-center text-zinc-500 text-sm"
        style={{ height }}
      >
        No score history yet
      </div>
    );
  }

  const data = [...scores]
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map((s) => ({
      ...s,
      score: Math.round(s.score),
      date: formatDate(s.week_start),
    }));

  // Determine line color based on latest score
  const latestScore = data[data.length - 1]?.score ?? 0;
  const lineColor = getScoreColor(latestScore);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={lineColor} stopOpacity={0.2} />
            <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          ticks={[0, 25, 50, 75, 100]}
        />
        <ReferenceLine y={80} stroke="#10b98120" strokeDasharray="4 4" />
        <ReferenceLine y={60} stroke="#f59e0b20" strokeDasharray="4 4" />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3f3f46', strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="score"
          stroke={lineColor}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: lineColor, stroke: '#18181b', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
