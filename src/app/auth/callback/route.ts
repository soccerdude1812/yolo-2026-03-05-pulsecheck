// src/app/auth/callback/route.ts
// Handle GitHub OAuth callback.
// Exchange code for session, upsert user_profiles, redirect to /dashboard.
// MF-7: provider_token NEVER stored or returned — session cookie handles it.

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { env } from '@/lib/utils/env';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${env.nextPublicSiteUrl}/?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${env.nextPublicSiteUrl}/?error=missing_code`);
  }

  const supabase = createServerSupabase();

  const { data: sessionData, error: sessionError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (sessionError || !sessionData.session) {
    console.error('OAuth callback error:', {
      error: sessionError?.message,
      // never log the token
    });
    return NextResponse.redirect(
      `${env.nextPublicSiteUrl}/?error=auth_failed`
    );
  }

  const { user, session } = sessionData;

  // Extract GitHub profile from user metadata
  const githubUsername =
    user.user_metadata?.user_name ??
    user.user_metadata?.preferred_username ??
    user.email?.split('@')[0] ??
    'unknown';

  const githubAvatarUrl =
    user.user_metadata?.avatar_url ??
    user.user_metadata?.picture ??
    null;

  // Upsert user_profiles — use admin client to bypass RLS for writing github_token
  const adminSupabase = createAdminSupabase();
  const profilePayload = {
    id: user.id,
    github_username: githubUsername,
    github_avatar_url: githubAvatarUrl,
    github_token: session.provider_token ?? null,
    plan: 'free',
    updated_at: new Date().toISOString(),
  };
  const { error: profileError } = await adminSupabase
    .from('user_profiles')
    .upsert(
      profilePayload as never,
      {
        onConflict: 'id',
        ignoreDuplicates: false,
      }
    );

  if (profileError) {
    console.error('Failed to upsert user_profiles:', {
      user_id: user.id,
      error: profileError.message,
      // Never log provider_token
    });
    // Still redirect — user is authenticated, profile creation failure is non-fatal
    // They'll hit the profile check on next load
  }

  // MF-7: provider_token is in sessionData.session — we do NOT store or return it
  // It stays in the Supabase session cookie only
  // Verify it exists (means OAuth worked)
  const hasToken = !!session.provider_token;
  if (!hasToken) {
    console.warn('OAuth session missing provider_token — GitHub API calls will fail', {
      user_id: user.id,
    });
  }

  return NextResponse.redirect(`${env.nextPublicSiteUrl}/dashboard`);
}
