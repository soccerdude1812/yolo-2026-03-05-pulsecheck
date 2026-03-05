'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import type { WeeklyHealthScore, UserProfile } from '@/types/index';
import { isNarrativeQuotaExhausted } from '@/lib/utils/plan';

interface NarrativeDigestProps {
  latestScore: WeeklyHealthScore | null;
  repoId: string | null;
  profile: UserProfile | null;
  onNarrativeGenerated?: (narrative: string) => void;
}

export function NarrativeDigest({ latestScore, repoId, profile, onNarrativeGenerated }: NarrativeDigestProps) {
  const [generating, setGenerating] = useState(false);
  const [localNarrative, setLocalNarrative] = useState<string | null>(null);
  const { addToast } = useToast();

  const plan = profile?.plan ?? 'free';
  const quotaExhausted = isNarrativeQuotaExhausted(
    plan,
    profile?.narrative_month ?? null,
    profile?.narrative_count ?? 0
  );

  const narrative = localNarrative ?? latestScore?.narrative_digest ?? null;
  const isUnlimited = plan === 'pro' || plan === 'team';

  // Compute next reset date for free users
  const nextReset = (() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toLocaleDateString('default', { month: 'long', day: 'numeric' });
  })();

  const handleGenerate = async () => {
    if (!repoId || !latestScore) return;
    setGenerating(true);
    try {
      const text = await fetch('/api/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_id: repoId,
          week_start: latestScore.week_start,
          force_regenerate: isUnlimited,
        }),
      }).then((r) => r.text());

      const json = JSON.parse(text) as { data: { narrative: string; quota_remaining: number | null } | null; error: string | null };

      if (json.error) {
        if (json.error === 'MONTHLY_LIMIT_REACHED') {
          addToast({
            type: 'warning',
            title: 'Monthly limit reached',
            description: `You've used your 1 free narrative this month. Resets on ${nextReset}.`,
          });
        } else {
          addToast({ type: 'error', title: 'Failed to generate narrative', description: json.error });
        }
      } else if (json.data) {
        setLocalNarrative(json.data.narrative);
        onNarrativeGenerated?.(json.data.narrative);
        addToast({ type: 'success', title: 'AI narrative generated' });
      }
    } catch {
      addToast({ type: 'error', title: 'Failed to generate narrative', description: 'Network error. Please try again.' });
    } finally {
      setGenerating(false);
    }
  };

  // State: no score data yet
  if (!latestScore) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="font-semibold text-zinc-50">AI Narrative Digest</h3>
        </div>
        <p className="text-sm text-zinc-500">Sync your repo to generate your first AI narrative.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="font-semibold text-zinc-50">AI Narrative Digest</h3>
          {plan === 'free' && !quotaExhausted && !narrative && (
            <Badge variant="emerald" className="text-[10px]">1 remaining this month</Badge>
          )}
          {isUnlimited && (
            <Badge variant="plan-pro" className="text-[10px]">Unlimited</Badge>
          )}
        </div>

        {/* Action button */}
        {narrative ? (
          isUnlimited ? (
            <Button variant="ghost" size="sm" onClick={handleGenerate} loading={generating}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate
            </Button>
          ) : null
        ) : null}
      </div>

      {/* Content area */}
      {narrative ? (
        <div className="prose prose-invert prose-sm max-w-none">
          <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{narrative}</p>
          {latestScore.narrative_generated_at && (
            <p className="text-xs text-zinc-600 mt-3">
              Generated {new Date(latestScore.narrative_generated_at).toLocaleDateString()}
              {latestScore.narrative_model && ` · ${latestScore.narrative_model}`}
            </p>
          )}
        </div>
      ) : quotaExhausted ? (
        /* Free user — quota exhausted */
        <div className="flex flex-col items-start gap-3">
          <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 w-full">
            <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-9V9m0 0V7m0 2h2m-2 0H10" />
            </svg>
            <div>
              <p className="text-sm text-amber-300 font-medium">Monthly limit reached</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {"You've used your 1 free AI narrative this month. Resets on "}
                <span className="text-zinc-300">{nextReset}</span>.
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Upgrade to Pro for unlimited AI narratives — every week, automatically.
          </p>
          <Button variant="primary" size="sm" onClick={() => window.location.href = 'mailto:hello@pulsecheck.dev?subject=PulseCheck%20Pro%20Upgrade&body=Hi%2C%20I%27d%20like%20to%20upgrade%20to%20Pro.'}>
            Upgrade to Pro
          </Button>
        </div>
      ) : (
        /* Not generated yet — show generate button */
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-zinc-400 leading-relaxed">
            Get a plain-English AI summary of what changed in your engineering process this week — review velocity trends, contributor patterns, and what to watch out for.
          </p>
          {plan === 'free' && (
            <p className="text-xs text-zinc-500">
              Free users get 1 AI narrative per month. Pro users get unlimited.
            </p>
          )}
          <Button variant="primary" size="sm" onClick={handleGenerate} loading={generating}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generate AI Narrative
          </Button>
        </div>
      )}
    </div>
  );
}
