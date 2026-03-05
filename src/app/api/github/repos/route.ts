// src/app/api/github/repos/route.ts
// GET /api/github/repos — list user's accessible GitHub repos
// MF-7: GitHub API called server-side only — provider_token never exposed to client

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { githubRequest } from '@/lib/github/client';
import type { GitHubRepo } from '@/types/index';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Get GitHub token from user_profiles (persisted during OAuth callback)
  // Use admin client to bypass RLS column restrictions
  const adminForToken = createAdminSupabase();
  const { data: tokenData } = await adminForToken
    .from('user_profiles')
    .select('github_token')
    .eq('id', user.id)
    .single() as { data: { github_token: string | null } | null };

  const providerToken = tokenData?.github_token;

  if (!providerToken) {
    return NextResponse.json(
      { data: null, error: 'GITHUB_TOKEN_MISSING' },
      { status: 401 }
    );
  }

  try {
    // Fetch user's repos sorted by update time, first 50
    const result = await githubRequest<GitHubRepo[]>(
      '/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator',
      { token: providerToken }
    );

    // Return only necessary fields
    const repos = result.data.map((r) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      owner: { login: r.owner.login },
      private: r.private,
      default_branch: r.default_branch,
      updated_at: r.updated_at,
    }));

    return NextResponse.json({ data: repos, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: 'GITHUB_FETCH_FAILED' },
      { status: 500 }
    );
  }
}
