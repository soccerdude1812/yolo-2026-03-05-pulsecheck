// tests/scoring/health-score.test.ts
// Unit tests for scoring functions.
// These are plain TypeScript assertions — no test framework required.
// Run with: npx tsx tests/scoring/health-score.test.ts

import {
  computeReviewVelocityScore,
  computeStalePRBurdenScore,
  computePRSizeDisciplineScore,
  computeReviewDepthScore,
  computeRevertRateScore,
  computeContributorRhythmScore,
  computeHealthScore,
} from '../../src/lib/scoring/health-score';
import type { PRLifecycle, RhythmFlag } from '../../src/types/index';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function assertClose(actual: number, expected: number, tolerance: number, message: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`FAIL: ${message} — expected ${expected}, got ${actual}`);
  }
}

// ─── Mock PR factory ──────────────────────────────────────────────────────────

function makePR(overrides: Partial<PRLifecycle> = {}): PRLifecycle {
  return {
    id: 'test-pr-id',
    repo_id: 'test-repo-id',
    github_pr_number: 1,
    title: 'Test PR',
    author_login: 'alice',
    state: 'merged',
    created_at_gh: '2026-01-01T10:00:00Z',
    first_review_at: '2026-01-01T11:00:00Z',
    approved_at: '2026-01-01T12:00:00Z',
    merged_at: '2026-01-01T14:00:00Z',
    closed_at: null,
    additions: 50,
    deletions: 20,
    changed_files: 3,
    total_review_comments: 2,
    review_count: 1,
    is_revert: false,
    week_start: '2025-12-30',
    time_to_first_review_hrs: 1.0,
    time_to_approval_hrs: 2.0,
    time_to_merge_hrs: 4.0,
    synced_at: '2026-01-01T15:00:00Z',
    ...overrides,
  };
}

// ─── Review Velocity Tests ────────────────────────────────────────────────────

console.log('Testing: computeReviewVelocityScore');

// No reviews → neutral score 50
{
  const score = computeReviewVelocityScore([makePR({ time_to_first_review_hrs: null })]);
  assert(score === 50, `No reviews should return 50, got ${score}`);
}

// 1 hour → score 100
{
  const score = computeReviewVelocityScore([makePR({ time_to_first_review_hrs: 1 })]);
  assert(score === 100, `1hr should return 100, got ${score}`);
}

// 3 hours → score 90
{
  const score = computeReviewVelocityScore([makePR({ time_to_first_review_hrs: 3 })]);
  assert(score === 90, `3hr should return 90, got ${score}`);
}

// 10 hours — between 8hr (75) and 24hr (50) thresholds → score 50 (hits maxHrs: 24)
{
  const score = computeReviewVelocityScore([makePR({ time_to_first_review_hrs: 10 })]);
  assert(score === 50, `10hr should return 50 (hits ≤24hr threshold), got ${score}`);
}

// 7 hours — ≤ 8hr threshold → score 75
{
  const score = computeReviewVelocityScore([makePR({ time_to_first_review_hrs: 7 })]);
  assert(score === 75, `7hr should return 75, got ${score}`);
}

// 30 hours → score 25 (between 24hr and 48hr thresholds → hits ≤48hr → 25)
{
  const score = computeReviewVelocityScore([makePR({ time_to_first_review_hrs: 30 })]);
  assert(score === 25, `30hr should return 25 (hits ≤48hr threshold), got ${score}`);
}

// 48 hours → score 25
{
  const score = computeReviewVelocityScore([makePR({ time_to_first_review_hrs: 48 })]);
  assert(score === 25, `48hr should return 25, got ${score}`);
}

// 50 hours → max(0, 25 - (50-48)/2) = max(0, 24) = 24
{
  const score = computeReviewVelocityScore([makePR({ time_to_first_review_hrs: 50 })]);
  assertClose(score, 24, 0.1, `50hr should return ~24`);
}

// 100 hours → max(0, 25 - (100-48)/2) = max(0, 25-26) = 0
{
  const score = computeReviewVelocityScore([makePR({ time_to_first_review_hrs: 100 })]);
  assert(score === 0, `100hr should return 0, got ${score}`);
}

