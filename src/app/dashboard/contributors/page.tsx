'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ContributorTable } from '@/components/dashboard/ContributorTable';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { useRepoDashboard } from '@/hooks/useRepo';
import { useUserProfile } from '@/hooks/useUserProfile';
import { canUseFeature } from '@/lib/utils/plan';

export const dynamic = 'force-dynamic';

function ContributorsPageContent() {
  const searchParams = useSearchParams();
  const repoId = searchParams.get('repo');
  const { data, loading, error } = useRepoDashboard(repoId);
  const { profile } = useUserProfile();

  const plan = profile?.plan ?? 'free';
  const canDeepDive = canUseFeature(plan, 'contributor_deep_dive');

  if (!repoId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-zinc-400">Select a repo to view contributors.</p>
        </div>
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

  if (error) {
    return (
      <div className="text-center py-12 text-rose-400 text-sm">{error}</div>
    );
  }

  const contributors = data?.contributors ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Contributors</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Contributor activity and rhythm analysis
          {!canDeepDive && (
            <span className="ml-2 text-xs text-amber-400">
              — Upgrade to Pro for individual deep-dives (52 weeks)
            </span>
          )}
        </p>
      </div>

      {/* Stats row */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card padding="md" className="text-center">
            <div className="text-3xl font-bold text-zinc-50">{contributors.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Active contributors</div>
          </Card>
          <Card padding="md" className="text-center">
            <div className="text-3xl font-bold text-zinc-50">
              {contributors.reduce((s, c) => s + c.total_prs_opened, 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Total PRs (tracked period)</div>
          </Card>
          <Card padding="md" className="text-center">
            <div className="text-3xl font-bold text-zinc-50">
              {contributors.reduce((s, c) => s + c.total_reviews_given, 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Total reviews given</div>
          </Card>
          <Card padding="md" className="text-center">
            <div className={`text-3xl font-bold ${contributors.some(c => c.rhythm_flags.length > 0) ? 'text-amber-400' : 'text-emerald-400'}`}>
              {contributors.reduce((s, c) => s + c.rhythm_flags.length, 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Active rhythm flags</div>
          </Card>
        </div>
      )}

      {/* Contributor table */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="font-semibold text-zinc-50">Contributor Overview</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Sorted by most active. Click contributor name for deep-dive{!canDeepDive ? ' (Pro feature)' : ''}.
          </p>
        </div>
        <ContributorTable
          contributors={contributors}
          repoId={repoId}
          canDeepDive={canDeepDive}
        />
      </Card>

      {/* Pro upsell if not eligible */}
      {!canDeepDive && contributors.length > 0 && (
        <Card padding="md" className="border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-zinc-50">Get contributor deep-dives with Pro</h3>
              <p className="text-sm text-zinc-400 mt-1">
                See individual contributor 52-week history, PR size trends, review speed over time, and detailed rhythm analysis per contributor.
              </p>
              <a href="/#pricing" className="inline-flex items-center gap-1 mt-3 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                Upgrade to Pro →
              </a>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function ContributorsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    }>
      <ContributorsPageContent />
    </Suspense>
  );
}
