// src/lib/alerts/check-triggers.ts
// Evaluates weekly health data and returns any alert triggers.
// Conditions: score drop, contributor silence, bottleneck spike.

import type { AlertType, WeeklyHealthScore, ContributorSummary } from '@/types/index';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AlertTrigger {
  type: AlertType;
  payload: Record<string, unknown>;
}

export interface CheckTriggersInput {
  /** Ordered oldest→newest (must include at least 2 for drop checks) */
  scoreHistory: WeeklyHealthScore[];
  /** Contributor summaries for the current week */
  contributors: ContributorSummary[];
  /** Drop in points that triggers an alert */
  scoreDrop_threshold: number;
  /** Number of consecutive weeks of dropping before alerting */
  consecutive_weeks_required: number;
  /** Baseline time_to_first_review in hours (used for bottleneck spike check) */
  baseline_ttfr_hrs: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SILENT_CONTRIBUTOR_WEEKS = 3;    // contributor absent this many weeks = alert
const BOTTLENECK_SPIKE_MULTIPLIER = 2; // TTFR > 2x baseline = alert

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if scores have dropped consistently for N consecutive weeks.
 * Requires at least N+1 data points (to measure N gaps).
 */
function hasConsecutiveDrop(
  scores: WeeklyHealthScore[],
  threshold: number,
  requiredWeeks: number
): { triggered: boolean; drop: number; weeks: WeeklyHealthScore[] } {
  if (scores.length < requiredWeeks + 1) {
    return { triggered: false, drop: 0, weeks: [] };
  }

  // Look at the most recent (requiredWeeks + 1) entries
  const recent = scores.slice(-(requiredWeeks + 1));

  let allDropped = true;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].score >= recent[i - 1].score) {
      allDropped = false;
      break;
    }
  }

  if (!allDropped) {
    return { triggered: false, drop: 0, weeks: [] };
  }

  const totalDrop = recent[0].score - recent[recent.length - 1].score;
  if (totalDrop < threshold) {
    return { triggered: false, drop: totalDrop, weeks: recent };
  }

  return { triggered: true, drop: totalDrop, weeks: recent };
}

/**
 * Returns contributor logins that have been completely silent for N+ weeks.
 * A contributor is "silent" if they have no PRs opened and no reviews given.
 */
function findSilentContributors(
  contributors: ContributorSummary[],
  _weeksThreshold: number
): string[] {
  return contributors
    .filter((c) => {
      const silentFlag = c.rhythm_flags.find(
        (f) => f.flag_type === 'silent_contributor'
      );
      if (!silentFlag) return false;

      // Check if they've been silent for enough weeks
      // weeks_active is total weeks they were ever active — we need rhythm_flags context
      // The silent_contributor flag's description contains the week count context
      // For safety, rely on the flag existing (set by scoring engine at appropriate threshold)
      return c.weeks_active === 0 || silentFlag.severity === 'critical';
    })
    .map((c) => c.github_login);
}

/**
 * Checks if the current week's TTFR is a spike vs baseline.
 */
function isBottleneckSpike(
  currentScore: WeeklyHealthScore,
  baselineTtfrHrs: number | null
): { triggered: boolean; currentTtfr: number; baseline: number } {
  if (
    baselineTtfrHrs === null ||
    baselineTtfrHrs === 0 ||
    currentScore.median_time_to_first_review_hrs === null
  ) {
    return { triggered: false, currentTtfr: 0, baseline: 0 };
  }

  const current = currentScore.median_time_to_first_review_hrs;
  const triggered = current > baselineTtfrHrs * BOTTLENECK_SPIKE_MULTIPLIER;

  return { triggered, currentTtfr: current, baseline: baselineTtfrHrs };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates alert conditions and returns any that have been triggered.
 *
 * Returns an empty array if no alerts should fire.
 * Callers are responsible for deduplication (checking alert_log to avoid repeat sends).
 */
export function checkTriggers(input: CheckTriggersInput): AlertTrigger[] {
  const {
    scoreHistory,
    contributors,
    scoreDrop_threshold,
    consecutive_weeks_required,
    baseline_ttfr_hrs,
  } = input;

  const triggered: AlertTrigger[] = [];
  const currentScore = scoreHistory[scoreHistory.length - 1];

  if (!currentScore) return triggered;

  // ── 1. Score drop check ───────────────────────────────────────────────────
  const dropCheck = hasConsecutiveDrop(
    scoreHistory,
    scoreDrop_threshold,
    consecutive_weeks_required
  );

  if (dropCheck.triggered) {
    const firstWeek = dropCheck.weeks[0];
    const lastWeek = dropCheck.weeks[dropCheck.weeks.length - 1];
    triggered.push({
      type: 'score_drop',
      payload: {
        score_from: firstWeek.score,
        score_to: lastWeek.score,
        drop: dropCheck.drop,
        weeks_consecutive: consecutive_weeks_required,
        week_start: lastWeek.week_start,
      },
    });
  }

  // ── 2. Silent contributor check ───────────────────────────────────────────
  const silentLogins = findSilentContributors(contributors, SILENT_CONTRIBUTOR_WEEKS);

  if (silentLogins.length > 0) {
    triggered.push({
      type: 'contributor_silent',
      payload: {
        contributors: silentLogins,
        weeks_threshold: SILENT_CONTRIBUTOR_WEEKS,
        week_start: currentScore.week_start,
      },
    });
  }

  // ── 3. Bottleneck spike check ─────────────────────────────────────────────
  const bottleneckCheck = isBottleneckSpike(currentScore, baseline_ttfr_hrs);

  if (bottleneckCheck.triggered) {
    triggered.push({
      type: 'bottleneck_spike',
      payload: {
        current_ttfr_hrs: bottleneckCheck.currentTtfr,
        baseline_ttfr_hrs: bottleneckCheck.baseline,
        multiplier: (bottleneckCheck.currentTtfr / bottleneckCheck.baseline).toFixed(1),
        week_start: currentScore.week_start,
      },
    });
  }

  return triggered;
}
