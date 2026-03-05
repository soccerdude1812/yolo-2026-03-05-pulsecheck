// src/app/api/cron/sync-all/route.ts
// GET /api/cron/sync-all — nightly cron endpoint
// MF-6: constant-time CRON_SECRET comparison via timingSafeEqual
// Only syncs Pro/Team repos (free = manual only per PLAN_LIMITS)
// Bails at 50s total (SYNC_TIMING.cronBailoutMs)

import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { syncRepo } from '@/lib/sync/sync-repo';
import { env } from '@/lib/utils/env';
import { SYNC_TIMING } from '@/lib/scoring/config';
import type { Repo } from '@/types/index';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Constant-time string comparison — prevents timing attacks on the secret.
 * If lengths differ, do a dummy comparison to maintain constant time.
 */
function constantTimeEquals(a: string, b: string): boolean {
  // Pad to same length for comparison (but still return false if lengths differ)
  const lengthsMatch = a.length === b.length;
  const padded = lengthsMatch ? b : b.padEnd(a.length, '\0');

  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(padded);
    // timingSafeEqual requires same length buffers
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB) && lengthsMatch;
  } catch {
    return false;
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const cronStart = Date.now();

  // MF-6: Authenticate via Authorization: Bearer <secret> header
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const secret = env.cronSecret;

  if (!token || !constantTimeEquals(token, secret)) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const supabase = createAdminSupabase();

  // Fetch Pro + Team repos that are active (free repos skip auto-sync)
  // Get repos along with user profile to find provider_token
  const { data: repos, error: reposError } = await supabase
    .from('repos')
    .select(`
      *,
      user_profiles!inner(plan, id)
    `)
    .eq('is_active', true)
    .neq('sync_status', 'syncing')
    .in('user_profiles.plan', ['pro', 'team'])
    .order('last_synced_at', { ascending: true, nullsFirst: true }); // sync oldest first

  if (reposError) {
    console.error('Cron: failed to fetch repos', { error: reposError.message });
    return NextResponse.json({ data: null, error: 'FETCH_FAILED' }, { status: 500 });
  }

  const eligibleRepos = (repos ?? []) as (Repo & { user_profiles: { plan: string; id: string } })[];

  const results: { repo_id: string; status: string; elapsed_ms: number; error?: string }[] = [];
  let reposSynced = 0;

  for (const repoWithProfile of eligibleRepos) {
    // MF-5 / cron bail-out: stop at cronBailoutMs total elapsed
    const totalElapsed = Date.now() - cronStart;
    if (totalElapsed > SYNC_TIMING.cronBailoutMs) {
      console.info('Cron: bail-out at time limit', {
        totalElapsedMs: totalElapsed,
        reposSynced,
        reposSkipped: eligibleRepos.length - reposSynced,
      });
      break;
    }

    // For cron, we need the user's provider_token from their Supabase session
    // Since cron runs without a user session, we use the admin client to look up
    // the user's OAuth token from auth.users (if Supabase stores it)
    // However, Supabase does not persist provider_token after session expiry.
    // Cron sync is only viable if user has re-authenticated recently.
    // We attempt to get it; if missing, mark repo as needing resync.
    const userId = repoWithProfile.user_profiles.id;

    // Attempt to retrieve the user's active session provider_token via admin API
    // Supabase admin can list users but not their provider tokens directly.
    // For cron, we use the GITHUB_TOKEN env var as fallback (org-level token).
    // This is the standard pattern for background sync.
    const providerToken = env.githubToken;

    if (!providerToken) {
      results.push({
        repo_id: repoWithProfile.id,
        status: 'skipped',
        elapsed_ms: 0,
        error: 'No GitHub token available for cron sync',
      });
      continue;
    }

    const repoStart = Date.now();

    try {
      const result = await syncRepo({
        repo: repoWithProfile,
        providerToken,
        supabase,
      });

      results.push({
        repo_id: result.repo_id,
        status: result.status,
        elapsed_ms: result.elapsed_ms,
        error: result.error,
      });
    } catch (err) {
      results.push({
        repo_id: repoWithProfile.id,
        status: 'error',
        elapsed_ms: Date.now() - repoStart,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    reposSynced++;

    // If one repo took too long, stop (MF-5: perRepoMaxMs)
    if (Date.now() - repoStart > SYNC_TIMING.perRepoMaxMs) {
      console.warn('Cron: repo took too long, stopping loop', {
        repo_id: repoWithProfile.id,
        elapsed_ms: Date.now() - repoStart,
      });
      break;
    }
  }

  return NextResponse.json({
    data: {
      synced: reposSynced,
      total_eligible: eligibleRepos.length,
      results,
      total_elapsed_ms: Date.now() - cronStart,
    },
    error: null,
  });
}
