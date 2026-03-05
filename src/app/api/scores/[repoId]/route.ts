// src/app/api/scores/[repoId]/route.ts
// GET /api/scores/[repoId]?weeks=N — score history with plan-gated history window

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { PLAN_LIMITS } from '@/types/index';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { repoId: string } }
): Promise<NextResponse> {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { repoId } = params;

  // Get plan for history gating
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ data: null, error: 'PROFILE_NOT_FOUND' }, { status: 404 });
  }

  // Verify user owns this repo
  const { data: repo } = await supabase
    .from('repos')
    .select('id')
    .eq('id', repoId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!repo) {
    return NextResponse.json({ data: null, error: 'REPO_NOT_FOUND' }, { status: 404 });
  }

  const planLimits = PLAN_LIMITS[profile.plan as 'free' | 'pro' | 'team'];
  const maxWeeks = planLimits.history_weeks;

  // Parse requested weeks from query param — clamp to plan limit
  const { searchParams } = new URL(request.url);
  const requestedWeeks = parseInt(searchParams.get('weeks') ?? String(maxWeeks), 10);
  const weeksLimit = Math.min(requestedWeeks, maxWeeks);

  const { data: scores, error: scoresError } = await supabase
    .from('weekly_health_scores')
    .select(
      'id, repo_id, week_start, score, sub_score_review_velocity, sub_score_pr_size_discipline, sub_score_stale_pr_burden, sub_score_contributor_rhythm, sub_score_review_depth, sub_score_revert_rate, active_contributors, total_prs_opened, total_prs_merged, stale_pr_count, total_reviews, median_time_to_first_review_hrs, median_time_to_merge_hrs, rhythm_flags, bottleneck_analysis, narrative_digest, narrative_model, narrative_generated_at, alert_sent, created_at, updated_at'
    )
    .eq('repo_id', repoId)
    .order('week_start', { ascending: false })
    .limit(weeksLimit);

  if (scoresError) {
    return NextResponse.json({ data: null, error: 'SCORES_FETCH_FAILED' }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      scores: (scores ?? []).reverse(), // ascending for chart rendering
      weeks_limit: weeksLimit,
      plan: profile.plan,
    },
    error: null,
  });
}
