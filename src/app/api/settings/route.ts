// src/app/api/settings/route.ts
// GET /api/settings — Return user settings (Slack webhook MASKED, email prefs).
// PUT /api/settings — Update Slack webhook URL and email preferences.
// Auth required. NEVER returns full Slack webhook URL (MF-8).

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { isValidSlackWebhook, maskWebhookUrl } from '@/lib/alerts/slack';
import type { ApiResponse } from '@/types/index';

// ─────────────────────────────────────────────────────────────────────────────
// SHAPES
// ─────────────────────────────────────────────────────────────────────────────

interface UserSettings {
  plan: string;
  slack_webhook_configured: boolean;
  /** Masked URL — safe to return to client. e.g. "hooks.slack.com/services/.../XYZ" */
  slack_webhook_masked: string | null;
  resend_email: string | null;
  narrative_month: string | null;
  narrative_count: number;
  last_manual_sync_at: string | null;
}

type ProfileRow = {
  plan: string;
  slack_webhook_url: string | null;
  resend_email: string | null;
  narrative_month: string | null;
  narrative_count: number;
  last_manual_sync_at: string | null;
};

function toSettings(profile: ProfileRow): UserSettings {
  return {
    plan: profile.plan,
    slack_webhook_configured: !!profile.slack_webhook_url,
    slack_webhook_masked: profile.slack_webhook_url
      ? maskWebhookUrl(profile.slack_webhook_url)
      : null,
    resend_email: profile.resend_email,
    narrative_month: profile.narrative_month,
    narrative_count: profile.narrative_count,
    last_manual_sync_at: profile.last_manual_sync_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<ApiResponse<UserSettings>>> {
  const supabase = createServerSupabase();
  const admin = createAdminSupabase();

  // ── Auth check ─────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // ── Load profile ───────────────────────────────────────────────────────────
  const { data: profileData, error: profileError } = await admin
    .from('user_profiles')
    .select('plan, slack_webhook_url, resend_email, narrative_month, narrative_count, last_manual_sync_at')
    .eq('id', user.id)
    .single();

  if (profileError || !profileData) {
    return NextResponse.json({ data: null, error: 'USER_PROFILE_NOT_FOUND' }, { status: 404 });
  }

  const profile = profileData as ProfileRow;

  return NextResponse.json({ data: toSettings(profile), error: null });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT handler
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse<UserSettings>>> {
  const supabase = createServerSupabase();
  const admin = createAdminSupabase();

  // ── Auth check ─────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: {
    slack_webhook_url?: string | null;
    resend_email?: string | null;
  };

  try {
    body = await req.json() as { slack_webhook_url?: string | null; resend_email?: string | null };
  } catch {
    return NextResponse.json({ data: null, error: 'INVALID_JSON_BODY' }, { status: 400 });
  }

  // ── Validate inputs ────────────────────────────────────────────────────────
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ('slack_webhook_url' in body) {
    if (body.slack_webhook_url === null || body.slack_webhook_url === '') {
      // Allow clearing the webhook URL
      updates['slack_webhook_url'] = null;
    } else if (typeof body.slack_webhook_url === 'string') {
      // Validate format before storing (MF-8)
      if (!isValidSlackWebhook(body.slack_webhook_url)) {
        return NextResponse.json(
          {
            data: null,
            error: 'INVALID_SLACK_WEBHOOK_FORMAT',
            message: 'Webhook URL must match https://hooks.slack.com/services/T.../B.../... format',
          },
          { status: 400 }
        );
      }
      updates['slack_webhook_url'] = body.slack_webhook_url;
    }
  }

  if ('resend_email' in body) {
    if (body.resend_email === null || body.resend_email === '') {
      updates['resend_email'] = null;
    } else if (typeof body.resend_email === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.resend_email)) {
        return NextResponse.json(
          { data: null, error: 'INVALID_EMAIL_FORMAT' },
          { status: 400 }
        );
      }
      updates['resend_email'] = body.resend_email;
    }
  }

  // ── Apply update ───────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedData, error: updateError } = await (admin.from('user_profiles') as any)
    .update(updates)
    .eq('id', user.id)
    .select('plan, slack_webhook_url, resend_email, narrative_month, narrative_count, last_manual_sync_at')
    .single();

  if (updateError || !updatedData) {
    return NextResponse.json({ data: null, error: 'SETTINGS_UPDATE_FAILED' }, { status: 500 });
  }

  const updated = updatedData as ProfileRow;

  return NextResponse.json({ data: toSettings(updated), error: null });
}
