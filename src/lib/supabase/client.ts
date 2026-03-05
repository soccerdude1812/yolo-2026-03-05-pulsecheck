// src/lib/supabase/client.ts
// Browser-side Supabase client — uses anon key.
// Used in Client Components ('use client') only.
// Do NOT use this in API routes or server components — use server.ts or admin.ts instead.

import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Returns a singleton browser Supabase client.
 * Safe to call multiple times — always returns the same instance.
 * Uses NEXT_PUBLIC_ vars directly (client-safe, already public).
 */
export function createClientSupabase() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}
