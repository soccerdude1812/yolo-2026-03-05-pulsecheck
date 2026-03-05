'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ScoreCard } from '@/components/dashboard/ScoreCard';
import { ScoreTrendChart } from '@/components/dashboard/ScoreTrendChart';
import { SubScoreGrid } from '@/components/dashboard/SubScoreGrid';
import { NarrativeDigest } from '@/components/dashboard/NarrativeDigest';
import { StalePRList } from '@/components/dashboard/StalePRList';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { useRepoDashboard } from '@/hooks/useRepo';
import { useScores } from '@/hooks/useScores';
import { useUserProfile } from '@/hooks/useUserProfile';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const repoId = searchParams.get('repo');
  const { data, loading: dashLoading, error: dashError, refetch } = useRepoDashboard(repoId);
  const { scores, loading: scoresLoading } = useScores(repoId, 13);
  const { profile } = useUserProfile();

  const isLoading = dashLoading || scoresLoading;
  const repo = data?.repo ?? null;
  // Scores are in ascending order (oldest first), so latest is last
  const sortedScores = data?.scores ?? [];
  const latestScore = sortedScores[sortedScores.length - 1] ?? null;
  const prevScore = sortedScores[sortedScores.length - 2] ?? null;

  // Handle no repo selected
  if (!repoId) {
    return (
      <EmptyState
        syncStatus={null}
        hasData={false}
        onAddRepo={() => {}}
        username={profile?.github_username}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (dashError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-50 mb-2">Failed to load dashboard</h2>
        <p className="text-zinc-400 text-sm mb-6">{dashError}</p>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state — use repo sync status
  if (!latestScore && repo) {
    return (
      <EmptyState
        syncStatus={repo.sync_status}
        hasData={false}
        onSync={async () => {
          const text = await fetch(`/api/repos/${repoId}/sync`, { method: 'POST' }).then(r => r.text());
          const json = JSON.parse(text);
          if (!json.error) refetch();
        }}
        error={repo.sync_error}
        username={profile?.github_username}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Row 1: Score + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score */}
        <Card padding="lg" className="flex flex-col items-center justify-center">
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
            Week of {latestScore ? new Date(latestScore.week_start).toLocaleDateString('default', { month: 'short', day: 'numeric' }) : '—'}
          </div>
          <ScoreCard
            score={latestScore?.score ?? null}
            prevScore={prevScore?.score ?? null}
            label="Health Score"
            size="lg"
            showTrend={true}
          />
          {latestScore && (
            <div className="mt-6 grid grid-cols-2 gap-3 w-full text-center">
              <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
                <div className="text-lg font-semibold text-zinc-200">{latestScore.total_prs_opened}</div>
                <div className="text-xs text-zinc-500">PRs opened</div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
                <div className="text-lg font-semibold text-zinc-200">{latestScore.active_contributors}</div>
                <div className="text-xs text-zinc-500">Contributors</div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
                <div className="text-lg font-semibold text-zinc-200">{latestScore.total_prs_merged}</div>
                <div className="text-xs text-zinc-500">PRs merged</div>
              </div>
              <div className={`bg-zinc-800/50 rounded-lg px-3 py-2 ${latestScore.stale_pr_count > 0 ? 'bg-rose-500/5' : ''}`}>
                <div className={`text-lg font-semibold ${latestScore.stale_pr_count > 0 ? 'text-rose-400' : 'text-zinc-200'}`}>
                  {latestScore.stale_pr_count}
                </div>
                <div className="text-xs text-zinc-500">Stale PRs</div>
              </div>
            </div>
          )}
        </Card>

        {/* Score Trend */}
        <Card padding="md" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-zinc-50">Score Trend</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Last 13 weeks</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Healthy ≥ 80
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                ≥ 60
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                &lt; 60
              </div>
            </div>
          </div>
          <ScoreTrendChart scores={scores} height={220} />
        </Card>
      </div>

      {/* Row 2: Sub-scores */}
      <div>
        <h3 className="font-semibold text-zinc-50 mb-3">Signal Breakdown</h3>
        <SubScoreGrid score={latestScore} />
      </div>

      {/* Row 3: Narrative + Stale PRs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NarrativeDigest
          latestScore={latestScore}
          repoId={repoId}
          profile={profile}
          onNarrativeGenerated={() => refetch()}
        />

        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-50">Stale PRs</h3>
            {data?.stale_prs && data.stale_prs.length > 0 && (
              <span className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                {data.stale_prs.length} open
              </span>
            )}
          </div>
          <StalePRList prs={data?.stale_prs ?? []} />
        </Card>
      </div>

      {/* Row 4: Review timing stats */}
      {latestScore && (latestScore.median_time_to_first_review_hrs || latestScore.median_time_to_merge_hrs) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {latestScore.median_time_to_first_review_hrs != null && (
            <Card padding="md">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Median Time to First Review</div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-zinc-50">
                  {latestScore.median_time_to_first_review_hrs < 24
                    ? `${Math.round(latestScore.median_time_to_first_review_hrs)}h`
                    : `${(latestScore.median_time_to_first_review_hrs / 24).toFixed(1)}d`}
                </span>
                <span className="text-zinc-500 text-sm mb-0.5">median</span>
              </div>
            </Card>
          )}
          {latestScore.median_time_to_merge_hrs != null && (
            <Card padding="md">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Median Time to Merge</div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-zinc-50">
                  {latestScore.median_time_to_merge_hrs < 24
                    ? `${Math.round(latestScore.median_time_to_merge_hrs)}h`
                    : `${(latestScore.median_time_to_merge_hrs / 24).toFixed(1)}d`}
                </span>
                <span className="text-zinc-500 text-sm mb-0.5">median</span>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
