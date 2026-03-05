'use client';

import type { ContributorRollup } from '@/types/index';

interface ContributorHeatmapProps {
  rollups: ContributorRollup[];
  weeks: string[]; // ISO date strings for column headers, sorted ascending
}

function getActivityLevel(prsOpened: number, reviewsGiven: number): number {
  const total = prsOpened + reviewsGiven;
  if (total === 0) return 0;
  if (total <= 1) return 1;
  if (total <= 3) return 2;
  if (total <= 6) return 3;
  return 4;
}

const levelColors = [
  'bg-zinc-800 border-zinc-700',           // 0: none
  'bg-emerald-900/60 border-emerald-800',  // 1: low
  'bg-emerald-800/70 border-emerald-700',  // 2: medium
  'bg-emerald-600/80 border-emerald-500',  // 3: high
  'bg-emerald-500 border-emerald-400',     // 4: very high
];

const levelLabels = ['No activity', '1–1 actions', '2–3 actions', '4–6 actions', '7+ actions'];

function formatWeek(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
}

export function ContributorHeatmap({ rollups, weeks }: ContributorHeatmapProps) {
  if (!rollups.length || !weeks.length) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
        No contributor data available
      </div>
    );
  }

  // Build lookup: login → week → rollup
  const lookup = new Map<string, Map<string, ContributorRollup>>();
  for (const r of rollups) {
    if (!lookup.has(r.github_login)) lookup.set(r.github_login, new Map());
    lookup.get(r.github_login)!.set(r.week_start, r);
  }

  // Get unique contributors sorted by total activity desc
  const contributors = Array.from(lookup.keys()).sort((a, b) => {
    const aTotal = Array.from(lookup.get(a)?.values() ?? []).reduce(
      (sum, r) => sum + r.prs_opened + r.reviews_given, 0
    );
    const bTotal = Array.from(lookup.get(b)?.values() ?? []).reduce(
      (sum, r) => sum + r.prs_opened + r.reviews_given, 0
    );
    return bTotal - aTotal;
  });

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div style={{ minWidth: `${Math.max(600, weeks.length * 36 + 160)}px` }}>
        {/* Week headers */}
        <div className="flex items-center gap-1 mb-2 pl-40">
          {weeks.map((w, i) => (
            <div
              key={w}
              className="w-8 text-center text-[10px] text-zinc-600"
              style={{ flexShrink: 0 }}
            >
              {i === 0 || i === weeks.length - 1 || i % 4 === 0 ? formatWeek(w) : ''}
            </div>
          ))}
        </div>

        {/* Contributor rows */}
        <div className="space-y-1">
          {contributors.map((login) => {
            const byWeek = lookup.get(login)!;
            return (
              <div key={login} className="flex items-center gap-1">
                {/* Login */}
                <div className="w-36 shrink-0 pr-3 text-right">
                  <a
                    href={`/dashboard/contributors/${encodeURIComponent(login)}`}
                    className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors truncate block font-mono"
                    title={`@${login}`}
                  >
                    @{login}
                  </a>
                </div>

                {/* Cells */}
                {weeks.map((week) => {
                  const r = byWeek.get(week);
                  const level = r ? getActivityLevel(r.prs_opened, r.reviews_given) : 0;
                  const tooltip = r
                    ? `${formatWeek(week)}: ${r.prs_opened} PRs opened, ${r.reviews_given} reviews`
                    : `${formatWeek(week)}: No activity`;

                  return (
                    <div
                      key={week}
                      title={tooltip}
                      className={`w-8 h-8 rounded border ${levelColors[level]} transition-all hover:scale-110 shrink-0 cursor-default`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 pl-40">
          <span className="text-xs text-zinc-500">Less</span>
          {levelColors.map((cls, i) => (
            <div
              key={i}
              title={levelLabels[i]}
              className={`w-4 h-4 rounded-sm border ${cls}`}
            />
          ))}
          <span className="text-xs text-zinc-500">More</span>
        </div>
      </div>
    </div>
  );
}
