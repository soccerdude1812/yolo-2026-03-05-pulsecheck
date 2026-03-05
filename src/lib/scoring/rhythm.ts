// src/lib/scoring/rhythm.ts
// Rhythm degradation detector.
// Compares 4-week rolling average vs 12-week baseline for each contributor.
// Flags drops per RHYTHM_FLAGS config. New contributors (< MIN_BASELINE_WEEKS) are exempt.

import {
  RHYTHM_FLAGS,
  BASELINE_WEEKS,
  MIN_BASELINE_WEEKS,
} from './config';
import type { ContributorRollup, RhythmFlag, RhythmFlagType, RhythmFlagSeverity } from '@/types/index';

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Detect a silent contributor (no PRs opened AND no reviews given for N consecutive weeks).
 */
function detectSilentWeeks(
  recentRollups: ContributorRollup[],
  sortedWeeks: string[]
): number {
  // Count trailing silent weeks (from most recent)
  let silentCount = 0;
  const sorted = [...sortedWeeks].sort().reverse();

  for (const week of sorted) {
    const rollup = recentRollups.find(r => r.week_start === week);
    if (!rollup || (rollup.prs_opened === 0 && rollup.reviews_given === 0)) {
      silentCount++;
    } else {
      break;
    }
  }

  return silentCount;
}

/**
 * Compute rhythm flags for all contributors for a given week.
 * Uses BASELINE_WEEKS historical data to compute baselines.
 * MIN_BASELINE_WEEKS: if contributor has fewer weeks, skip (new contributor).
 *
 * @param allRollups - All rollup records for the repo (all contributors, all weeks)
 * @param currentWeekStart - The week we're computing flags for
 * @param allWeeks - All week_start dates present in the data, sorted ascending
 */
