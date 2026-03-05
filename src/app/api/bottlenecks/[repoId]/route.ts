// src/app/api/bottlenecks/[repoId]/route.ts
// GET /api/bottlenecks/[repoId] — bottleneck analysis for a repo

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import type { BottleneckItem } from '@/types/index';

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

  // Get ?week= param or default to latest
  const { searchParams } = new URL(request.url);
  const weekParam = searchParams.get('week');

  let scoreQuery = supabase
    .from('weekly_health_scores')
    .select('week_start, bottleneck_analysis, score')
    .eq('repo_id', repoId)
    .order('week_start', { ascending: false })
    .limit(1);

  if (weekParam) {
    scoreQuery = supabase
      .from('weekly_health_scores')
      .select('week_start, bottleneck_analysis, score')
      .eq('repo_id', repoId)
      .eq('week_start', weekParam)
      .limit(1);
  }

  const { data: scoreData, error: scoreError } = await scoreQuery.single();

  if (scoreError && scoreError.code !== 'PGRST116') {
    // PGRST116 = no rows — that's OK
    return NextResponse.json({ data: null, error: 'SCORE_FETCH_FAILED' }, { status: 500 });
  }

  const bottlenecks = (scoreData?.bottleneck_analysis as BottleneckItem[]) ?? [];

  return NextResponse.json({
    data: {
      week_start: scoreData?.week_start ?? null,
      score: scoreData?.score ?? null,
      bottlenecks,
    },
    error: null,
  });
}
