'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClientSupabase } from '@/lib/supabase/client';
import type { UserProfile } from '@/types/index';

// Shape returned from /api/settings
interface UserSettings {
  plan: 'free' | 'pro' | 'team';
  slack_webhook_configured: boolean;
  slack_webhook_masked: string | null;
  resend_email: string | null;
  narrative_month: string | null;
  narrative_count: number;
  last_manual_sync_at: string | null;
}

interface UseUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useUserProfile(): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get the Supabase session for user meta
      const supabase = createClientSupabase();
      const { data: { user } } = await supabase.auth.getUser();

      // Get settings from API for plan + quota info
      const text = await fetch('/api/settings').then((r) => r.text());
      const json = JSON.parse(text) as { data: UserSettings | null; error: string | null };

      if (json.error || !json.data) {
        // Fallback: build minimal profile from user metadata
        if (user) {
          setProfile({
            id: user.id,
            github_username: (user.user_metadata?.user_name as string) ?? '',
            github_avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
            plan: 'free',
            slack_webhook_url: null,
            resend_email: null,
            narrative_month: null,
            narrative_count: 0,
            last_manual_sync_at: null,
            created_at: user.created_at ?? '',
            updated_at: user.updated_at ?? '',
          });
        } else {
          setError(json.error ?? 'Failed to load profile');
          setProfile(null);
        }
      } else {
        const settings = json.data;
        setProfile({
          id: user?.id ?? '',
          github_username: (user?.user_metadata?.user_name as string) ?? '',
          github_avatar_url: (user?.user_metadata?.avatar_url as string) ?? null,
          plan: settings.plan,
          slack_webhook_url: null, // never exposed client-side (MF-8)
          resend_email: settings.resend_email,
          narrative_month: settings.narrative_month,
          narrative_count: settings.narrative_count,
          last_manual_sync_at: settings.last_manual_sync_at,
          created_at: user?.created_at ?? '',
          updated_at: user?.updated_at ?? '',
        });
      }
    } catch {
      setError('Failed to load user profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}

interface UseAuthResult {
  userId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClientSupabase();
    supabase.auth.getSession().then(({ data }: { data: { session: { user: { id: string } } | null } }) => {
      setUserId(data.session?.user.id ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: unknown, session: { user: { id: string } } | null) => {
      setUserId(session?.user.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClientSupabase();
    await supabase.auth.signOut();
    window.location.href = '/';
  }, []);

  return { userId, loading, signOut };
}
