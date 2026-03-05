// src/app/api/contributors/[repoId]/route.ts
// GET /api/contributors/[repoId] — all contributors + rollups + rhythm flags

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { PLAN_LIMITS } from '@/types/index';
import type { ContributorRollup, RhythmFlag, ContributorSummary } from '@/types/index';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { repoId: string } }
): Promise<NextResponse> {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { repoId } = params;

  // Get user plan
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ data: null, error: 'PROFILE_NOT_FOUND' }, { status: 404 });
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
  const weeksWindow = planLimits.history_weeks;

  // Fetch contributor rollups within plan window
  const { data: rollups, error: rollupsError } = await supabase
    .from('contributor_rollups')
    .select('*')
    .eq('repo_id', repoId)
    .order('week_start', { ascending: false })
    .limit(weeksWindow * 20); // rough cap: up to 20 contributors × weeks

  if (rollupsError) {
    return NextResponse.json({ data: null, error: 'ROLLUPS_FETCH_FAILED' }, { status: 500 });
  }

  // Get latest week's rhythm flags from health score
  const { data: latestScore } = await supabase
    .from('weekly_health_scores')
    .select('week_start, rhythm_flags')
    .eq('repo_id', repoId)
    .order('week_start', { ascending: false })
    .limit(1)
    .single();

  const rhythmFlags: RhythmFlag[] = (latestScore?.rhythm_flags as RhythmFlag[]) ?? [];

  // Aggregate rollups into ContributorSummary
  const allRollups = (rollups ?? []) as ContributorRollup[];
  const loginMap = new Map<string, ContributorRollup[]>();

  for (const rollup of allRollups) {
    const existing = loginMap.get(rollup.github_login) ?? [];
    existing.push(rollup);
    loginMap.set(rollup.github_login, existing);
  }

  const contributors: ContributorSummary[] = [];

  for (const [login, contributorRollups] of Array.from(loginMap)) {
    const totalPRsOpened = contributorRollups.reduce((s: number, r: ContributorRollup) => s + r.prs_opened, 0);
    const totalPRsMerged = contributorRollups.reduce((s: number, r: ContributorRollup) => s + r.prs_merged, 0);
    const totalReviews = contributorRollups.reduce((s: number, r: ContributorRollup) => s + r.reviews_given, 0);
    const totalLinesAdded = contributorRollups.reduce((s: number, r: ContributorRollup) => s + r.lines_added, 0);
    const totalLinesDeleted = contributorRollups.reduce((s: number, r: ContributorRollup) => s + r.lines_deleted, 0);
    const revertCount = contributorRollups.reduce((s: number, r: ContributorRollup) => s + r.revert_prs, 0);
    const weeksActive = contributorRollups.filter((r: ContributorRollup) => r.prs_opened > 0 || r.reviews_given > 0).length;

    const allPRSizes = contributorRollups
      .filter((r: ContributorRollup) => r.avg_pr_size_lines !== null)
      .map((r: ContributorRollup) => r.avg_pr_size_lines as number);
    const avgPRSizeLines =
      allPRSizes.length > 0
        ? allPRSizes.reduce((a: number, b: number) => a + b, 0) / allPRSizes.length
        : null;

    const turnaroundValues = contributorRollups
      .filter((r: ContributorRollup) => r.median_review_turnaround_hrs !== null)
      .map((r: ContributorRollup) => r.median_review_turnaround_hrs as number);
    const avgReviewTurnaroundHrs =
      turnaroundValues.length > 0
        ? turnaroundValues.reduce((a: number, b: number) => a + b, 0) / turnaroundValues.length
        : null;

    const loginFlags = rhythmFlags.filter((f: RhythmFlag) => f.contributor === login);

    contributors.push({
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
      rhythm_flags: loginFlags,
    });
  }

  // Sort by total PRs opened descending
  contributors.sort((a, b) => b.total_prs_opened - a.total_prs_opened);

  return NextResponse.json({
    data: {
      contributors,
      rhythm_flags: rhythmFlags,
      weeks_window: weeksWindow,
      plan: profile.plan,
    },
    error: null,
  });
}
