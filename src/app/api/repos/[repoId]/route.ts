// src/app/api/repos/[repoId]/route.ts
// GET    /api/repos/[repoId] — repo detail + last 13 weeks scores
// DELETE /api/repos/[repoId] — soft-delete repo

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ─── GET: Repo detail + last 13 weeks scores ─────────────────────────────────

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

  // Fetch repo — RLS ensures user owns it
  const { data: repo, error: repoError } = await supabase
    .from('repos')
    .select('*')
    .eq('id', repoId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (repoError || !repo) {
    return NextResponse.json({ data: null, error: 'REPO_NOT_FOUND' }, { status: 404 });
  }

  // Fetch last 13 weeks of scores
  const { data: scores, error: scoresError } = await supabase
    .from('weekly_health_scores')
    .select('*')
    .eq('repo_id', repoId)
    .order('week_start', { ascending: false })
    .limit(13);

  if (scoresError) {
    return NextResponse.json({ data: null, error: 'SCORES_FETCH_FAILED' }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      repo,
      scores: (scores ?? []).reverse(), // return ascending for chart rendering
    },
    error: null,
  });
}

// ─── DELETE: Soft-delete repo ─────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: { repoId: string } }
): Promise<NextResponse> {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { repoId } = params;

  // Verify ownership before soft-delete
  const { data: repo } = await supabase
    .from('repos')
    .select('id')
    .eq('id', repoId)
    .eq('user_id', user.id)
    .single();

  if (!repo) {
    return NextResponse.json({ data: null, error: 'REPO_NOT_FOUND' }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from('repos')
    .update({ is_active: false })
    .eq('id', repoId);

  if (deleteError) {
    return NextResponse.json({ data: null, error: 'DELETE_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ data: { deleted: true }, error: null });
}
