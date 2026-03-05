// src/lib/scoring/config.ts
// Single source of truth for all scoring weights and thresholds.
// All scoring functions import from here. Never hardcode numbers inline.
// APPROVED.md MF-9 defines this file — do not modify thresholds without updating the spec.

export const SCORING_WEIGHTS = {
  review_velocity:    0.30,
  contributor_rhythm: 0.20,
  stale_pr_burden:    0.20,
  pr_size_discipline: 0.12,
  review_depth:       0.10,
  revert_rate:        0.08,
} as const;

// Verify weights sum to 1.0
const _weightSum = Object.values(SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(_weightSum - 1.0) > 0.001) {
  throw new Error(`SCORING_WEIGHTS must sum to 1.0, got ${_weightSum}`);
}

// Review velocity: median hours from PR open → first review
// Ordered ascending — first matching maxHrs wins
export const REVIEW_VELOCITY_THRESHOLDS = [
  { maxHrs: 2,   score: 100 },
  { maxHrs: 4,   score: 90  },
  { maxHrs: 8,   score: 75  },
  { maxHrs: 24,  score: 50  },
  { maxHrs: 48,  score: 25  },
] as const;
// T > 48: max(0, 25 - (T - 48) / 2)

// Stale PR burden: ratio of stale open PRs to total open PRs
export const STALE_PR_THRESHOLDS = [
  { maxRatio: 0,    score: 100 },
  { maxRatio: 0.05, score: 90  },
  { maxRatio: 0.10, score: 75  },
  { maxRatio: 0.20, score: 50  },
  { maxRatio: 0.35, score: 25  },
] as const;
// ratio > 0.35: score = 10

// PR size discipline: median lines changed (additions + deletions) per PR
export const PR_SIZE_THRESHOLDS = [
  { maxLines: 100, score: 100 },
  { maxLines: 200, score: 90  },
  { maxLines: 400, score: 75  },
  { maxLines: 600, score: 55  },
  { maxLines: 800, score: 35  },
] as const;
// >= 800 lines: score = 15

// Review depth: ratio of PRs that received ≥1 substantive review comment (not just APPROVED)
export const REVIEW_DEPTH_THRESHOLDS = [
  { minRatio: 0.7, score: 100 },
  { minRatio: 0.5, score: 80  },
  { minRatio: 0.3, score: 60  },
  { minRatio: 0.1, score: 40  },
] as const;
// < 0.1: score = 20

// Revert rate: ratio of PRs that are reverts to total merged PRs
export const REVERT_RATE_THRESHOLDS = [
  { maxRate: 0,    score: 100 },
  { maxRate: 0.02, score: 90  },
  { maxRate: 0.05, score: 70  },
  { maxRate: 0.10, score: 40  },
] as const;
// > 0.10: score = 10

// Rhythm degradation flags — thresholds for comparing 4-week rolling vs 12-week baseline
export const RHYTHM_FLAGS = {
  reviewDropWarningPct:  0.30,  // 30% drop in reviews/week → warning
  reviewDropCriticalPct: 0.60,  // 60% drop → critical
  reviewMinBaseline:     0.5,   // only flag if contributor averages >= 0.5 reviews/week
  prDropWarningPct:      0.40,  // 40% drop in PRs opened/week → warning
  prDropCriticalPct:     0.70,  // 70% drop → critical
  prMinBaseline:         0.5,   // only flag if contributor averages >= 0.5 PRs/week
  sizeSpikePct:          1.50,  // 150% of baseline avg size = warning
  silentWeeksWarning:    2,     // 2 consecutive silent weeks → warning
  silentWeeksCritical:   3,     // 3 consecutive silent weeks → critical
} as const;

// Sync timing budgets (milliseconds)
export const SYNC_TIMING = {
  maxTotalMs:         55000,  // absolute hard limit (Vercel = 60s, we leave 5s margin)
  earlyBailoutMs:     50000,  // stop attempting new steps
  maxFetchMs:         38000,  // stop paginating at this elapsed mark
  perRepoMaxMs:       40000,  // cron: if one repo took this long, stop looping
  cronBailoutMs:      50000,  // cron: stop processing repos at this total elapsed
  reviewsPerPrCap:    100,    // max reviews fetched per PR (1 page)
  prsPerSyncCap:      3000,   // max PRs per sync = 30 pages × 100/page
} as const;

export const BASELINE_WEEKS = 12;     // weeks of history for rhythm baseline computation
export const MIN_BASELINE_WEEKS = 4;  // min weeks before rhythm flags fire (new repos exempt)
export const STALE_PR_DAYS = 7;       // days without activity before a PR is considered stale
export const INITIAL_BACKFILL_DAYS = 90;  // days of history to fetch on first sync (MF-2)
