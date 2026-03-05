'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClientSupabase } from '@/lib/supabase/client';
import type { UserProfile } from '@/types/index';

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
      const text = await fetch('/api/user/profile').then((r) => r.text());
      const json = JSON.parse(text) as { data: UserProfile | null; error: string | null };
      if (json.error) {
        setError(json.error);
        setProfile(null);
      } else {
        setProfile(json.data);
      }
    } catch (err) {
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
