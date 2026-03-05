'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { ContributorSummary, RhythmFlag } from '@/types/index';

interface ContributorTableProps {
  contributors: ContributorSummary[];
  repoId: string | null;
  canDeepDive: boolean;
}

function RhythmFlagBadge({ flag }: { flag: RhythmFlag }) {
  const isWarning = flag.severity === 'warning';
  return (
    <Badge variant={isWarning ? 'amber' : 'rose'} className="text-[10px]">
      {flag.flag_type === 'review_drop' && 'Review drop'}
      {flag.flag_type === 'pr_drop' && 'PR drop'}
      {flag.flag_type === 'size_spike' && 'Size spike'}
      {flag.flag_type === 'silent_contributor' && 'Silent'}
    </Badge>
  );
}

type SortKey = 'prs_opened' | 'reviews_given' | 'total_lines_added' | 'avg_review_turnaround_hrs';
type SortDir = 'asc' | 'desc';

export function ContributorTable({ contributors, repoId, canDeepDive }: ContributorTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('prs_opened');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...contributors].sort((a, b) => {
    let aVal: number, bVal: number;
    switch (sortKey) {
      case 'prs_opened': aVal = a.total_prs_opened; bVal = b.total_prs_opened; break;
      case 'reviews_given': aVal = a.total_reviews_given; bVal = b.total_reviews_given; break;
      case 'total_lines_added': aVal = a.total_lines_added; bVal = b.total_lines_added; break;
      case 'avg_review_turnaround_hrs':
        aVal = a.avg_review_turnaround_hrs ?? Infinity;
        bVal = b.avg_review_turnaround_hrs ?? Infinity;
        break;
    }
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  function SortIcon({ field }: { field: SortKey }) {
    if (sortKey !== field) return <span className="text-zinc-700 ml-1">↕</span>;
    return <span className="text-emerald-400 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  }

  if (!contributors.length) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
        No contributor data for this period
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Contributor</th>
            <th
              className="text-right py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
              onClick={() => handleSort('prs_opened')}
            >
              PRs Opened <SortIcon field="prs_opened" />
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Merged</th>
            <th
              className="text-right py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
              onClick={() => handleSort('reviews_given')}
            >
              Reviews <SortIcon field="reviews_given" />
            </th>
            <th
              className="text-right py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors hidden sm:table-cell"
              onClick={() => handleSort('total_lines_added')}
            >
              Lines Added <SortIcon field="total_lines_added" />
            </th>
            <th
              className="text-right py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors hidden md:table-cell"
              onClick={() => handleSort('avg_review_turnaround_hrs')}
            >
              Review Speed <SortIcon field="avg_review_turnaround_hrs" />
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Flags</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {sorted.map((contributor) => {
            const recentFlags = contributor.rhythm_flags.slice(0, 2);
            const deepDiveHref = repoId
              ? `/dashboard/contributors/${encodeURIComponent(contributor.github_login)}?repo=${repoId}`
              : `/dashboard/contributors/${encodeURIComponent(contributor.github_login)}`;

            return (
              <tr key={contributor.github_login} className="hover:bg-zinc-800/30 transition-colors group">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    {contributor.avatar_url ? (
                      <img src={contributor.avatar_url} alt={contributor.github_login} className="w-7 h-7 rounded-full" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center">
                        <span className="text-xs text-zinc-400 font-medium">{contributor.github_login[0]?.toUpperCase()}</span>
                      </div>
                    )}
                    <div>
                      {canDeepDive ? (
                        <Link
                          href={deepDiveHref}
                          className="font-medium text-zinc-200 hover:text-emerald-400 transition-colors"
                        >
                          @{contributor.github_login}
                        </Link>
                      ) : (
                        <span className="font-medium text-zinc-200">@{contributor.github_login}</span>
                      )}
                      <div className="text-xs text-zinc-500">{contributor.weeks_active} weeks active</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-right text-zinc-300 font-medium tabular-nums">
                  {contributor.total_prs_opened}
                </td>
                <td className="py-3 px-4 text-right text-zinc-300 tabular-nums">
                  {contributor.total_prs_merged}
                </td>
                <td className="py-3 px-4 text-right text-zinc-300 tabular-nums">
                  {contributor.total_reviews_given}
                </td>
                <td className="py-3 px-4 text-right text-zinc-300 tabular-nums hidden sm:table-cell">
                  +{contributor.total_lines_added.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right tabular-nums hidden md:table-cell">
                  {contributor.avg_review_turnaround_hrs != null ? (
                    <span className={contributor.avg_review_turnaround_hrs < 24 ? 'text-emerald-400' : contributor.avg_review_turnaround_hrs < 48 ? 'text-amber-400' : 'text-rose-400'}>
                      {contributor.avg_review_turnaround_hrs < 24
                        ? `${Math.round(contributor.avg_review_turnaround_hrs)}h`
                        : `${(contributor.avg_review_turnaround_hrs / 24).toFixed(1)}d`}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {recentFlags.map((flag, i) => (
                      <RhythmFlagBadge key={i} flag={flag} />
                    ))}
                    {!recentFlags.length && <span className="text-zinc-700 text-xs">—</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
