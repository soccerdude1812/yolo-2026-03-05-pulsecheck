// src/app/api/repos/route.ts
// GET  /api/repos  — list user's repos + latest score
// POST /api/repos  — add a new repo (enforce plan limit), trigger first sync

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { syncRepo } from '@/lib/sync/sync-repo';
import { PLAN_LIMITS } from '@/types/index';
import type { GitHubRepo } from '@/types/index';
import { githubRequest } from '@/lib/github/client';

export const dynamic = 'force-dynamic';

// ─── GET: List repos + latest score ──────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Fetch all active repos for this user
  const { data: repos, error: repoError } = await supabase
    .from('repos')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (repoError) {
    return NextResponse.json({ data: null, error: 'FETCH_FAILED' }, { status: 500 });
  }

  if (!repos || repos.length === 0) {
    return NextResponse.json({ data: [], error: null });
  }

  // Fetch latest score for each repo
  const repoIds = repos.map((r: { id: string }) => r.id);
  const { data: latestScores } = await supabase
    .from('weekly_health_scores')
    .select('repo_id, week_start, score')
    .in('repo_id', repoIds)
    .order('week_start', { ascending: false });

  // Build a map of repoId → latest score
  const latestScoreMap = new Map<string, { score: number; week_start: string }>();
  for (const score of latestScores ?? []) {
    if (!latestScoreMap.has(score.repo_id)) {
      latestScoreMap.set(score.repo_id, { score: score.score, week_start: score.week_start });
    }
  }

  const reposWithScores = repos.map((repo: { id: string }) => ({
    ...repo,
    latest_score: latestScoreMap.get(repo.id)?.score ?? null,
    latest_score_week: latestScoreMap.get(repo.id)?.week_start ?? null,
  }));

  return NextResponse.json({ data: reposWithScores, error: null });
}

// ─── POST: Add repo ───────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Get user profile + plan
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ data: null, error: 'PROFILE_NOT_FOUND' }, { status: 404 });
  }

  const planLimits = PLAN_LIMITS[profile.plan as 'free' | 'pro' | 'team'];

  // Check current repo count against plan limit
  const { count: repoCount } = await supabase
    .from('repos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true);

  const currentCount = repoCount ?? 0;
  if (planLimits.max_repos !== Infinity && currentCount >= planLimits.max_repos) {
    return NextResponse.json(
      {
        data: null,
        error: 'REPO_LIMIT_REACHED',
        message: `${profile.plan === 'free' ? 'Free' : 'Pro'} plan allows ${planLimits.max_repos} repo${planLimits.max_repos !== 1 ? 's' : ''}. Upgrade to add more.`,
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.full_name) {
    return NextResponse.json(
      { data: null, error: 'MISSING_FULL_NAME' },
      { status: 400 }
    );
  }

  const fullName = String(body.full_name).trim();
  const parts = fullName.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return NextResponse.json(
      { data: null, error: 'INVALID_REPO_FORMAT' },
      { status: 400 }
    );
  }

  const [owner, repoName] = parts;

  // Get provider_token from session (server-side only — MF-7)
  const { data: { session } } = await supabase.auth.getSession();
  const providerToken = session?.provider_token;

  if (!providerToken) {
    return NextResponse.json(
      { data: null, error: 'GITHUB_TOKEN_MISSING' },
      { status: 401 }
    );
  }

  // Verify repo exists and is accessible
  let githubRepo: GitHubRepo;
  try {
    const result = await githubRequest<GitHubRepo>(
      `/repos/${owner}/${repoName}`,
      { token: providerToken }
    );
    githubRepo = result.data;
  } catch {
    return NextResponse.json(
      { data: null, error: 'REPO_NOT_FOUND_OR_INACCESSIBLE' },
      { status: 404 }
    );
  }

  // Check if repo already exists for this user
  const { data: existingRepo } = await supabase
    .from('repos')
    .select('id, is_active')
    .eq('user_id', user.id)
    .eq('github_repo_id', githubRepo.id)
    .single();

  let repoId: string;

  if (existingRepo) {
    if (existingRepo.is_active) {
      return NextResponse.json(
        { data: null, error: 'REPO_ALREADY_ADDED' },
        { status: 409 }
      );
    }
    // Reactivate soft-deleted repo
    const { error: reactivateError } = await supabase
      .from('repos')
      .update({ is_active: true, sync_status: 'pending', sync_error: null })
      .eq('id', existingRepo.id);

    if (reactivateError) {
      return NextResponse.json({ data: null, error: 'REACTIVATE_FAILED' }, { status: 500 });
    }
    repoId = existingRepo.id;
  } else {
    // Create new repo record
    const { data: newRepo, error: createError } = await supabase
      .from('repos')
      .insert({
        user_id: user.id,
        github_owner: githubRepo.owner.login,
        github_repo: githubRepo.name,
        github_full_name: githubRepo.full_name,
        github_repo_id: githubRepo.id,
        default_branch: githubRepo.default_branch,
        is_private: githubRepo.private,
      })
      .select('id')
      .single();

    if (createError || !newRepo) {
      return NextResponse.json({ data: null, error: 'CREATE_FAILED' }, { status: 500 });
    }
    repoId = newRepo.id;
  }

  // Trigger first sync immediately (synchronous — MF-5)
  const adminSupabase = createAdminSupabase();
  const { data: repoRecord } = await adminSupabase
    .from('repos')
    .select('*')
    .eq('id', repoId)
    .single();

  if (repoRecord) {
    const syncResult = await syncRepo({
      repo: repoRecord,
      providerToken,
      supabase: adminSupabase,
    });

    return NextResponse.json({
      data: { repo_id: repoId, sync: syncResult },
      error: null,
    });
  }

  return NextResponse.json({ data: { repo_id: repoId }, error: null });
}
