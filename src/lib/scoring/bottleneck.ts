// src/lib/scoring/bottleneck.ts
// Bottleneck analysis: compute time distribution across PR lifecycle stages
// and identify concentration risks.

import type { PRLifecycle, BottleneckItem, BottleneckType, RhythmFlagSeverity } from '@/types/index';

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Compute bottleneck analysis for a week's PRs.
 * Identifies:
 *   1. Review concentration (few reviewers handling all reviews)
 *   2. Author concentration (one author opening disproportionate PRs)
 *   3. Slow lane (specific authors' PRs take longer)
 *   4. Large PR patterns (author consistently opens oversized PRs)
 */
export function computeBottleneckAnalysis(
  prs: PRLifecycle[],
  /** All PRs for the repo (for reviewer concentration across periods) */
  allPRs?: PRLifecycle[]
): BottleneckItem[] {
  const bottlenecks: BottleneckItem[] = [];
  const mergedPRs = prs.filter(pr => pr.state === 'merged');

  if (prs.length === 0) return bottlenecks;

  // ─── 1. Author Concentration ──────────────────────────────────────────────
  if (prs.length >= 3) {
    const authorCounts = new Map<string, number>();
    for (const pr of prs) {
      authorCounts.set(pr.author_login, (authorCounts.get(pr.author_login) ?? 0) + 1);
    }

    const totalPRs = prs.length;
    for (const [author, count] of Array.from(authorCounts)) {
      const ratio = count / totalPRs;
      if (ratio >= 0.5 && authorCounts.size >= 2) {
        bottlenecks.push({
          type: 'author_concentration' as BottleneckType,
          severity: ratio >= 0.7 ? 'critical' : ('warning' as RhythmFlagSeverity),
          contributors_involved: [author],
          metric: 'PR authorship share',
          value: Math.round(ratio * 100),
          baseline: Math.round((1 / authorCounts.size) * 100),
          description: `${author} opened ${Math.round(ratio * 100)}% of PRs this week (${count}/${totalPRs}). Expected ~${Math.round((1 / authorCounts.size) * 100)}% with ${authorCounts.size} contributors.`,
        });
      }
    }
  }

  // ─── 2. Large PR Pattern ──────────────────────────────────────────────────
  if (mergedPRs.length >= 2) {
    const avgLines = average(mergedPRs.map(pr => pr.additions + pr.deletions));
    const authorAvgLines = new Map<string, number[]>();

    for (const pr of mergedPRs) {
      const lines = pr.additions + pr.deletions;
      const existing = authorAvgLines.get(pr.author_login) ?? [];
      existing.push(lines);
      authorAvgLines.set(pr.author_login, existing);
    }

    for (const [author, sizes] of Array.from(authorAvgLines)) {
      if (sizes.length < 2) continue;
      const authorAvg = average(sizes);
      if (avgLines > 0 && authorAvg > avgLines * 1.5 && authorAvg > 400) {
        bottlenecks.push({
          type: 'large_pr_pattern' as BottleneckType,
          severity: authorAvg > avgLines * 2 ? 'critical' : ('warning' as RhythmFlagSeverity),
          contributors_involved: [author],
          metric: 'avg lines changed per PR',
          value: Math.round(authorAvg),
          baseline: Math.round(avgLines),
          description: `${author}'s PRs average ${Math.round(authorAvg)} lines — ${Math.round(authorAvg / avgLines)}x the team average of ${Math.round(avgLines)} lines.`,
        });
      }
    }
  }

  // ─── 3. Slow Lane (author-specific PR slowness) ───────────────────────────
  if (mergedPRs.length >= 4) {
    const globalMedianMerge = median(
      mergedPRs.filter(pr => pr.time_to_merge_hrs !== null).map(pr => pr.time_to_merge_hrs!)
    );

    if (globalMedianMerge !== null) {
      const authorMergeTimes = new Map<string, number[]>();
      for (const pr of mergedPRs) {
        if (pr.time_to_merge_hrs === null) continue;
        const existing = authorMergeTimes.get(pr.author_login) ?? [];
        existing.push(pr.time_to_merge_hrs);
        authorMergeTimes.set(pr.author_login, existing);
      }

      for (const [author, times] of Array.from(authorMergeTimes)) {
        if (times.length < 2) continue;
        const authorMedian = median(times) as number;
        if (authorMedian > globalMedianMerge * 1.8 && authorMedian > 24) {
          bottlenecks.push({
            type: 'slow_lane' as BottleneckType,
            severity: authorMedian > globalMedianMerge * 3 ? 'critical' : ('warning' as RhythmFlagSeverity),
            contributors_involved: [author],
            metric: 'median hours to merge',
            value: Math.round(authorMedian),
            baseline: Math.round(globalMedianMerge),
            description: `${author}'s PRs take ${Math.round(authorMedian)}h to merge on median — ${(authorMedian / globalMedianMerge).toFixed(1)}x the team median of ${Math.round(globalMedianMerge)}h.`,
          });
        }
      }
    }
  }

  // ─── 4. Stale PR Authors ──────────────────────────────────────────────────
  const now = Date.now();
  const staleCutoff = 7 * 24 * 60 * 60 * 1000;
  const stalePRsByAuthor = new Map<string, number>();

  for (const pr of prs.filter(p => p.state === 'open')) {
    const age = now - new Date(pr.created_at_gh).getTime();
    if (age > staleCutoff) {
      stalePRsByAuthor.set(
        pr.author_login,
        (stalePRsByAuthor.get(pr.author_login) ?? 0) + 1
      );
    }
  }

  for (const [author, staleCount] of Array.from(stalePRsByAuthor)) {
    if (staleCount >= 2) {
      bottlenecks.push({
        type: 'stale_pr_author' as BottleneckType,
        severity: staleCount >= 3 ? 'critical' : ('warning' as RhythmFlagSeverity),
        contributors_involved: [author],
        metric: 'stale open PRs',
        value: staleCount,
        baseline: 0,
        description: `${author} has ${staleCount} open PRs that have been waiting 7+ days without activity.`,
      });
    }
  }

  return bottlenecks;
}
