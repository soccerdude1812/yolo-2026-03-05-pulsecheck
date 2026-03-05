// src/lib/utils/env.ts
// Environment variable loader — the SINGLE place all env vars are read.
// All values are .trim()'d to prevent trailing newline issues (Vercel, copy-paste, etc.)
// Every other file imports from here — NEVER use process.env directly elsewhere.

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function optionalEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  return value.trim() || undefined;
}

// Exported env object — all fields are pre-trimmed
export const env = {
  // Supabase — uses legacy eyJ... JWT format
  supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),

  // AI providers
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  groqApiKey: requireEnv('GROQ_API_KEY'),

  // Cron authentication (Bearer token, minimum 32 hex chars)
  cronSecret: requireEnv('CRON_SECRET'),

  // GitHub OAuth (optional at module load; required at auth time)
  githubClientId: optionalEnv('GITHUB_CLIENT_ID'),
  githubClientSecret: optionalEnv('GITHUB_CLIENT_SECRET'),
  githubToken: optionalEnv('GITHUB_TOKEN'),

  // Email
  resendApiKey: optionalEnv('RESEND_API_KEY'),
  resendFromEmail: optionalEnv('RESEND_FROM_EMAIL'),

  // App URL (for redirects)
  nextPublicSiteUrl: optionalEnv('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000',
} as const;

export type Env = typeof env;
