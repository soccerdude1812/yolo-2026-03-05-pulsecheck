// src/app/api/narrative/route.ts
// POST /api/narrative — Generate AI health narrative for a repo's latest week.
// Auth required. Free tier: 1 per calendar month. Pro/Team: unlimited.

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { generateNarrative } from '@/lib/ai/narrative';
import { isNarrativeQuotaExhausted } from '@/lib/utils/plan';
import type { ApiResponse, NarrativeResponse, WeeklyHealthScore, ContributorSummary } from '@/types/index';
import type { NarrativeInput } from '@/lib/ai/prompts';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

type RouteResponse = ApiResponse<NarrativeResponse>;

function errorResponse(error: string, status: number, message?: string): NextResponse {
  const body: RouteResponse = { data: null, error };
  if (message) (body as ApiResponse<NarrativeResponse> & { message?: string }).message = message;
  return NextResponse.json(body, { status });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const admin = createAdminSupabase();

  // ── Auth check ─────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return errorResponse('UNAUTHORIZED', 401);
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { repo_id?: string; week_start?: string; force_regenerate?: boolean };
  try {
    body = await req.json() as { repo_id?: string; week_start?: string; force_regenerate?: boolean };
  } catch {
    return errorResponse('INVALID_JSON_BODY', 400);
  }

  const { repo_id, week_start, force_regenerate = false } = body;
  if (!repo_id) {
    return errorResponse('REPO_ID_REQUIRED', 400);
  }

  // ── Load user profile (plan + quota) ───────────────────────────────────────
  const { data: profileData, error: profileError } = await admin
    .from('user_profiles')
    .select('id, plan, narrative_month, narrative_count')
    .eq('id', user.id)
    .single();

  if (profileError || !profileData) {
    return errorResponse('USER_PROFILE_NOT_FOUND', 404);
  }

  const profile = profileData as {
    id: string;
    plan: 'free' | 'pro' | 'team';
    narrative_month: string | null;
    narrative_count: number;
  };

  // ── Verify repo belongs to user ────────────────────────────────────────────
  const { data: repoData, error: repoError } = await admin
    .from('repos')
    .select('id, github_full_name, user_id')
    .eq('id', repo_id)
    .eq('user_id', user.id)
    .single();

  if (repoError || !repoData) {
    return errorResponse('REPO_NOT_FOUND', 404);
  }

  const repo = repoData as { id: string; github_full_name: string; user_id: string };

  // ── Free-tier quota enforcement (MF-1) ────────────────────────────────────
  const quotaExhausted = isNarrativeQuotaExhausted(
    profile.plan,
    profile.narrative_month,
    profile.narrative_count
  );

  if (quotaExhausted && !force_regenerate) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [year, month] = currentMonth.split('-').map(Number);
    const resetDate = new Date(year, month, 1).toISOString().slice(0, 10);
    return errorResponse(
      'MONTHLY_LIMIT_REACHED',
      403,
      `Free tier allows 1 narrative per calendar month. Resets on ${resetDate}.`
    );
  }

  // ── Load latest weekly scores (2 weeks for delta) ─────────────────────────
  const { data: scoreData, error: scoreError } = await admin
    .from('weekly_health_scores')
    .select('*')
    .eq('repo_id', repo_id)
    .order('week_start', { ascending: false })
    .limit(2);

  if (scoreError || !scoreData || scoreData.length === 0) {
    return errorResponse('NO_SCORE_DATA', 404);
  }

  const scores = scoreData as WeeklyHealthScore[];
  const latestScore = scores[0];
  const previousScore: WeeklyHealthScore | undefined = scores[1];

  // Pick the target week
  const targetWeekStart = week_start ?? latestScore.week_start;
  const targetScore: WeeklyHealthScore =
    scores.find((s) => s.week_start === targetWeekStart) ?? latestScore;

  // Check if narrative already exists and not forcing regeneration
  if (targetScore.narrative_digest && !force_regenerate) {
    const quotaRemaining =
      profile.plan === 'free'
        ? Math.max(0, 1 - profile.narrative_count)
        : null;

    return NextResponse.json<RouteResponse>({
      data: {
        narrative: targetScore.narrative_digest,
        model_used: targetScore.narrative_model ?? 'unknown',
        generated_at: targetScore.narrative_generated_at ?? new Date().toISOString(),
        quota_remaining: quotaRemaining,
      },
      error: null,
    });
  }

  // ── Load contributor rollups for the target week ──────────────────────────
  const { data: contributorData } = await admin
    .from('contributor_rollups')
    .select('*')
    .eq('repo_id', repo_id)
    .eq('week_start', targetWeekStart);

  type ContribRow = {
    github_login: string;
    prs_opened: number;
    prs_merged: number;
    reviews_given: number;
    lines_added: number;
    lines_deleted: number;
    avg_pr_size_lines: number | null;
    median_review_turnaround_hrs: number | null;
    revert_prs: number;
  };

  const contributors: ContributorSummary[] = ((contributorData ?? []) as ContribRow[]).map((c) => ({
    github_login: c.github_login,
    total_prs_opened: c.prs_opened,
    total_prs_merged: c.prs_merged,
    total_reviews_given: c.reviews_given,
    total_lines_added: c.lines_added,
    total_lines_deleted: c.lines_deleted,
    avg_pr_size_lines: c.avg_pr_size_lines,
    avg_review_turnaround_hrs: c.median_review_turnaround_hrs,
    revert_count: c.revert_prs,
    weeks_active: 1,
    rhythm_flags: (targetScore.rhythm_flags ?? []).filter(
      (f) => f.contributor === c.github_login
    ),
  }));

  // ── Build narrative input ─────────────────────────────────────────────────
  const narrativeInput: NarrativeInput = {
    repoName: repo.github_full_name,
    currentWeekScore: targetScore.score,
    previousWeekScore: previousScore?.score ?? null,
    subScores: {
      review_velocity: targetScore.sub_score_review_velocity,
      contributor_rhythm: targetScore.sub_score_contributor_rhythm,
      stale_pr_burden: targetScore.sub_score_stale_pr_burden,
      pr_size_discipline: targetScore.sub_score_pr_size_discipline,
      review_depth: targetScore.sub_score_review_depth,
      revert_rate: targetScore.sub_score_revert_rate,
    },
    contributorRollups: contributors,
    bottleneckAnalysis: targetScore.bottleneck_analysis ?? [],
    stalePRCount: targetScore.stale_pr_count,
    weekStart: targetWeekStart,
  };

  // ── Generate narrative ────────────────────────────────────────────────────
  let result;
  try {
    result = await generateNarrative(narrativeInput);
  } catch (err) {
    console.error('[api/narrative] Generation failed:', err instanceof Error ? err.message : String(err));
    return errorResponse('NARRATIVE_GENERATION_FAILED', 500);
  }

  // ── Save narrative to weekly_health_scores ────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('weekly_health_scores') as any)
    .update({
      narrative_digest: result.narrative,
      narrative_model: result.model_used,
      narrative_generated_at: result.generated_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetScore.id);

  // ── Update free-tier quota (MF-1) ─────────────────────────────────────────
  if (profile.plan === 'free') {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const isSameMonth = profile.narrative_month === currentMonth;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('user_profiles') as any)
      .update({
        narrative_month: currentMonth,
        narrative_count: isSameMonth ? profile.narrative_count + 1 : 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
  }

  // ── Return ────────────────────────────────────────────────────────────────
  const quotaRemaining =
    profile.plan === 'free'
      ? Math.max(0, 1 - (profile.narrative_count + 1))
      : null;

  return NextResponse.json<RouteResponse>({
    data: {
      narrative: result.narrative,
      model_used: result.model_used,
      generated_at: result.generated_at,
      quota_remaining: quotaRemaining,
    },
    error: null,
  });
}