console.log('  ✓ Review velocity tests passed');

// ─── Stale PR Burden Tests ────────────────────────────────────────────────────

console.log('Testing: computeStalePRBurdenScore');

// No open PRs → score 100
{
  const { score } = computeStalePRBurdenScore([]);
  assert(score === 100, `No open PRs should return 100, got ${score}`);
}

// All PRs are fresh (created 1 hour ago) → score 100
{
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const freshPR = makePR({
    state: 'open',
    created_at_gh: oneHourAgo,
  });
  const { score } = computeStalePRBurdenScore([freshPR]);
  assert(score === 100, `All fresh PRs should return 100, got ${score}`);
}

// PR older than 7 days (stale) → ratio 1.0 > 0.35 → score 10
{
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const stalePR = makePR({
    state: 'open',
    created_at_gh: tenDaysAgo,
  });
  const { score, staleCount } = computeStalePRBurdenScore([stalePR]);
  assert(staleCount === 1, `Should find 1 stale PR, got ${staleCount}`);
  assert(score === 10, `100% stale ratio should return 10, got ${score}`);
}

console.log('  ✓ Stale PR burden tests passed');

// ─── PR Size Discipline Tests ─────────────────────────────────────────────────

console.log('Testing: computePRSizeDisciplineScore');

// Small PRs (50+20=70 lines) → 100
{
  const score = computePRSizeDisciplineScore([
    makePR({ additions: 50, deletions: 20, state: 'merged' }),
  ]);
  assert(score === 100, `70 lines should return 100, got ${score}`);
}

// Medium PRs (200 lines) → 90
{
  const score = computePRSizeDisciplineScore([
    makePR({ additions: 150, deletions: 50, state: 'merged' }),
  ]);
  assert(score === 90, `200 lines should return 90, got ${score}`);
}

// Large PRs (1000 lines) → 15
{
  const score = computePRSizeDisciplineScore([
    makePR({ additions: 700, deletions: 300, state: 'merged' }),
  ]);
  assert(score === 15, `1000 lines should return 15, got ${score}`);
}

// No merged PRs → neutral 75
{
  const score = computePRSizeDisciplineScore([makePR({ state: 'open' })]);
  assert(score === 75, `No merged PRs should return 75, got ${score}`);
}

console.log('  ✓ PR size discipline tests passed');

// ─── Review Depth Tests ───────────────────────────────────────────────────────

console.log('Testing: computeReviewDepthScore');

// All PRs reviewed → 100
{
  const prs = [
    makePR({ state: 'merged', review_count: 2 }),
    makePR({ state: 'merged', review_count: 1 }),
  ];
  const score = computeReviewDepthScore(prs);
  assert(score === 100, `All reviewed PRs should return 100, got ${score}`);
}

// No reviewed PRs → 20
{
  const prs = [
    makePR({ state: 'merged', review_count: 0 }),
    makePR({ state: 'merged', review_count: 0 }),
  ];
  const score = computeReviewDepthScore(prs);
  assert(score === 20, `No reviewed PRs should return 20, got ${score}`);
}

// No merged PRs → neutral 50
{
  const score = computeReviewDepthScore([makePR({ state: 'open' })]);
  assert(score === 50, `No merged PRs should return 50, got ${score}`);
}

console.log('  ✓ Review depth tests passed');

// ─── Revert Rate Tests ────────────────────────────────────────────────────────

console.log('Testing: computeRevertRateScore');

// No reverts → 100
{
  const score = computeRevertRateScore([makePR({ is_revert: false, state: 'merged' })]);
  assert(score === 100, `No reverts should return 100, got ${score}`);
}

// No merged PRs → 100
{
  const score = computeRevertRateScore([makePR({ state: 'open' })]);
  assert(score === 100, `No merged PRs should return 100, got ${score}`);
}

