'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WeeklyHealthScore } from '@/types/index';

interface UseScoresResult {
  scores: WeeklyHealthScore[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useScores(repoId: string | null, weeks = 13): UseScoresResult {
  const [scores, setScores] = useState<WeeklyHealthScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScores = useCallback(async () => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/scores/${repoId}?weeks=${weeks}`;
      const text = await fetch(url).then((r) => r.text());
      const json = JSON.parse(text) as {
        data: { scores: WeeklyHealthScore[]; weeks_limit: number; plan: string } | null;
        error: string | null;
      };
      if (json.error) {
        setError(json.error);
        setScores([]);
      } else {
        setScores(json.data?.scores ?? []);
      }
    } catch {
      setError('Failed to load score history');
      setScores([]);
    } finally {
      setLoading(false);
    }
  }, [repoId, weeks]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  return { scores, loading, error, refetch: fetchScores };
}
