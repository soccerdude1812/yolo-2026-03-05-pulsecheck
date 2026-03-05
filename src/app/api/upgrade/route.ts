// src/app/api/upgrade/route.ts
// POST /api/upgrade — stub endpoint, returns 503 PAYMENT_NOT_CONFIGURED
// Stripe integration is deferred (APPROVED.md R-1).
// This stub satisfies the UI flow without breaking anything.

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(): Promise<NextResponse> {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  return NextResponse.json(
    {
      data: null,
      error: 'PAYMENT_NOT_CONFIGURED',
      message: 'Payment processing is coming soon. Contact us at hello@pulsecheck.dev to get early Pro access.',
    },
    { status: 503 }
  );
}
