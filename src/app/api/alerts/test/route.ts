// src/app/api/alerts/test/route.ts
// POST /api/alerts/test — Send a test Slack ping.
// Auth required. Pro+ only. NEVER returns the webhook URL (MF-8).

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { sendSlackTestMessage, isValidSlackWebhook } from '@/lib/alerts/slack';
import type { ApiResponse, UserProfile } from '@/types/index';

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE SHAPE
// ─────────────────────────────────────────────────────────────────────────────

interface TestAlertResponse {
  success: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<TestAlertResponse>>> {
  const supabase = createServerSupabase();
  const admin = createAdminSupabase();

  // ── Auth check ─────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // ── Load user profile ──────────────────────────────────────────────────────
  const { data: profileRow, error: profileError } = await admin
    .from('user_profiles')
    .select('id, plan, slack_webhook_url')
    .eq('id', user.id)
    .single();

  if (profileError || !profileRow) {
    return NextResponse.json({ data: null, error: 'USER_PROFILE_NOT_FOUND' }, { status: 404 });
  }

  const profile = profileRow as Pick<UserProfile, 'id' | 'plan' | 'slack_webhook_url'>;

  // ── Plan gate: Pro+ only ───────────────────────────────────────────────────
  if (profile.plan === 'free') {
    return NextResponse.json(
      { data: null, error: 'PLAN_UPGRADE_REQUIRED', message: 'Slack alerts require a Pro or Team plan.' },
      { status: 403 }
    );
  }

  // ── Check if webhook is configured ────────────────────────────────────────
  if (!profile.slack_webhook_url) {
    return NextResponse.json(
      { data: null, error: 'SLACK_WEBHOOK_NOT_CONFIGURED' },
      { status: 400 }
    );
  }

  // ── Validate webhook format (MF-8) ────────────────────────────────────────
  // SECURITY: never log or return the actual webhook URL
  if (!isValidSlackWebhook(profile.slack_webhook_url)) {
    return NextResponse.json(
      { data: null, error: 'INVALID_SLACK_WEBHOOK_FORMAT' },
      { status: 400 }
    );
  }

  // ── Parse optional body for repo_name ─────────────────────────────────────
  let repoName: string | undefined;
  try {
    const body = await req.json();
    repoName = typeof body.repo_name === 'string' ? body.repo_name : undefined;
  } catch {
    // body is optional — proceed without it
  }

  // ── Send test message ─────────────────────────────────────────────────────
  // Non-blocking by design — sendSlackTestMessage never throws
  const result = await sendSlackTestMessage(profile.slack_webhook_url, repoName);

  if (!result.success) {
    return NextResponse.json(
      { data: null, error: result.error ?? 'SLACK_DELIVERY_FAILED' },
      { status: 502 }
    );
  }

  // SECURITY: return success/failure only — never the webhook URL (MF-8)
  return NextResponse.json({ data: { success: true }, error: null });
}
