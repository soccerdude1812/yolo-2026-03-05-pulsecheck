// src/lib/scoring/rollup.ts
// Compute contributor weekly rollups from pr_lifecycle data.
// Groups PRs by contributor and week, computes per-contributor metrics.

import type { PRLifecycle, ContributorRollup } from '@/types/index';

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Compute contributor rollups for all weeks in the given PR data.
 * Returns one rollup record per (repoId, login, weekStart) tuple.
 * Matches the contributor_rollups table schema exactly.
 */
export function computeContributorRollups(
  repoId: string,
  prs: PRLifecycle[]
): Omit<ContributorRollup, 'id' | 'created_at' | 'updated_at'>[] {
  // Group by (author_login, week_start)
  const groups = new Map<string, PRLifecycle[]>();

  for (const pr of prs) {
    const key = `${pr.author_login}::${pr.week_start}`;
    const existing = groups.get(key) ?? [];
    existing.push(pr);
    groups.set(key, existing);
  }

  const rollups: Omit<ContributorRollup, 'id' | 'created_at' | 'updated_at'>[] = [];

  for (const [key, authorPRs] of Array.from(groups)) {
    const [login, weekStart] = key.split('::');

    const opened = authorPRs.length;
    const merged = authorPRs.filter((pr: PRLifecycle) => pr.state === 'merged');
    const closedUnmerged = authorPRs.filter(
      (pr: PRLifecycle) => pr.state === 'closed' && pr.merged_at === null
    );
    const reverts = authorPRs.filter((pr: PRLifecycle) => pr.is_revert);

    const linesAdded = authorPRs.reduce((sum: number, pr: PRLifecycle) => sum + pr.additions, 0);
    const linesDeleted = authorPRs.reduce((sum: number, pr: PRLifecycle) => sum + pr.deletions, 0);
    const totalLines = linesAdded + linesDeleted;
    const avgPRSizeLines = opened > 0 ? totalLines / opened : null;

    const reviewTimes = authorPRs
      .filter((pr: PRLifecycle) => pr.time_to_first_review_hrs !== null)
      .map((pr: PRLifecycle) => pr.time_to_first_review_hrs as number);

    // reviews_given: count how many reviews this contributor gave (tracked in PR records)
    // Note: review data is on the PR, not the reviewer — we track review_count on each PR
    // The reviewer data is available in pr_lifecycle via transform-pr.ts reviewer_logins
    // For rollup purposes, we count PRs where this contributor was NOT the author
    // but this info is not in pr_lifecycle directly (would need review records)
    // We use total_review_comments from PRs authored by this person as a proxy
    const totalReviewComments = authorPRs.reduce(
      (sum: number, pr: PRLifecycle) => sum + pr.total_review_comments,
      0
    );

    rollups.push({
      repo_id: repoId,
      github_login: login,
      week_start: weekStart,
      prs_opened: opened,
      prs_merged: merged.length,
      prs_closed_unmerged: closedUnmerged.length,
      lines_added: linesAdded,
      lines_deleted: linesDeleted,
      avg_pr_size_lines: avgPRSizeLines !== null ? Math.round(avgPRSizeLines * 100) / 100 : null,
      revert_prs: reverts.length,
      median_time_to_first_review_hrs: median(reviewTimes),
      // reviews_given will be computed from review data when available
      // For now use review_count sum across this contributor's PRs (reviews they received)
      reviews_given: 0,  // populated by reviewerRollups below
      review_comments_given: totalReviewComments,
      median_review_turnaround_hrs: null,
    });
  }

  return rollups;
}

/**
 * Compute reviews_given rollups from raw review data.
 * reviewsByPR: Map<prNumber, { reviewerLogin: string; submittedAt: string }[]>
 * prWeekMap: Map<prNumber, weekStart> — maps PR number to its week
 *
 * Returns a Map<`login::weekStart`, reviewsGiven> for merging into rollups.
 */
export interface ReviewRecord {
  prNumber: number;
  reviewerLogin: string;
  submittedAt: string;
}

export function computeReviewsGiven(
  reviewRecords: ReviewRecord[],
  prWeekMap: Map<number, string>
): Map<string, { reviewsGiven: number; reviewTurnaroundHrs: number[] }> {
  const reviewerMap = new Map<string, { reviewsGiven: number; reviewTurnaroundHrs: number[] }>();

  for (const record of reviewRecords) {
    const weekStart = prWeekMap.get(record.prNumber);
    if (!weekStart) continue;

    const key = `${record.reviewerLogin}::${weekStart}`;
    const existing = reviewerMap.get(key) ?? { reviewsGiven: 0, reviewTurnaroundHrs: [] };
    existing.reviewsGiven += 1;
    reviewerMap.set(key, existing);
  }

  return reviewerMap;
}

/**
 * Merge reviewer data into rollup records.
 */
export function mergeReviewsIntoRollups(
  rollups: Omit<ContributorRollup, 'id' | 'created_at' | 'updated_at'>[],
  reviewerData: Map<string, { reviewsGiven: number; reviewTurnaroundHrs: number[] }>
): Omit<ContributorRollup, 'id' | 'created_at' | 'updated_at'>[] {
  return rollups.map(rollup => {
    const key = `${rollup.github_login}::${rollup.week_start}`;
    const reviewData = reviewerData.get(key);

    if (!reviewData) return rollup;

    const turnaround =
      reviewData.reviewTurnaroundHrs.length > 0
        ? reviewData.reviewTurnaroundHrs.reduce((a, b) => a + b, 0) /
          reviewData.reviewTurnaroundHrs.length
        : null;

    return {
      ...rollup,
      reviews_given: reviewData.reviewsGiven,
      median_review_turnaround_hrs: turnaround,
    };
  });
}

/**
 * Get all unique weeks present in the PR data.
 * Sorted ascending (oldest first).
 */
export function getWeeksFromPRs(prs: PRLifecycle[]): string[] {
  const weeks = new Set(prs.map(pr => pr.week_start));
  return Array.from(weeks).sort();
}

/**
 * Filter PRs to a specific week.
 */
export function getPRsForWeek(prs: PRLifecycle[], weekStart: string): PRLifecycle[] {
  return prs.filter(pr => pr.week_start === weekStart);
}

/**
 * Get all open PRs (state = 'open') regardless of week.
 */
export function getOpenPRs(prs: PRLifecycle[]): PRLifecycle[] {
  return prs.filter(pr => pr.state === 'open');
}
