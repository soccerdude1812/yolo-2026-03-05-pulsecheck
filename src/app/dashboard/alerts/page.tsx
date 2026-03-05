'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useUserProfile } from '@/hooks/useUserProfile';
import { canUseFeature } from '@/lib/utils/plan';
import type { AlertLog } from '@/types/index';

export const dynamic = 'force-dynamic';

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('default', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function alertTypeLabel(type: string): string {
  switch (type) {
    case 'score_drop': return 'Score Drop';
    case 'contributor_silent': return 'Contributor Silent';
    case 'bottleneck_spike': return 'Bottleneck Spike';
    default: return type;
  }
}

export default function AlertsPage() {
  const searchParams = useSearchParams();
  const repoId = searchParams.get('repo');
  const { profile } = useUserProfile();
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const plan = profile?.plan ?? 'free';
  const hasAlerts = canUseFeature(plan, 'slack_alerts') || canUseFeature(plan, 'email_alerts');

  useEffect(() => {
    if (!repoId) { setLoading(false); return; }
    const fetchAlerts = async () => {
      try {
        const text = await fetch(`/api/alerts?repo_id=${repoId}`).then(r => r.text());
        const json = JSON.parse(text) as { data: AlertLog[] | null; error: string | null };
        if (json.error) setError(json.error);
        else setAlerts(json.data ?? []);
      } catch {
        setError('Failed to load alerts');
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, [repoId]);

  if (!repoId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-zinc-400">Select a repo to view alerts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Alerts</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Alert history for this repo
          </p>
        </div>
        {!hasAlerts && (
          <a
            href="/#pricing"
            className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Upgrade for Slack + email alerts →
          </a>
        )}
      </div>

      {/* Plan gate notice */}
      {!hasAlerts && (
        <Card padding="md" className="border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-zinc-50">Get alerts with Pro</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Receive automatic Slack messages and emails when your health score drops, contributors go silent, or bottlenecks spike.
              </p>
              <a href="/#pricing" className="inline-flex items-center gap-1 mt-3 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                Upgrade to Pro →
              </a>
            </div>
          </div>
        </Card>
      )}

      {/* Alert history */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="font-semibold text-zinc-50">Alert History</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-rose-400 text-sm">{error}</div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-400">No alerts yet</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {hasAlerts ? 'Alerts fire when your score drops significantly or contributors go silent.' : 'Upgrade to Pro to enable automatic alerts.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {alerts.map((alert) => (
              <div key={alert.id} className="px-5 py-4 flex items-start gap-4">
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                  alert.alert_type === 'score_drop' ? 'bg-rose-400' :
                  alert.alert_type === 'bottleneck_spike' ? 'bg-amber-400' : 'bg-blue-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-zinc-200">{alertTypeLabel(alert.alert_type)}</span>
                    <Badge variant={alert.sent_slack ? 'emerald' : 'default'}>
                      {alert.sent_slack ? 'Slack sent' : 'No Slack'}
                    </Badge>
                    <Badge variant={alert.sent_email ? 'emerald' : 'default'}>
                      {alert.sent_email ? 'Email sent' : 'No email'}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{formatDate(alert.created_at)}</p>
                  {alert.payload && Object.keys(alert.payload).length > 0 && (
                    <div className="mt-2 text-xs text-zinc-400 bg-zinc-800/50 rounded-lg p-2 font-mono">
                      {JSON.stringify(alert.payload, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
