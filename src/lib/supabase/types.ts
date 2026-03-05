// src/lib/supabase/types.ts
// Supabase database type definitions.
// These are used by all 3 Supabase client files (client, server, admin).
// Kept minimal — the actual shape validation is done via TypeScript types in src/types/index.ts.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
// NOTE: In production you'd run `supabase gen types typescript` to generate a full
// typed Database interface from the actual schema. For this build, we use `any`
// to avoid maintenance burden — all type safety is enforced at the application
// layer via src/types/index.ts interfaces.
