// src/app/api/contributors/[repoId]/[login]/route.ts
// GET /api/contributors/[repoId]/[login] — single contributor deep dive (Pro+ only)

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { PLAN_LIMITS } from '@/types/index';
import type { ContributorRollup, RhythmFlag } from '@/types/index';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { repoId: string; login: string } }
): Promise<NextResponse> {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { repoId, login: rawLogin } = params;
  const login = decodeURIComponent(rawLogin);

  // Get user plan
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ data: null, error: 'PROFILE_NOT_FOUND' }, { status: 404 });
  }

  // Pro+ only feature
  if (profile.plan === 'free') {
    return NextResponse.json(
      {
        data: null,
        error: 'UPGRADE_REQUIRED',
        message: 'Contributor deep dive requires Pro or Team plan.',
      },
      { status: 403 }
    );
  }

  // Verify repo ownership
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

  // Fetch all weeks for this contributor (plan window)
  const { data: rollups, error: rollupsError } = await supabase
    .from('contributor_rollups')
    .select('*')
    .eq('repo_id', repoId)
    .eq('github_login', login)
    .order('week_start', { ascending: false })
    .limit(planLimits.history_weeks);

  if (rollupsError) {
    return NextResponse.json({ data: null, error: 'ROLLUPS_FETCH_FAILED' }, { status: 500 });
  }

  // Get rhythm flags for this contributor from all recent health scores
  const { data: recentScores } = await supabase
    .from('weekly_health_scores')
    .select('week_start, rhythm_flags')
    .eq('repo_id', repoId)
    .order('week_start', { ascending: false })
    .limit(planLimits.history_weeks);

  const allRhythmFlags: RhythmFlag[] = [];
  for (const score of recentScores ?? []) {
    const flags = (score.rhythm_flags as RhythmFlag[]) ?? [];
    const loginFlags = flags.filter(f => f.contributor === login);
    allRhythmFlags.push(...loginFlags);
  }

  const contributorRollups = (rollups ?? []) as ContributorRollup[];

  // Build summary
  const totalPRsOpened = contributorRollups.reduce((s, r) => s + r.prs_opened, 0);
  const totalPRsMerged = contributorRollups.reduce((s, r) => s + r.prs_merged, 0);
  const totalReviews = contributorRollups.reduce((s, r) => s + r.reviews_given, 0);
  const totalLinesAdded = contributorRollups.reduce((s, r) => s + r.lines_added, 0);
  const totalLinesDeleted = contributorRollups.reduce((s, r) => s + r.lines_deleted, 0);
  const revertCount = contributorRollups.reduce((s, r) => s + r.revert_prs, 0);
  const weeksActive = contributorRollups.filter(r => r.prs_opened > 0 || r.reviews_given > 0).length;

  const allPRSizes = contributorRollups
    .filter(r => r.avg_pr_size_lines !== null)
    .map(r => r.avg_pr_size_lines as number);
  const avgPRSizeLines =
    allPRSizes.length > 0
      ? allPRSizes.reduce((a, b) => a + b, 0) / allPRSizes.length
      : null;

  const turnaroundValues = contributorRollups
    .filter(r => r.median_review_turnaround_hrs !== null)
    .map(r => r.median_review_turnaround_hrs as number);
  const avgReviewTurnaroundHrs =
    turnaroundValues.length > 0
      ? turnaroundValues.reduce((a, b) => a + b, 0) / turnaroundValues.length
      : null;

  return NextResponse.json({
    data: {
      github_login: login,
      weeks: contributorRollups.reverse(), // ascending for charts
      rhythm_flags: allRhythmFlags,
      summary: {
        github_login: login,
        total_prs_opened: totalPRsOpened,
        total_prs_merged: totalPRsMerged,
        total_reviews_given: totalReviews,
        total_lines_added: totalLinesAdded,
        total_lines_deleted: totalLinesDeleted,
        avg_pr_size_lines: avgPRSizeLines !== null ? Math.round(avgPRSizeLines) : null,
        avg_review_turnaround_hrs: avgReviewTurnaroundHrs,
        revert_count: revertCount,
        weeks_active: weeksActive,
        rhythm_flags: allRhythmFlags.slice(0, 5), // latest 5 flags for summary
      },
    },
    error: null,
  });
}
