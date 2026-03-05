// src/lib/sync/sync-repo.ts
// Main sync orchestrator. Fetches PRs, computes scores, upserts all data.
// Implements MF-5 time guards — bails at 50s with 'partial' status.
// MF-2: Initial sync computes ALL historical weeks, not just current.

import { fetchPRsForRepo } from '@/lib/github/fetch-prs';
import { fetchReviewsForPRs } from '@/lib/github/fetch-reviews';
import { transformPRBatch } from './transform-pr';
import {
  computeContributorRollups,
  computeReviewsGiven,
  mergeReviewsIntoRollups,
  getWeeksFromPRs,
  getPRsForWeek,
  getOpenPRs,
} from '@/lib/scoring/rollup';
import { computeRhythmFlags } from '@/lib/scoring/rhythm';
import { computeBottleneckAnalysis } from '@/lib/scoring/bottleneck';
import { computeHealthScore } from '@/lib/scoring/health-score';
import { SYNC_TIMING } from '@/lib/scoring/config';
import {
  SyncTimeoutError,
  RateLimitError,
  UpsertError,
  AlertError,
  isAlertError,
} from './errors';
import type {
  Repo,
  PRLifecycle,
  SyncResult,
  GitHubReview,
  RhythmFlag,
  BottleneckItem,
} from '@/types/index';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Time Tracking ────────────────────────────────────────────────────────────

let syncStart: number;

function elapsedMs(): number {
  return Date.now() - syncStart;
}

/**
 * Throw SyncTimeoutError if elapsed exceeds budgetMs.
 * Use before each major step in the pipeline (MF-5).
 */
function assertTimeRemaining(label: string, budgetMs: number): void {
  if (elapsedMs() > budgetMs) {
    throw new SyncTimeoutError(
      `Sync aborted at step "${label}" — exceeded ${budgetMs}ms (elapsed: ${elapsedMs()}ms)`
    );
  }
}

// ─── Sync Options ─────────────────────────────────────────────────────────────

export interface SyncRepoOptions {
  repo: Repo;
  providerToken: string;
  /** Admin supabase client — bypasses RLS for internal sync writes */
  supabase: SupabaseClient;
  /** Called to attempt alert delivery. Non-blocking. */
  onAlert?: (repoId: string, weekStart: string) => Promise<void>;
}

// ─── Main Sync Function ───────────────────────────────────────────────────────

/**
 * Orchestrate a full sync for one repository.
 * Steps:
 *   1. Fetch PRs (paginated, incremental via sync_cursor_date)
 *   2. Fetch reviews for each PR
 *   3. Transform and upsert pr_lifecycle records
 *   4. Compute contributor rollups per week
 *   5. Compute weekly health scores (ALL historical weeks on initial sync)
 *   6. Check alert triggers
 *   7. Send alerts (non-blocking — AlertError doesn't fail sync)
 *   8. Update repo sync metadata
 */
