'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BottleneckChart } from '@/components/dashboard/BottleneckChart';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useRepoDashboard } from '@/hooks/useRepo';
import { useScores } from '@/hooks/useScores';
import type { BottleneckItem } from '@/types/index';

export const dynamic = 'force-dynamic';

function BottleneckCard({ bottleneck }: { bottleneck: BottleneckItem }) {
  const isCritical = bottleneck.severity === 'critical';
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${
      isCritical
        ? 'bg-rose-500/5 border-rose-500/20'
        : 'bg-amber-500/5 border-amber-500/20'
    }`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
        isCritical ? 'bg-rose-500/10' : 'bg-amber-500/10'
      }`}>
        <svg className={`w-5 h-5 ${isCritical ? 'text-rose-400' : 'text-amber-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-zinc-200">
            {bottleneck.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
          <Badge variant={isCritical ? 'rose' : 'amber'} className="capitalize">
            {bottleneck.severity}
          </Badge>
        </div>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{bottleneck.description}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
          <span>{bottleneck.metric}: <span className="text-zinc-300">{bottleneck.value.toFixed(1)}</span></span>
          <span>Baseline: <span className="text-zinc-400">{bottleneck.baseline.toFixed(1)}</span></span>
          {bottleneck.contributors_involved.length > 0 && (
            <span>
              {bottleneck.contributors_involved.map(c => `@${c}`).join(', ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BottlenecksPageContent() {
  const searchParams = useSearchParams();
  const repoId = searchParams.get('repo');
  const { data, loading, error } = useRepoDashboard(repoId);
  const { scores } = useScores(repoId, 13);

  if (!repoId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-zinc-400">Select a repo to view bottleneck analysis.</p>
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
    return <div className="text-center py-12 text-rose-400 text-sm">{error}</div>;
  }

  const bottlenecks = data?.latest_bottlenecks ?? [];
  const criticalCount = bottlenecks.filter(b => b.severity === 'critical').length;
  const warningCount = bottlenecks.filter(b => b.severity === 'warning').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Bottleneck Analysis</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Automatically detected patterns that are slowing down your engineering process
        </p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md" className="text-center">
          <div className={`text-3xl font-bold ${bottlenecks.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {bottlenecks.length}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Active bottlenecks</div>
        </Card>
        <Card padding="md" className="text-center">
          <div className={`text-3xl font-bold ${criticalCount > 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
            {criticalCount}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Critical severity</div>
        </Card>
        <Card padding="md" className="text-center">
          <div className={`text-3xl font-bold ${warningCount > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
            {warningCount}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Warning severity</div>
        </Card>
      </div>

      {/* PR Lifecycle Chart */}
      <Card padding="md">
        <div className="mb-4">
          <h2 className="font-semibold text-zinc-50">PR Lifecycle — Time Distribution</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Median hours from open → first review → approved → merged (last 13 weeks)
          </p>
        </div>
        <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            Time to first review
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-indigo-500" />
            Time to merge (after review)
          </div>
        </div>
        <BottleneckChart scores={scores} height={240} />
      </Card>

      {/* Bottleneck List */}
      <Card padding="md">
        <h2 className="font-semibold text-zinc-50 mb-4">Detected Bottlenecks</h2>
        {bottlenecks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-300">No bottlenecks detected</p>
            <p className="text-xs text-zinc-500 mt-0.5">Your team&apos;s PR process looks healthy this week.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bottlenecks
              .sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1))
              .map((b, i) => (
                <BottleneckCard key={i} bottleneck={b} />
              ))}
          </div>
        )}
      </Card>

      {/* Explanation */}
      <Card padding="md" className="bg-zinc-900/50">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">How bottleneck detection works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-400">
          {[
            { type: 'Review Concentration', desc: 'When one reviewer handles >70% of all reviews — single point of failure.' },
            { type: 'Author Concentration', desc: 'When one author opens >60% of all PRs — bus factor risk.' },
            { type: 'Slow Lane', desc: "When specific authors' PRs consistently take >2x longer to merge than team average." },
            { type: 'Large PR Pattern', desc: 'When an author consistently opens PRs >600 lines — hard to review thoroughly.' },
            { type: 'Stale PR Author', desc: "When an author's PRs repeatedly go stale (7+ days without activity)." },
          ].map((item) => (
            <div key={item.type} className="flex gap-2">
              <div className="w-1 h-1 rounded-full bg-zinc-600 mt-1.5 shrink-0" />
              <div>
                <span className="text-zinc-300 font-medium">{item.type}: </span>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function BottlenecksPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    }>
      <BottlenecksPageContent />
    </Suspense>
  );
}
