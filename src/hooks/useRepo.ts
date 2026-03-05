'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RepoSummary, RepoDashboardData, ContributorSummary, StalePR, BottleneckItem, WeeklyHealthScore } from '@/types/index';

interface UseReposResult {
  repos: RepoSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRepos(): UseReposResult {
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await fetch('/api/repos').then((r) => r.text());
      const json = JSON.parse(text) as { data: RepoSummary[] | null; error: string | null };
      if (json.error) {
        setError(json.error);
        setRepos([]);
      } else {
        setRepos(json.data ?? []);
      }
    } catch {
      setError('Failed to load repositories');
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  return { repos, loading, error, refetch: fetchRepos };
}

interface UseRepoDashboardResult {
  data: RepoDashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Builds a RepoDashboardData by fetching from multiple APIs
export function useRepoDashboard(repoId: string | null): UseRepoDashboardResult {
  const [data, setData] = useState<RepoDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch all data in parallel
      const [repoDetailText, contribText, bottleneckText] = await Promise.all([
        fetch(`/api/repos/${repoId}`).then((r) => r.text()),
        fetch(`/api/contributors/${repoId}`).then((r) => r.text()),
        fetch(`/api/bottlenecks/${repoId}`).then((r) => r.text()),
      ]);

      const repoDetailJson = JSON.parse(repoDetailText) as {
        data: { repo: RepoSummary; scores: WeeklyHealthScore[] } | null;
        error: string | null;
      };
      const contribJson = JSON.parse(contribText) as {
        data: { contributors: ContributorSummary[]; plan: string } | null;
        error: string | null;
      };
      const bottleneckJson = JSON.parse(bottleneckText) as {
        data: { bottlenecks: BottleneckItem[] } | null;
        error: string | null;
      };

      if (repoDetailJson.error) {
        setError(repoDetailJson.error);
        setData(null);
        return;
      }

      const repo = repoDetailJson.data?.repo ?? null;
      const scores = repoDetailJson.data?.scores ?? [];
      const contributors = contribJson.data?.contributors ?? [];
      const bottlenecks = bottleneckJson.data?.bottlenecks ?? [];
      const plan = (contribJson.data?.plan ?? 'free') as 'free' | 'pro' | 'team';

      // Stale PRs: not a dedicated endpoint, so leave empty (shown on bottleneck/score cards)
      const stalePRs: StalePR[] = [];

      if (!repo) {
        setError('Repository not found');
        setData(null);
        return;
      }

      setData({
        repo,
        scores,
        contributors,
        stale_prs: stalePRs,
        latest_bottlenecks: bottlenecks,
        user_plan: plan,
      });
    } catch {
      setError('Failed to load dashboard data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
