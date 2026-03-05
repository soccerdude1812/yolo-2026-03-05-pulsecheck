// src/app/api/alerts/route.ts
// GET /api/alerts — List recent alerts for the authenticated user's repos.
// Auth required.

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import type { ApiResponse, AlertLog } from '@/types/index';

// ─────────────────────────────────────────────────────────────────────────────
// SHAPES
// ─────────────────────────────────────────────────────────────────────────────

interface AlertWithRepo extends AlertLog {
  repo_name: string;           // github_full_name from repos table
}

type RepoRow = { id: string; github_full_name: string };

// ─────────────────────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<AlertWithRepo[]>>> {
  const supabase = createServerSupabase();
  const admin = createAdminSupabase();

  // ── Auth check ─────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // ── Parse optional query params ───────────────────────────────────────────
  const url = new URL(req.url);
  const limitStr = url.searchParams.get('limit') ?? '50';
  const limit = Math.min(Math.max(parseInt(limitStr, 10) || 50, 1), 200);
  const repoId = url.searchParams.get('repo_id');

  // ── Fetch user's repo IDs ─────────────────────────────────────────────────
  const { data: userReposData, error: reposError } = await admin
    .from('repos')
    .select('id, github_full_name')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (reposError) {
    return NextResponse.json({ data: null, error: 'REPOS_FETCH_FAILED' }, { status: 500 });
  }

  const userRepos = (userReposData ?? []) as RepoRow[];

  if (userRepos.length === 0) {
    return NextResponse.json({ data: [], error: null });
  }

  const repoMap = new Map<string, string>(
    userRepos.map((r) => [r.id, r.github_full_name])
  );
  const repoIds = Array.from(repoMap.keys());

  // ── Query alert_log ───────────────────────────────────────────────────────
  // Build the base query
  let alertsQuery = admin
    .from('alert_log')
    .select('*')
    .in('repo_id', repoIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (repoId) {
    // Verify the requested repo belongs to this user
    if (!repoMap.has(repoId)) {
      return NextResponse.json({ data: null, error: 'REPO_NOT_FOUND' }, { status: 404 });
    }
    alertsQuery = alertsQuery.eq('repo_id', repoId);
  }

  const { data: alertData, error: alertsError } = await alertsQuery;
  if (alertsError) {
    return NextResponse.json({ data: null, error: 'ALERTS_FETCH_FAILED' }, { status: 500 });
  }

  // ── Enrich with repo name ─────────────────────────────────────────────────
  const alertRows = (alertData ?? []) as AlertLog[];
  const alerts: AlertWithRepo[] = alertRows.map((row) => ({
    ...row,
    repo_name: repoMap.get(row.repo_id) ?? row.repo_id,
  }));

  return NextResponse.json({ data: alerts, error: null });
}
