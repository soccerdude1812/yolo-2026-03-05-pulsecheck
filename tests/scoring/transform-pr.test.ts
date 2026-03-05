// tests/scoring/transform-pr.test.ts
// Unit tests for the PR transformation layer.

import { transformPR, getWeekStart } from '../../src/lib/sync/transform-pr';
import type { GitHubPR, GitHubReview } from '../../src/types/index';

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

// ─── getWeekStart Tests ───────────────────────────────────────────────────────

console.log('Testing: getWeekStart');

// Monday → same day
{
  const monday = new Date('2026-03-02T12:00:00Z'); // This is a Monday
  const weekStart = getWeekStart(monday);
  assert(weekStart === '2026-03-02', `Monday should map to itself, got ${weekStart}`);
}

// Wednesday → previous Monday
{
  const wednesday = new Date('2026-03-04T12:00:00Z');
  const weekStart = getWeekStart(wednesday);
  assert(weekStart === '2026-03-02', `Wednesday should map to Monday 2026-03-02, got ${weekStart}`);
}

// Sunday → previous Monday
{
  const sunday = new Date('2026-03-08T12:00:00Z');
  const weekStart = getWeekStart(sunday);
  assert(weekStart === '2026-03-02', `Sunday should map to Monday 2026-03-02, got ${weekStart}`);
}

console.log('  ✓ getWeekStart tests passed');

// ─── transformPR Tests ────────────────────────────────────────────────────────

console.log('Testing: transformPR');

function makeGitHubPR(overrides: Partial<GitHubPR> = {}): GitHubPR {
  return {
    number: 42,
    title: 'feat: add new feature',
    state: 'closed',
    user: { login: 'alice' },
    created_at: '2026-03-02T10:00:00Z',
    merged_at: '2026-03-02T15:00:00Z',
    closed_at: '2026-03-02T15:00:00Z',
    additions: 100,
    deletions: 30,
    changed_files: 5,
    base: {
      repo: {
        id: 12345,
        full_name: 'acme/myrepo',
        default_branch: 'main',
        private: false,
      },
    },
    draft: false,
    ...overrides,
  };
}

function makeReview(overrides: Partial<GitHubReview> = {}): GitHubReview {
  return {
    id: 1,
    user: { login: 'bob' },
    state: 'APPROVED',
    submitted_at: '2026-03-02T12:00:00Z',
    body: 'LGTM',
    ...overrides,
  };
}

// Basic merged PR
{
  const pr = makeGitHubPR();
  const reviews = [makeReview()];
  const result = transformPR('repo-id', pr, reviews);

  assert(result.github_pr_number === 42, 'PR number should be 42');
  assert(result.state === 'merged', `State should be 'merged', got ${result.state}`);
  assert(result.author_login === 'alice', 'Author should be alice');
  assert(result.is_revert === false, 'Should not be a revert');
  assert(result.week_start === '2026-03-02', `Week start should be 2026-03-02, got ${result.week_start}`);
  assert(result.additions === 100, 'Additions should be 100');
  assert(result.deletions === 30, 'Deletions should be 30');
  assert(result.review_count === 1, `Review count should be 1, got ${result.review_count}`);
  assertClose(result.time_to_first_review_hrs ?? 0, 2.0, 0.1, 'Time to first review should be 2h');
  assertClose(result.time_to_merge_hrs ?? 0, 5.0, 0.1, 'Time to merge should be 5h');
}

// Open PR
{
  const pr = makeGitHubPR({ state: 'open', merged_at: null, closed_at: null });
  const result = transformPR('repo-id', pr, []);
  assert(result.state === 'open', `Should be 'open', got ${result.state}`);
  assert(result.merged_at === null, 'merged_at should be null');
  assert(result.time_to_merge_hrs === null, 'Time to merge should be null for open PR');
}

// Revert PR
{
  const pr = makeGitHubPR({ title: 'Revert "feat: add new feature"' });
  const result = transformPR('repo-id', pr, []);
  assert(result.is_revert === true, 'Should detect revert PR');
}

// Author's own review should be excluded from review_count
{
  const pr = makeGitHubPR();
  const selfReview = makeReview({ user: { login: 'alice' } }); // same as author
  const externalReview = makeReview({ user: { login: 'bob' } });
  const result = transformPR('repo-id', pr, [selfReview, externalReview]);
  assert(result.review_count === 1, `Self-review excluded, count should be 1, got ${result.review_count}`);
}

// PENDING reviews should be excluded from first_review_at
{
  const pr = makeGitHubPR();
  const pendingReview = makeReview({
    state: 'PENDING',
    submitted_at: '2026-03-02T11:00:00Z',
  });
  const actualReview = makeReview({
    state: 'APPROVED',
    submitted_at: '2026-03-02T12:00:00Z',
  });
  const result = transformPR('repo-id', pr, [pendingReview, actualReview]);
  assert(result.first_review_at === '2026-03-02T12:00:00Z', 'Should use approved review time, not pending');
}

// No user on PR (bot PR)
{
  const pr = makeGitHubPR({ user: null });
  const result = transformPR('repo-id', pr, []);
  assert(result.author_login === 'unknown', `Bot PR should have 'unknown' author, got ${result.author_login}`);
}

console.log('  ✓ transformPR tests passed');

console.log('\n✅ All transform-pr tests passed!');