export function computeRhythmFlags(
  allRollups: ContributorRollup[],
  currentWeekStart: string,
  allWeeks: string[]
): RhythmFlag[] {
  const flags: RhythmFlag[] = [];

  // Get all unique contributor logins
  const logins = Array.from(new Set(allRollups.map(r => r.github_login)));

  // Weeks up to and including currentWeekStart
  const relevantWeeks = allWeeks.filter(w => w <= currentWeekStart);

  for (const login of logins) {
    const contributorRollups = allRollups.filter(r => r.github_login === login);
    const contributorWeeks = contributorRollups.map(r => r.week_start);

    // Skip contributors with fewer than MIN_BASELINE_WEEKS of history
    const weeksWithData = contributorWeeks.filter(w => w <= currentWeekStart);
    if (weeksWithData.length < MIN_BASELINE_WEEKS) {
      continue;
    }

    // Baseline: last BASELINE_WEEKS total
    const baselineWeeks = relevantWeeks.slice(-BASELINE_WEEKS);
    const baselineRollups = contributorRollups.filter(r =>
      baselineWeeks.includes(r.week_start)
    );

    // Rolling: last 4 weeks
    const rollingWeeks = relevantWeeks.slice(-4);
    const rollingRollups = contributorRollups.filter(r =>
      rollingWeeks.includes(r.week_start)
    );

    // ─── Reviews Given ────────────────────────────────────────────────────────
    const baselineReviewsPerWeek = average(
      baselineWeeks.map(w => {
        const r = baselineRollups.find(b => b.week_start === w);
        return r?.reviews_given ?? 0;
      })
    );

    const rollingReviewsPerWeek = average(
      rollingWeeks.map(w => {
        const r = rollingRollups.find(b => b.week_start === w);
        return r?.reviews_given ?? 0;
      })
    );

    if (baselineReviewsPerWeek >= RHYTHM_FLAGS.reviewMinBaseline && baselineReviewsPerWeek > 0) {
      const dropPct = (baselineReviewsPerWeek - rollingReviewsPerWeek) / baselineReviewsPerWeek;

      let severity: RhythmFlagSeverity | null = null;
      if (dropPct >= RHYTHM_FLAGS.reviewDropCriticalPct) {
        severity = 'critical';
      } else if (dropPct >= RHYTHM_FLAGS.reviewDropWarningPct) {
        severity = 'warning';
      }

      if (severity) {
        flags.push({
          contributor: login,
          flag_type: 'review_drop' as RhythmFlagType,
          severity,
          current_value: Math.round(rollingReviewsPerWeek * 100) / 100,
          baseline_value: Math.round(baselineReviewsPerWeek * 100) / 100,
          week_start: currentWeekStart,
          description: `${login}'s review rate dropped ${Math.round(dropPct * 100)}% vs 12-week baseline (${rollingReviewsPerWeek.toFixed(1)}/wk vs ${baselineReviewsPerWeek.toFixed(1)}/wk baseline)`,
        });
      }
    }

    // ─── PRs Opened ───────────────────────────────────────────────────────────
    const baselinePRsPerWeek = average(
      baselineWeeks.map(w => {
        const r = baselineRollups.find(b => b.week_start === w);
        return r?.prs_opened ?? 0;
      })
    );

    const rollingPRsPerWeek = average(
      rollingWeeks.map(w => {
        const r = rollingRollups.find(b => b.week_start === w);
        return r?.prs_opened ?? 0;
      })
    );

    if (baselinePRsPerWeek >= RHYTHM_FLAGS.prMinBaseline && baselinePRsPerWeek > 0) {
      const dropPct = (baselinePRsPerWeek - rollingPRsPerWeek) / baselinePRsPerWeek;

      let severity: RhythmFlagSeverity | null = null;
      if (dropPct >= RHYTHM_FLAGS.prDropCriticalPct) {
        severity = 'critical';
      } else if (dropPct >= RHYTHM_FLAGS.prDropWarningPct) {
        severity = 'warning';
      }

      if (severity) {
        flags.push({
          contributor: login,
          flag_type: 'pr_drop' as RhythmFlagType,
          severity,
          current_value: Math.round(rollingPRsPerWeek * 100) / 100,
          baseline_value: Math.round(baselinePRsPerWeek * 100) / 100,
          week_start: currentWeekStart,
          description: `${login}'s PR output dropped ${Math.round(dropPct * 100)}% vs 12-week baseline (${rollingPRsPerWeek.toFixed(1)}/wk vs ${baselinePRsPerWeek.toFixed(1)}/wk baseline)`,
        });
      }
    }

    // ─── PR Size Spike ────────────────────────────────────────────────────────
    const baselineAvgSize = average(
      baselineRollups
        .filter(r => r.avg_pr_size_lines !== null)
        .map(r => r.avg_pr_size_lines as number)
    );

    const currentRollup = contributorRollups.find(r => r.week_start === currentWeekStart);
    const currentAvgSize = currentRollup?.avg_pr_size_lines ?? null;

    if (baselineAvgSize > 0 && currentAvgSize !== null) {
      const spikePct = currentAvgSize / baselineAvgSize;
      if (spikePct >= RHYTHM_FLAGS.sizeSpikePct) {
        flags.push({
          contributor: login,
          flag_type: 'size_spike' as RhythmFlagType,
          severity: 'warning',
          current_value: Math.round(currentAvgSize),
          baseline_value: Math.round(baselineAvgSize),
          week_start: currentWeekStart,
          description: `${login}'s avg PR size is ${Math.round(currentAvgSize)} lines (${Math.round(spikePct * 100)}% of ${Math.round(baselineAvgSize)}-line baseline)`,
        });
      }
    }

    // ─── Silent Contributor ───────────────────────────────────────────────────
    const allContribWeeks = relevantWeeks;
    const silentWeeks = detectSilentWeeks(contributorRollups, allContribWeeks);

    let silentSeverity: RhythmFlagSeverity | null = null;
    if (silentWeeks >= RHYTHM_FLAGS.silentWeeksCritical) {
      silentSeverity = 'critical';
    } else if (silentWeeks >= RHYTHM_FLAGS.silentWeeksWarning) {
      silentSeverity = 'warning';
    }

    if (silentSeverity) {
      flags.push({
        contributor: login,
        flag_type: 'silent_contributor' as RhythmFlagType,
        severity: silentSeverity,
        current_value: silentWeeks,
        baseline_value: 0,
        week_start: currentWeekStart,
        description: `${login} has been inactive for ${silentWeeks} consecutive weeks (no PRs opened or reviews given)`,
      });
    }
  }

  return flags;
}
