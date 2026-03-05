'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useUserProfile } from '@/hooks/useUserProfile';
import { canUseFeature } from '@/lib/utils/plan';

export const dynamic = 'force-dynamic';

// Slack webhook URL regex (from MF-8)
const SLACK_WEBHOOK_REGEX = /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+$/;

export default function SettingsPage() {
  const { profile, refetch: refetchProfile } = useUserProfile();
  const { addToast } = useToast();

  const [slackWebhook, setSlackWebhook] = useState('');
  const [slackSaving, setSlackSaving] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [scoreDrop, setScoreDrop] = useState(10);
  const [consecutiveWeeks, setConsecutiveWeeks] = useState(2);
  const [alertSaving, setAlertSaving] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);

  const plan = profile?.plan ?? 'free';
  const hasSlack = canUseFeature(plan, 'slack_alerts');
  const hasEmail = canUseFeature(plan, 'email_alerts');

  // Load current settings
  useEffect(() => {
    void (async () => {
      try {
        const text = await fetch('/api/settings').then(r => r.text());
        const json = JSON.parse(text) as {
          data: { resend_email: string | null } | null;
          error: string | null;
        };
        if (json.data?.resend_email) {
          setAlertEmail(json.data.resend_email);
          setEmailAlerts(true);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const handleSaveSlack = async () => {
    setSlackError(null);
    if (slackWebhook && !SLACK_WEBHOOK_REGEX.test(slackWebhook)) {
      setSlackError('Invalid Slack webhook URL. Must start with https://hooks.slack.com/services/...');
      return;
    }
    setSlackSaving(true);
    try {
      const text = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slack_webhook_url: slackWebhook || null }),
      }).then(r => r.text());
      const json = JSON.parse(text) as { error: string | null };
      if (json.error === 'INVALID_SLACK_WEBHOOK_FORMAT') {
        setSlackError('Invalid Slack webhook URL format.');
      } else if (json.error) {
        addToast({ type: 'error', title: 'Failed to save Slack webhook', description: json.error });
      } else {
        addToast({ type: 'success', title: 'Slack webhook saved' });
        setSlackWebhook('');
        refetchProfile();
      }
    } catch {
      addToast({ type: 'error', title: 'Failed to save', description: 'Network error' });
    } finally {
      setSlackSaving(false);
    }
  };

  const handleSaveAlertConfig = async () => {
    setAlertSaving(true);
    try {
      const text = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resend_email: emailAlerts ? alertEmail : null,
        }),
      }).then(r => r.text());
      const json = JSON.parse(text) as { error: string | null };
      if (json.error) {
        addToast({ type: 'error', title: 'Failed to save alert settings', description: json.error });
      } else {
        addToast({ type: 'success', title: 'Alert settings saved' });
      }
    } catch {
      addToast({ type: 'error', title: 'Failed to save', description: 'Network error' });
    } finally {
      setAlertSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">Manage your account and alert preferences</p>
      </div>

      {/* Current Plan */}
      <Card padding="md">
        <h2 className="font-semibold text-zinc-50 mb-4">Your Plan</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={`plan-${plan}`} className="capitalize text-sm px-3 py-1">{plan}</Badge>
            <div>
              <p className="text-sm text-zinc-300">
                {plan === 'free' && 'Free — 1 repo, 4 weeks history, 1 AI narrative/month'}
                {plan === 'pro' && 'Pro — 5 repos, 26 weeks history, unlimited AI narratives'}
                {plan === 'team' && 'Team — Unlimited repos, 52 weeks history, CSV export'}
              </p>
            </div>
          </div>
          {plan === 'free' && (
            <a
              href="/#pricing"
              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              Upgrade →
            </a>
          )}
        </div>
      </Card>

      {/* Slack Alerts */}
      <Card padding="md">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-zinc-50">Slack Alerts</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Receive a Slack message when your health score drops significantly
            </p>
          </div>
          {!hasSlack && <Badge variant="amber">Pro feature</Badge>}
        </div>

        {hasSlack ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Slack Incoming Webhook URL
              </label>
              <input
                type="url"
                value={slackWebhook}
                onChange={(e) => { setSlackWebhook(e.target.value); setSlackError(null); }}
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                className="w-full bg-zinc-800 text-zinc-200 placeholder-zinc-600 text-sm px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {slackError && <p className="text-xs text-rose-400 mt-1">{slackError}</p>}
              <p className="text-xs text-zinc-500 mt-1">
                {profile?.slack_webhook_url
                  ? 'Webhook is configured. Enter a new URL to update it.'
                  : 'Enter your Slack incoming webhook URL to enable Slack alerts.'}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveSlack}
              loading={slackSaving}
              disabled={!slackWebhook}
            >
              Save Webhook
            </Button>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">
            Upgrade to Pro to enable Slack alerts.{' '}
            <a href="/#pricing" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              View plans →
            </a>
          </div>
        )}
      </Card>

      {/* Email Alerts */}
      <Card padding="md">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-zinc-50">Email Alerts</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Get an email when your engineering health score drops
            </p>
          </div>
          {!hasEmail && <Badge variant="amber">Pro feature</Badge>}
        </div>

        {hasEmail ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEmailAlerts(v => !v)}
                className={`relative w-10 h-6 rounded-full transition-colors ${emailAlerts ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                role="switch"
                aria-checked={emailAlerts}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${emailAlerts ? 'translate-x-4' : ''}`}
                />
              </button>
              <label className="text-sm text-zinc-300">Enable email alerts</label>
            </div>

            {emailAlerts && (
              <>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Alert email address
                  </label>
                  <input
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="you@yourcompany.com"
                    className="w-full bg-zinc-800 text-zinc-200 placeholder-zinc-600 text-sm px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Score drop threshold (points)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={scoreDrop}
                      onChange={(e) => setScoreDrop(Number(e.target.value))}
                      className="w-full bg-zinc-800 text-zinc-200 text-sm px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <p className="text-xs text-zinc-600 mt-0.5">Alert when score drops by this much</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Consecutive weeks required
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={consecutiveWeeks}
                      onChange={(e) => setConsecutiveWeeks(Number(e.target.value))}
                      className="w-full bg-zinc-800 text-zinc-200 text-sm px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <p className="text-xs text-zinc-600 mt-0.5">Require N consecutive weeks of drop</p>
                  </div>
                </div>
              </>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveAlertConfig}
              loading={alertSaving}
            >
              Save Alert Settings
            </Button>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">
            Upgrade to Pro to enable email alerts.{' '}
            <a href="/#pricing" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              View plans →
            </a>
          </div>
        )}
      </Card>

      {/* Account */}
      <Card padding="md">
        <h2 className="font-semibold text-zinc-50 mb-4">Account</h2>
        {profile && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {profile.github_avatar_url ? (
                <img src={profile.github_avatar_url} alt={profile.github_username} className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                  <span className="text-zinc-400 font-medium">{profile.github_username[0]?.toUpperCase()}</span>
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-zinc-200">@{profile.github_username}</div>
                <div className="text-xs text-zinc-500">Connected via GitHub OAuth</div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
