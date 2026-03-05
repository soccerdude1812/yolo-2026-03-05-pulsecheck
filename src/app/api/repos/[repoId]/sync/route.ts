// src/app/api/repos/[repoId]/sync/route.ts
// POST /api/repos/[repoId]/sync — trigger manual sync (synchronous, bail at 50s)
// Rate limit free users: 1 sync per 6 hours (D-3 partial mitigation)
// MF-7: provider_token retrieved server-side, never returned in response

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { syncRepo } from '@/lib/sync/sync-repo';
import { PLAN_LIMITS } from '@/types/index';

export const dynamic = 'force-dynamic';
// Vercel: 60s max. We bail at 50s internally but declare maxDuration for clarity.
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: { repoId: string } }
): Promise<NextResponse> {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { repoId } = params;

  // Fetch user profile for plan + sync rate limit check
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan, last_manual_sync_at')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ data: null, error: 'PROFILE_NOT_FOUND' }, { status: 404 });
  }

  const planLimits = PLAN_LIMITS[profile.plan as 'free' | 'pro' | 'team'];

  // Rate limit: free users must wait 6 hours between manual syncs
  if (planLimits.manual_sync_min_gap_hours > 0 && profile.last_manual_sync_at) {
    const lastSync = new Date(profile.last_manual_sync_at).getTime();
    const gapMs = planLimits.manual_sync_min_gap_hours * 60 * 60 * 1000;
    const nextAllowedAt = lastSync + gapMs;

    if (Date.now() < nextAllowedAt) {
      const waitMinutes = Math.ceil((nextAllowedAt - Date.now()) / 60000);
      return NextResponse.json(
        {
          data: null,
          error: 'SYNC_RATE_LIMITED',
          message: `Free plan allows 1 manual sync per 6 hours. Try again in ${waitMinutes} minute${waitMinutes !== 1 ? 's' : ''}.`,
        },
        { status: 429 }
      );
    }
  }

  // Verify user owns this repo
  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('id', repoId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!repo) {
    return NextResponse.json({ data: null, error: 'REPO_NOT_FOUND' }, { status: 404 });
  }

  // Check not already syncing
  if (repo.sync_status === 'syncing') {
    return NextResponse.json(
      { data: null, error: 'SYNC_ALREADY_IN_PROGRESS' },
      { status: 409 }
    );
  }

  // Get GitHub token from user_profiles (persisted during OAuth callback)
  // Use admin client to bypass RLS column restrictions
  const adminSupabaseForToken = createAdminSupabase();
  const { data: tokenData } = await adminSupabaseForToken
    .from('user_profiles')
    .select('github_token')
    .eq('id', user.id)
    .single() as { data: { github_token: string | null } | null };

  const providerToken = tokenData?.github_token;

  if (!providerToken) {
    return NextResponse.json(
      { data: null, error: 'GITHUB_TOKEN_MISSING. Please sign out and sign back in to refresh your GitHub token.' },
      { status: 401 }
    );
  }

  // Update last_manual_sync_at before running sync (prevents double-tapping)
  await supabase
    .from('user_profiles')
    .update({ last_manual_sync_at: new Date().toISOString() })
    .eq('id', user.id);

  // Run sync synchronously — admin client to bypass RLS for writes
  const adminSupabase = createAdminSupabase();
  const result = await syncRepo({
    repo,
    providerToken,  // stays server-side, never serialized into response
    supabase: adminSupabase,
  });

  return NextResponse.json({
    data: {
      status: result.status,
      prs_fetched: result.prs_fetched,
      prs_upserted: result.prs_upserted,
      weeks_scored: result.weeks_scored,
      elapsed_ms: result.elapsed_ms,
      // Never return provider_token
    },
    error: result.error ?? null,
  });
}
