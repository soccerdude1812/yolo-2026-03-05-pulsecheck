// src/app/api/auth/github/route.ts
// Initiate GitHub OAuth via Supabase.
// GET /api/auth/github → redirects to GitHub OAuth page.

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { env } from '@/lib/utils/env';

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${env.nextPublicSiteUrl}/auth/callback`,
      scopes: 'read:user user:email repo',
    },
  });

  if (error || !data.url) {
    return NextResponse.json(
      { data: null, error: error?.message ?? 'Failed to initiate GitHub OAuth' },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.url);
}
