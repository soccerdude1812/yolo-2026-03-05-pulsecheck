// src/lib/sync/transform-pr.ts
// Transform raw GitHub PR + reviews into our pr_lifecycle schema.
// Computes derived fields: time_to_first_review_hrs, time_to_approval_hrs,
// time_to_merge_hrs, week_start (Monday), is_revert.

import type { GitHubPR, GitHubReview, PRLifecycle } from '@/types/index';

/**
 * Get the Monday of the week containing the given date.
 * Returns ISO date string 'YYYY-MM-DD'.
 */
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // adjust so Monday=0
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Compute hours between two ISO date strings.
 * Returns null if either date is null/undefined.
 */
function hoursBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (diffMs < 0) return null; // sanity check — end before start
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
}

/**
 * Determine if a PR title indicates it's a revert.
 * GitHub auto-generates "Revert " prefix for revert PRs.
 */
function isRevertPR(title: string): boolean {
  return title.trimStart().startsWith('Revert ');
}

/**
 * Find the earliest non-PENDING review submission time (first review).
 * Excludes PENDING reviews which haven't been submitted yet.
 */
function findFirstReviewAt(reviews: GitHubReview[]): string | null {
  const submitted = reviews
    .filter(r => r.submitted_at && r.state !== 'PENDING')
    .map(r => r.submitted_at as string)
    .sort();

  return submitted.length > 0 ? submitted[0] : null;
}

/**
 * Find the earliest APPROVED review submission time.
 */
function findApprovedAt(reviews: GitHubReview[]): string | null {
  const approvals = reviews
    .filter(r => r.state === 'APPROVED' && r.submitted_at)
    .map(r => r.submitted_at as string)
    .sort();

  return approvals.length > 0 ? approvals[0] : null;
}

/**
 * Transform a raw GitHub PR + its reviews into a PRLifecycle record.
 * Matches the pr_lifecycle table schema exactly.
 */
export function transformPR(
  repoId: string,
  pr: GitHubPR,
  reviews: GitHubReview[]
): Omit<PRLifecycle, 'id' | 'synced_at'> {
  const authorLogin = pr.user?.login ?? 'unknown';
  const createdAt = pr.created_at;

  // Determine state
  let state: 'open' | 'closed' | 'merged';
  if (pr.merged_at) {
    state = 'merged';
  } else if (pr.state === 'closed') {
    state = 'closed';
  } else {
    state = 'open';
  }

  const firstReviewAt = findFirstReviewAt(reviews);
  const approvedAt = findApprovedAt(reviews);

  // Only count reviews from reviewers other than the author
  const externalReviews = reviews.filter(r => r.user?.login !== authorLogin);
  const reviewCount = externalReviews.filter(r => r.state !== 'PENDING').length;
  const totalReviewComments = externalReviews.filter(
    r => r.body && r.body.trim().length > 0
  ).length;

  // week_start: Monday of the week the PR was opened
  const weekStart = getWeekStart(new Date(createdAt));

  return {
    repo_id: repoId,
    github_pr_number: pr.number,
    title: pr.title,
    author_login: authorLogin,
    state,
    created_at_gh: createdAt,
    first_review_at: firstReviewAt,
    approved_at: approvedAt,
    merged_at: pr.merged_at,
    closed_at: pr.closed_at,
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changed_files,
    total_review_comments: totalReviewComments,
    review_count: reviewCount,
    is_revert: isRevertPR(pr.title),
    week_start: weekStart,
    time_to_first_review_hrs: hoursBetween(createdAt, firstReviewAt),
    time_to_approval_hrs: hoursBetween(createdAt, approvedAt),
    time_to_merge_hrs: hoursBetween(createdAt, pr.merged_at),
  };
}

/**
 * Transform multiple PRs + their reviews into PRLifecycle records.
 * reviewMap: Map<prNumber, reviews[]>
 */
export function transformPRBatch(
  repoId: string,
  prs: GitHubPR[],
  reviewMap: Map<number, GitHubReview[]>
): Omit<PRLifecycle, 'id' | 'synced_at'>[] {
  return prs.map(pr => {
    const reviews = reviewMap.get(pr.number) ?? [];
    return transformPR(repoId, pr, reviews);
  });
}
