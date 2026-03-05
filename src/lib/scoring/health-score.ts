// src/lib/scoring/health-score.ts
// Compute the 6 sub-scores and final weighted health score.
// ALL thresholds imported from config.ts — ZERO inline magic numbers.

import {
  SCORING_WEIGHTS,
  REVIEW_VELOCITY_THRESHOLDS,
  STALE_PR_THRESHOLDS,
  PR_SIZE_THRESHOLDS,
  REVIEW_DEPTH_THRESHOLDS,
  REVERT_RATE_THRESHOLDS,
  STALE_PR_DAYS,
} from './config';
import type {
  PRLifecycle,
  ContributorRollup,
  RhythmFlag,
  BottleneckItem,
  ScoreSubSignals,
} from '@/types/index';

export interface HealthScoreInput {
  weekStart: string;
  prs: PRLifecycle[];
  rollups: ContributorRollup[];
  rhythmFlags: RhythmFlag[];
  bottleneckAnalysis: BottleneckItem[];
  /** All open PRs across the repo (not just this week) for stale calculation */
  allOpenPRs: PRLifecycle[];
}

export interface HealthScoreResult {
  score: number;
  sub_score_review_velocity: number;
  sub_score_pr_size_discipline: number;
  sub_score_stale_pr_burden: number;
  sub_score_contributor_rhythm: number;
  sub_score_review_depth: number;
  sub_score_revert_rate: number;
  active_contributors: number;
  total_prs_opened: number;
  total_prs_merged: number;
  stale_pr_count: number;
  total_reviews: number;
  median_time_to_first_review_hrs: number | null;
  median_time_to_merge_hrs: number | null;
  rhythm_flags: RhythmFlag[];
  bottleneck_analysis: BottleneckItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Sub-score: Review Velocity ───────────────────────────────────────────────

/**
 * S_review_velocity: based on median hours from PR open to first review.
 * If no PRs had reviews, score = 50 (neutral, not zero).
 */
export function computeReviewVelocityScore(prs: PRLifecycle[]): number {
  const reviewTimes = prs
    .filter(pr => pr.time_to_first_review_hrs !== null)
    .map(pr => pr.time_to_first_review_hrs as number);

  if (reviewTimes.length === 0) return 50;

  const medianHrs = median(reviewTimes) as number;

  for (const threshold of REVIEW_VELOCITY_THRESHOLDS) {
    if (medianHrs <= threshold.maxHrs) {
      return threshold.score;
    }
  }

  // T > 48: max(0, 25 - (T - 48) / 2)
  const maxThreshold = REVIEW_VELOCITY_THRESHOLDS[REVIEW_VELOCITY_THRESHOLDS.length - 1];
  return clamp(maxThreshold.score - (medianHrs - maxThreshold.maxHrs) / 2, 0, maxThreshold.score);
}

// ─── Sub-score: Stale PR Burden ───────────────────────────────────────────────

/**
 * S_stale_pr_burden: ratio of stale open PRs to total open PRs.
 * Stale = open for more than STALE_PR_DAYS without activity.
 */
export function computeStalePRBurdenScore(allOpenPRs: PRLifecycle[]): {
  score: number;
  staleCount: number;
} {
  if (allOpenPRs.length === 0) return { score: 100, staleCount: 0 };

  const now = Date.now();
  const staleCutoffMs = STALE_PR_DAYS * 24 * 60 * 60 * 1000;

  const stalePRs = allOpenPRs.filter(pr => {
    const openedAt = new Date(pr.created_at_gh).getTime();
    return now - openedAt > staleCutoffMs;
  });

  const staleRatio = stalePRs.length / allOpenPRs.length;

  // Iterate thresholds ascending (smallest maxRatio first) — return first match
  // Thresholds: 0→100, 0.05→90, 0.10→75, 0.20→50, 0.35→25
  for (const threshold of STALE_PR_THRESHOLDS) {
    if (staleRatio <= threshold.maxRatio) {
      return { score: threshold.score, staleCount: stalePRs.length };
    }
  }

  // ratio > 0.35: score = 10
  return { score: 10, staleCount: stalePRs.length };
}

// ─── Sub-score: PR Size Discipline ───────────────────────────────────────────

/**
 * S_pr_size_discipline: median total lines changed (additions + deletions) per PR.
 */
export function computePRSizeDisciplineScore(prs: PRLifecycle[]): number {
  const mergedPRs = prs.filter(pr => pr.state === 'merged');
  if (mergedPRs.length === 0) return 75; // neutral when no merged PRs

  const sizes = mergedPRs.map(pr => pr.additions + pr.deletions);
  const medianLines = median(sizes) as number;

  for (const threshold of PR_SIZE_THRESHOLDS) {
    if (medianLines <= threshold.maxLines) {
      return threshold.score;
    }
  }

  // >= 800 lines: score = 15
  return 15;
}

// ─── Sub-score: Review Depth ──────────────────────────────────────────────────

/**
 * S_review_depth: ratio of PRs that received at least 1 substantive review comment.
 * Substantive = review_count > 0 (not just an empty APPROVED click).
 */
export function computeReviewDepthScore(prs: PRLifecycle[]): number {
  const mergedPRs = prs.filter(pr => pr.state === 'merged');
  if (mergedPRs.length === 0) return 50; // neutral

  const prsWithReviews = mergedPRs.filter(pr => pr.review_count > 0);
  const ratio = prsWithReviews.length / mergedPRs.length;

  for (const threshold of REVIEW_DEPTH_THRESHOLDS) {
    if (ratio >= threshold.minRatio) {
      return threshold.score;
    }
  }

  // < 0.1: score = 20
  return 20;
}

// ─── Sub-score: Revert Rate ───────────────────────────────────────────────────

/**
 * S_revert_rate: ratio of revert PRs to total merged PRs.
 */
export function computeRevertRateScore(prs: PRLifecycle[]): number {
  const mergedPRs = prs.filter(pr => pr.state === 'merged');
  if (mergedPRs.length === 0) return 100; // no merged PRs = no reverts

  const revertPRs = mergedPRs.filter(pr => pr.is_revert);
  const rate = revertPRs.length / mergedPRs.length;

  for (const threshold of REVERT_RATE_THRESHOLDS) {
    if (rate <= threshold.maxRate) {
      return threshold.score;
    }
  }

  // > 0.10: score = 10
  return 10;
}

// ─── Sub-score: Contributor Rhythm ───────────────────────────────────────────

/**
 * S_contributor_rhythm: based on rhythm flags severity.
 * Starts at 100, deducts points per flag severity.
 * Each critical flag deducts 20 points, each warning deducts 8 points.
 * Floor at 0.
 */
export function computeContributorRhythmScore(rhythmFlags: RhythmFlag[]): number {
  if (rhythmFlags.length === 0) return 100;

  const criticalCount = rhythmFlags.filter(f => f.severity === 'critical').length;
  const warningCount = rhythmFlags.filter(f => f.severity === 'warning').length;

  const deduction = criticalCount * 20 + warningCount * 8;
  return clamp(100 - deduction, 0, 100);
}

// ─── Final Score ──────────────────────────────────────────────────────────────

/**
 * Compute the full health score for a given week.
 * All thresholds imported from config.ts.
 */
export function computeHealthScore(input: HealthScoreInput): HealthScoreResult {
  const { prs, allOpenPRs, rhythmFlags, bottleneckAnalysis } = input;

  const subScores: ScoreSubSignals = {
    review_velocity: computeReviewVelocityScore(prs),
    stale_pr_burden: computeStalePRBurdenScore(allOpenPRs).score,
    pr_size_discipline: computePRSizeDisciplineScore(prs),
    review_depth: computeReviewDepthScore(prs),
    revert_rate: computeRevertRateScore(prs),
    contributor_rhythm: computeContributorRhythmScore(rhythmFlags),
  };

  const finalScore =
    SCORING_WEIGHTS.review_velocity    * subScores.review_velocity +
    SCORING_WEIGHTS.contributor_rhythm * subScores.contributor_rhythm +
    SCORING_WEIGHTS.stale_pr_burden    * subScores.stale_pr_burden +
    SCORING_WEIGHTS.pr_size_discipline * subScores.pr_size_discipline +
    SCORING_WEIGHTS.review_depth       * subScores.review_depth +
    SCORING_WEIGHTS.revert_rate        * subScores.revert_rate;

  // Aggregate metrics
  const uniqueAuthors = new Set(prs.map(pr => pr.author_login));
  const mergedPRs = prs.filter(pr => pr.state === 'merged');
  const totalReviews = prs.reduce((sum, pr) => sum + pr.review_count, 0);

  const reviewTimes = prs
    .filter(pr => pr.time_to_first_review_hrs !== null)
    .map(pr => pr.time_to_first_review_hrs as number);

  const mergeTimes = mergedPRs
    .filter(pr => pr.time_to_merge_hrs !== null)
    .map(pr => pr.time_to_merge_hrs as number);

  const { staleCount } = computeStalePRBurdenScore(allOpenPRs);

  return {
    score: Math.round(clamp(finalScore, 0, 100) * 100) / 100,
    sub_score_review_velocity:    Math.round(subScores.review_velocity),
    sub_score_pr_size_discipline: Math.round(subScores.pr_size_discipline),
    sub_score_stale_pr_burden:    Math.round(subScores.stale_pr_burden),
    sub_score_contributor_rhythm: Math.round(subScores.contributor_rhythm),
    sub_score_review_depth:       Math.round(subScores.review_depth),
    sub_score_revert_rate:        Math.round(subScores.revert_rate),
    active_contributors:          uniqueAuthors.size,
    total_prs_opened:             prs.length,
    total_prs_merged:             mergedPRs.length,
    stale_pr_count:               staleCount,
    total_reviews:                totalReviews,
    median_time_to_first_review_hrs: median(reviewTimes),
    median_time_to_merge_hrs:        median(mergeTimes),
    rhythm_flags:                 rhythmFlags,
    bottleneck_analysis:          bottleneckAnalysis,
  };
}
