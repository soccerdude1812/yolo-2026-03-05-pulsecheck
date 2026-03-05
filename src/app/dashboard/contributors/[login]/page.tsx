'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useUserProfile } from '@/hooks/useUserProfile';
import { canUseFeature } from '@/lib/utils/plan';
import type { ContributorDeepDive } from '@/types/index';

export const dynamic = 'force-dynamic';

function ContributorDeepDivePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const login = params.login as string;
  const repoId = searchParams.get('repo');
  const { profile } = useUserProfile();

  const plan = profile?.plan ?? 'free';
  const canDeepDive = canUseFeature(plan, 'contributor_deep_dive');

  const [data, setData] = useState<ContributorDeepDive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId || !login || !canDeepDive) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      try {
        const text = await fetch(`/api/contributors/${repoId}/${encodeURIComponent(login)}`).then(r => r.text());
        const json = JSON.parse(text) as { data: ContributorDeepDive | null; error: string | null };
        if (json.error) setError(json.error);
        else setData(json.data);
      } catch {
        setError('Failed to load contributor data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [repoId, login, canDeepDive]);

  // Pro gate
  if (!canDeepDive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-zinc-50 mb-3">Contributor Deep-Dive is a Pro feature</h2>
        <p className="text-zinc-400 text-sm max-w-sm mb-8 leading-relaxed">
          See individual contributor history across 52 weeks — PR size trends, review speed over time, and detailed rhythm analysis for @{login}.
        </p>
        <a
          href="/#pricing"
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Upgrade to Pro
        </a>
        <Link href={`/dashboard/contributors${repoId ? `?repo=${repoId}` : ''}`} className="mt-4 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Back to contributors
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-rose-400 text-sm">{error ?? 'Contributor not found'}</p>
        <Link href={`/dashboard/contributors${repoId ? `?repo=${repoId}` : ''}`} className="mt-4 text-sm text-zinc-500 hover:text-zinc-300 inline-block transition-colors">
          ← Back to contributors
        </Link>
      </div>
    );
  }

  const { summary, rhythm_flags } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {summary.avatar_url ? (
            <img src={summary.avatar_url} alt={login} className="w-12 h-12 rounded-full" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
              <span className="text-lg text-zinc-400 font-medium">{login[0]?.toUpperCase()}</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-zinc-50">@{login}</h1>
            <p className="text-zinc-400 text-sm">{summary.weeks_active} weeks active</p>
          </div>
        </div>
        <Link
          href={`/dashboard/contributors${repoId ? `?repo=${repoId}` : ''}`}
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'PRs Opened', value: summary.total_prs_opened.toString() },
          { label: 'PRs Merged', value: summary.total_prs_merged.toString() },
          { label: 'Reviews Given', value: summary.total_reviews_given.toString() },
          {
            label: 'Avg Review Speed',
            value: summary.avg_review_turnaround_hrs != null
              ? summary.avg_review_turnaround_hrs < 24
                ? `${Math.round(summary.avg_review_turnaround_hrs)}h`
                : `${(summary.avg_review_turnaround_hrs / 24).toFixed(1)}d`
              : '—',
          },
        ].map((stat) => (
          <Card key={stat.label} padding="md" className="text-center">
            <div className="text-2xl font-bold text-zinc-50">{stat.value}</div>
            <div className="text-xs text-zinc-500 mt-1">{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Rhythm flags */}
      {rhythm_flags.length > 0 && (
        <Card padding="md">
          <h2 className="font-semibold text-zinc-50 mb-4">Active Rhythm Flags</h2>
          <div className="space-y-3">
            {rhythm_flags.map((flag, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${flag.severity === 'critical' ? 'bg-rose-500/5 border-rose-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                <svg className={`w-4 h-4 mt-0.5 shrink-0 ${flag.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200">{flag.flag_type.replace(/_/g, ' ')}</span>
                    <Badge variant={flag.severity === 'critical' ? 'rose' : 'amber'} className="capitalize text-[10px]">
                      {flag.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{flag.description}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Current: <span className="text-zinc-300">{flag.current_value.toFixed(1)}</span>
                    {' · '}Baseline: <span className="text-zinc-300">{flag.baseline_value.toFixed(1)}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Activity over time */}
      <Card padding="md">
        <h2 className="font-semibold text-zinc-50 mb-1">Lines Added Over Time</h2>
        <p className="text-xs text-zinc-500 mb-4">Weekly lines added across the tracked period</p>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-1.5 h-24 min-w-[400px]">
            {data.weeks.slice(-26).map((week) => {
              const maxLines = Math.max(...data.weeks.map(w => w.lines_added), 1);
              const heightPct = (week.lines_added / maxLines) * 100;
              return (
                <div
                  key={week.week_start}
                  title={`Week of ${new Date(week.week_start).toLocaleDateString()}: ${week.lines_added} lines added`}
                  className="flex-1 bg-emerald-500/60 hover:bg-emerald-500 rounded-sm transition-colors min-w-[8px]"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ContributorDeepDivePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    }>
      <ContributorDeepDivePageContent />
    </Suspense>
  );
}