export async function syncRepo(options: SyncRepoOptions): Promise<SyncResult> {
  syncStart = Date.now();

  const { repo, providerToken, supabase, onAlert } = options;
  const { id: repoId, github_owner, github_repo, sync_cursor_date } = repo;

  let prsUpserted = 0;
  let weeksScored = 0;

  // Mark repo as syncing
  await supabase
    .from('repos')
    .update({ sync_status: 'syncing', sync_error: null })
    .eq('id', repoId);

  try {
    // ─── Step 1: Fetch PRs ─────────────────────────────────────────────────
    assertTimeRemaining('pre-fetch', 2000);

    const fetchResult = await fetchPRsForRepo({
      token: providerToken,
      owner: github_owner,
      repo: github_repo,
      syncCursorDate: sync_cursor_date,
      isOverFetchBudget: () => elapsedMs() > SYNC_TIMING.maxFetchMs,
    });

    const rawPRs = fetchResult.prs;

    // ─── Step 2: Fetch reviews for each PR ────────────────────────────────
    assertTimeRemaining('pre-reviews', 5000);

    const reviewMap = await fetchReviewsForPRs(
      providerToken,
      github_owner,
      github_repo,
      rawPRs.map(pr => pr.number),
      () => elapsedMs() > SYNC_TIMING.maxFetchMs
    );

    // ─── Step 3: Transform and upsert pr_lifecycle records ────────────────
    assertTimeRemaining('pre-upsert', 40000);

    const transformed = transformPRBatch(repoId, rawPRs, reviewMap);

    if (transformed.length > 0) {
      const { error: upsertError } = await supabase
        .from('pr_lifecycle')
        .upsert(
          transformed.map(pr => ({ ...pr, synced_at: new Date().toISOString() })),
          { onConflict: 'repo_id,github_pr_number', ignoreDuplicates: false }
        );

      if (upsertError) {
        throw new UpsertError('pr_lifecycle', upsertError);
      }
      prsUpserted = transformed.length;
    }

    // ─── Step 4: Compute contributor rollups ──────────────────────────────
    assertTimeRemaining('rollup-compute', SYNC_TIMING.earlyBailoutMs);

    // Fetch all PRs for this repo from DB (needed for full historical computation)
    const { data: allPRsData, error: prFetchError } = await supabase
      .from('pr_lifecycle')
      .select('*')
      .eq('repo_id', repoId)
      .order('created_at_gh', { ascending: true });

    if (prFetchError) {
      throw new UpsertError('fetch-all-prs', prFetchError);
    }

    const allPRs = (allPRsData ?? []) as PRLifecycle[];

    // Compute rollups for author activity
    const authorRollups = computeContributorRollups(repoId, allPRs);

    // Build review records for reviews_given computation
    const reviewRecords: { prNumber: number; reviewerLogin: string; submittedAt: string }[] = [];
    const prWeekMap = new Map<number, string>(allPRs.map(pr => [pr.github_pr_number, pr.week_start]));

    for (const [prNumber, reviews] of Array.from(reviewMap)) {
      const prRecord = allPRs.find(p => p.github_pr_number === prNumber);
      if (!prRecord) continue;
      for (const review of reviews) {
        if (review.user?.login && review.submitted_at && review.state !== 'PENDING') {
          reviewRecords.push({
            prNumber,
            reviewerLogin: review.user.login,
            submittedAt: review.submitted_at,
          });
        }
      }
    }

    const reviewerData = computeReviewsGiven(reviewRecords, prWeekMap);
    const finalRollups = mergeReviewsIntoRollups(authorRollups, reviewerData);

    if (finalRollups.length > 0) {
      const { error: rollupUpsertError } = await supabase
        .from('contributor_rollups')
        .upsert(
          finalRollups.map(r => ({
            ...r,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'repo_id,github_login,week_start', ignoreDuplicates: false }
        );

      if (rollupUpsertError) {
        throw new UpsertError('contributor_rollups', rollupUpsertError);
      }
    }

    // ─── Step 5: Compute weekly health scores ─────────────────────────────
    // MF-2: Compute ALL historical weeks on initial sync
    assertTimeRemaining('health-score-compute', SYNC_TIMING.earlyBailoutMs);

    const allWeeks = getWeeksFromPRs(allPRs);
    const openPRs = getOpenPRs(allPRs);

    // Fetch all rollups from DB for rhythm flag computation
    const { data: allRollupsData } = await supabase
      .from('contributor_rollups')
      .select('*')
      .eq('repo_id', repoId)
      .order('week_start', { ascending: true });

    const allRollups = allRollupsData ?? [];

    const healthScoreRecords = [];

    for (const weekStart of allWeeks) {
      // Stop if we're running out of time
      if (elapsedMs() > SYNC_TIMING.earlyBailoutMs) {
        break;
      }

      const weekPRs = getPRsForWeek(allPRs, weekStart);
      const weekRollups = allRollups.filter(
        (r: { week_start: string }) => r.week_start === weekStart
      );

      const rhythmFlags: RhythmFlag[] = computeRhythmFlags(allRollups, weekStart, allWeeks);
      const bottlenecks: BottleneckItem[] = computeBottleneckAnalysis(weekPRs, allPRs);

      const scoreResult = computeHealthScore({
        weekStart,
        prs: weekPRs,
        rollups: weekRollups,
        rhythmFlags,
        bottleneckAnalysis: bottlenecks,
        allOpenPRs: openPRs,
      });

      healthScoreRecords.push({
        repo_id: repoId,
        week_start: weekStart,
        score: scoreResult.score,
        sub_score_review_velocity: scoreResult.sub_score_review_velocity,
        sub_score_pr_size_discipline: scoreResult.sub_score_pr_size_discipline,
        sub_score_stale_pr_burden: scoreResult.sub_score_stale_pr_burden,
        sub_score_contributor_rhythm: scoreResult.sub_score_contributor_rhythm,
        sub_score_review_depth: scoreResult.sub_score_review_depth,
        sub_score_revert_rate: scoreResult.sub_score_revert_rate,
        active_contributors: scoreResult.active_contributors,
        total_prs_opened: scoreResult.total_prs_opened,
        total_prs_merged: scoreResult.total_prs_merged,
        stale_pr_count: scoreResult.stale_pr_count,
        total_reviews: scoreResult.total_reviews,
        median_time_to_first_review_hrs: scoreResult.median_time_to_first_review_hrs,
        median_time_to_merge_hrs: scoreResult.median_time_to_merge_hrs,
        rhythm_flags: scoreResult.rhythm_flags,
        bottleneck_analysis: scoreResult.bottleneck_analysis,
        updated_at: new Date().toISOString(),
      });

      weeksScored++;
    }

    if (healthScoreRecords.length > 0) {
      const { error: scoreUpsertError } = await supabase
        .from('weekly_health_scores')
        .upsert(healthScoreRecords, {
          onConflict: 'repo_id,week_start',
          ignoreDuplicates: false,
        });

      if (scoreUpsertError) {
        throw new UpsertError('weekly_health_scores', scoreUpsertError);
      }
    }

    // ─── Step 6: Check alert triggers ─────────────────────────────────────
    if (elapsedMs() <= SYNC_TIMING.earlyBailoutMs && healthScoreRecords.length > 0) {
      const latestWeek = allWeeks[allWeeks.length - 1];
      if (latestWeek && onAlert) {
        try {
          await onAlert(repoId, latestWeek);
        } catch (err) {
          // AlertError is non-blocking (MF-10)
          if (!isAlertError(err)) {
            console.error('Unexpected alert error:', { repoId, err });
          }
        }
      }
    }

    // ─── Step 8: Update repo sync metadata ────────────────────────────────
    const now = new Date().toISOString();
    await supabase
      .from('repos')
      .update({
        sync_status: 'done',
        sync_error: null,
        last_synced_at: now,
        sync_cursor_date: now,  // MF-4: TIMESTAMPTZ, exact moment of completion
      })
      .eq('id', repoId);

    return {
      repo_id: repoId,
      status: 'done',
      prs_fetched: rawPRs.length,
      prs_upserted: prsUpserted,
      weeks_scored: weeksScored,
      alerts_sent: 0,
      elapsed_ms: elapsedMs(),
    };
  } catch (err) {
    if (err instanceof SyncTimeoutError) {
      // Partial sync — save what we have
      await supabase
        .from('repos')
        .update({
          sync_status: 'partial',
          sync_error: err.message,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', repoId);

      return {
        repo_id: repoId,
        status: 'partial',
        prs_fetched: 0,
        prs_upserted: prsUpserted,
        weeks_scored: weeksScored,
        alerts_sent: 0,
        elapsed_ms: elapsedMs(),
        error: err.message,
      };
    }

    if (err instanceof RateLimitError) {
      await supabase
        .from('repos')
        .update({
          sync_status: 'error',
          sync_error: `GitHub rate limit reached (${err.remaining} remaining)`,
        })
        .eq('id', repoId);

      return {
        repo_id: repoId,
        status: 'error',
        prs_fetched: 0,
        prs_upserted: prsUpserted,
        weeks_scored: weeksScored,
        alerts_sent: 0,
        elapsed_ms: elapsedMs(),
        error: err.message,
      };
    }

    if (err instanceof UpsertError) {
      await supabase
        .from('repos')
        .update({
          sync_status: 'error',
          sync_error: `DB error at step: ${err.step}`,
        })
        .eq('id', repoId);

      return {
        repo_id: repoId,
        status: 'error',
        prs_fetched: 0,
        prs_upserted: prsUpserted,
        weeks_scored: weeksScored,
        alerts_sent: 0,
        elapsed_ms: elapsedMs(),
        error: err.message,
      };
    }

    // Unknown error
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    await supabase
      .from('repos')
      .update({
        sync_status: 'error',
        sync_error: message,
      })
      .eq('id', repoId);

    return {
      repo_id: repoId,
      status: 'error',
      prs_fetched: 0,
      prs_upserted: prsUpserted,
      weeks_scored: weeksScored,
      alerts_sent: 0,
      elapsed_ms: elapsedMs(),
      error: message,
    };
  }
}