// 1/10 merged are reverts (10%) → 40
{
  const prs = Array.from({ length: 9 }, (_, i) =>
    makePR({ github_pr_number: i + 1, is_revert: false, state: 'merged' })
  );
  prs.push(makePR({ github_pr_number: 10, is_revert: true, state: 'merged' }));
  const score = computeRevertRateScore(prs);
  assert(score === 40, `10% revert rate should return 40, got ${score}`);
}

// High revert rate > 10% → 10
{
  const prs = Array.from({ length: 5 }, (_, i) =>
    makePR({ github_pr_number: i + 1, is_revert: true, state: 'merged' })
  );
  const score = computeRevertRateScore(prs);
  assert(score === 10, `100% revert rate should return 10, got ${score}`);
}

console.log('  ✓ Revert rate tests passed');

// ─── Contributor Rhythm Tests ─────────────────────────────────────────────────

console.log('Testing: computeContributorRhythmScore');

// No flags → 100
{
  const score = computeContributorRhythmScore([]);
  assert(score === 100, `No flags should return 100, got ${score}`);
}

// 1 warning flag → 92
{
  const flags: RhythmFlag[] = [{
    contributor: 'alice',
    flag_type: 'review_drop',
    severity: 'warning',
    current_value: 0.5,
    baseline_value: 2.0,
    week_start: '2025-12-30',
    description: 'test',
  }];
  const score = computeContributorRhythmScore(flags);
  assert(score === 92, `1 warning flag should return 92, got ${score}`);
}

// 1 critical flag → 80
{
  const flags: RhythmFlag[] = [{
    contributor: 'alice',
    flag_type: 'review_drop',
    severity: 'critical',
    current_value: 0.1,
    baseline_value: 3.0,
    week_start: '2025-12-30',
    description: 'test',
  }];
  const score = computeContributorRhythmScore(flags);
  assert(score === 80, `1 critical flag should return 80, got ${score}`);
}

console.log('  ✓ Contributor rhythm tests passed');

// ─── Final Score Computation ──────────────────────────────────────────────────

console.log('Testing: computeHealthScore');

// Perfect week — all PRs reviewed quickly, small, no reverts
{
  const prs = Array.from({ length: 5 }, (_, i) =>
    makePR({
      github_pr_number: i + 1,
      additions: 40,
      deletions: 20,
      state: 'merged',
      time_to_first_review_hrs: 1.5,
      time_to_approval_hrs: 2,
      time_to_merge_hrs: 3,
      review_count: 2,
      is_revert: false,
    })
  );

  const result = computeHealthScore({
    weekStart: '2025-12-30',
    prs,
    rollups: [],
    rhythmFlags: [],
    bottleneckAnalysis: [],
    allOpenPRs: [],
  });

  assert(result.score > 90, `Perfect week should score > 90, got ${result.score}`);
  assert(result.total_prs_opened === 5, `Should have 5 PRs opened`);
  assert(result.total_prs_merged === 5, `Should have 5 merged`);
  assert(result.stale_pr_count === 0, `No stale PRs`);
  console.log(`  Perfect week score: ${result.score}`);
}

// Terrible week — slow reviews, big PRs, many reverts
{
  const prs = Array.from({ length: 5 }, (_, i) =>
    makePR({
      github_pr_number: i + 1,
      additions: 800,
      deletions: 400,
      state: 'merged',
      time_to_first_review_hrs: 72,
      time_to_approval_hrs: 96,
      time_to_merge_hrs: 120,
      review_count: 0,
      is_revert: i < 3, // 3/5 are reverts
    })
  );

  const result = computeHealthScore({
    weekStart: '2025-12-30',
    prs,
    rollups: [],
    rhythmFlags: [
      {
        contributor: 'alice',
        flag_type: 'silent_contributor',
        severity: 'critical',
        current_value: 3,
        baseline_value: 0,
        week_start: '2025-12-30',
        description: 'test',
      },
    ],
    bottleneckAnalysis: [],
    allOpenPRs: [],
  });

  assert(result.score < 60, `Terrible week should score < 60, got ${result.score}`);
  console.log(`  Terrible week score: ${result.score}`);
}

console.log('  ✓ Health score computation tests passed');

console.log('\n✅ All scoring tests passed!');
