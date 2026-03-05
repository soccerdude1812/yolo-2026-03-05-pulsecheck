// src/lib/supabase/admin.ts
// Admin Supabase client using service role key — bypasses RLS.
// ONLY use in server-side code for cron jobs and internal sync ops.
// NEVER expose the service role key to the client.

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/utils/env';

// Singleton — avoid creating a new client on every request
let adminClient: ReturnType<typeof createClient> | null = null;

export function createAdminSupabase() {
  if (!adminClient) {
    adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}
