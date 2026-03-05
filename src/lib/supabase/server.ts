// src/lib/supabase/server.ts
// Server-side Supabase client using @supabase/ssr cookie adapter.
// Use this in Server Components and Route Handlers.
// Uses getAll/setAll API compatible with @supabase/ssr v0.9.0+

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/utils/env';

export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component context — middleware handles session refresh
        }
      },
    },
  });
}
