// src/lib/alerts/email.ts
// Email delivery via Resend for PulseCheck alerts.
// NON-BLOCKING: returns success/failure, never throws.
// Uses Resend free tier (3000 emails/month).

import { Resend } from 'resend';
import { env } from '@/lib/utils/env';
import type { AlertTrigger } from './check-triggers';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailDeliveryResult {
  success: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

function baseTemplate(title: string, bodyHtml: string, dashboardUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
    .header { background: #0f172a; padding: 24px 32px; }
    .header-logo { color: #fff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .header-logo span { color: #6366f1; }
    .content { padding: 32px; }
    .alert-title { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px; }
    .alert-subtitle { font-size: 15px; color: #6b7280; margin: 0 0 24px; }
    .metric-row { display: flex; gap: 16px; margin: 16px 0; }
    .metric-box { flex: 1; background: #f3f4f6; border-radius: 8px; padding: 16px; }
    .metric-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin: 0 0 4px; }
    .metric-value { font-size: 28px; font-weight: 700; color: #111827; margin: 0; }
    .metric-value.negative { color: #dc2626; }
    .body-text { font-size: 15px; color: #374151; line-height: 1.6; margin: 16px 0; }
    .cta-btn { display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 8px 0; }
    .footer { background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb; }
    .footer-text { font-size: 12px; color: #9ca3af; margin: 0; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">Pulse<span>Check</span></div>
    </div>
    <div class="content">
      ${bodyHtml}
      <hr class="divider" />
      <a href="${dashboardUrl}" class="cta-btn">View Full Dashboard</a>
    </div>
    <div class="footer">
      <p class="footer-text">You're receiving this because you've enabled email alerts for this repository. Manage preferences in your <a href="${dashboardUrl}/settings" style="color:#6366f1;">account settings</a>.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function buildScoreDropHtml(repoName: string, trigger: AlertTrigger, dashboardUrl: string): { subject: string; html: string } {
  const { score_from, score_to, drop, weeks_consecutive } = trigger.payload as {
    score_from: number;
    score_to: number;
    drop: number;
    weeks_consecutive: number;
    week_start: string;
  };

  const subject = `⚠️ PulseCheck: Health score dropped ${drop} pts in ${repoName}`;
  const body = `
    <p class="alert-title">Health Score Alert</p>
    <p class="alert-subtitle">${repoName}</p>
    <div class="metric-row">
      <div class="metric-box">
        <p class="metric-label">Previous Score</p>
        <p class="metric-value">${score_from}</p>
      </div>
      <div class="metric-box">
        <p class="metric-label">Current Score</p>
        <p class="metric-value negative">${score_to}</p>
      </div>
      <div class="metric-box">
        <p class="metric-label">Drop</p>
        <p class="metric-value negative">−${drop}</p>
      </div>
    </div>
    <p class="body-text">
      Your repository's health score has dropped <strong>${drop} points</strong> over
      <strong>${weeks_consecutive} consecutive week${weeks_consecutive !== 1 ? 's' : ''}</strong>.
      Visit your dashboard to see the detailed breakdown and identify what's causing the decline.
    </p>
  `;

  return { subject, html: baseTemplate(subject, body, dashboardUrl) };
}

function buildSilentContributorHtml(repoName: string, trigger: AlertTrigger, dashboardUrl: string): { subject: string; html: string } {
  const { contributors, weeks_threshold } = trigger.payload as {
    contributors: string[];
    weeks_threshold: number;
    week_start: string;
  };

  const nameList = contributors.map((c) => `<strong>${c}</strong>`).join(', ');
  const subject = `😴 PulseCheck: ${contributors.length} contributor(s) silent in ${repoName}`;
  const body = `
    <p class="alert-title">Silent Contributor Alert</p>
    <p class="alert-subtitle">${repoName}</p>
    <p class="body-text">
      ${nameList} ${contributors.length === 1 ? 'has' : 'have'} not opened any PRs or submitted
      any reviews for <strong>${weeks_threshold}+ weeks</strong>.
      This may indicate they're blocked, overloaded with other work, or have left the team.
    </p>
    <p class="body-text">
      Consider reaching out directly to check in, or reviewing your team's workload distribution.
    </p>
  `;

  return { subject, html: baseTemplate(subject, body, dashboardUrl) };
}

function buildBottleneckSpikeHtml(repoName: string, trigger: AlertTrigger, dashboardUrl: string): { subject: string; html: string } {
  const { current_ttfr_hrs, baseline_ttfr_hrs, multiplier } = trigger.payload as {
    current_ttfr_hrs: number;
    baseline_ttfr_hrs: number;
    multiplier: string;
    week_start: string;
  };

  const subject = `⏳ PulseCheck: Review bottleneck detected in ${repoName}`;
  const body = `
    <p class="alert-title">Review Bottleneck Alert</p>
    <p class="alert-subtitle">${repoName}</p>
    <div class="metric-row">
      <div class="metric-box">
        <p class="metric-label">Current TTFR</p>
        <p class="metric-value negative">${current_ttfr_hrs.toFixed(1)}h</p>
      </div>
      <div class="metric-box">
        <p class="metric-label">Baseline TTFR</p>
        <p class="metric-value">${baseline_ttfr_hrs.toFixed(1)}h</p>
      </div>
      <div class="metric-box">
        <p class="metric-label">Spike</p>
        <p class="metric-value negative">${multiplier}×</p>
      </div>
    </div>
    <p class="body-text">
      Median time-to-first-review is <strong>${multiplier}× the normal baseline</strong>.
      PRs are sitting without reviews for much longer than usual, which indicates a potential
      review bandwidth constraint or bottleneck in your team's workflow.
    </p>
  `;

  return { subject, html: baseTemplate(subject, body, dashboardUrl) };
}

function buildEmailContent(
  repoName: string,
  trigger: AlertTrigger,
  dashboardUrl: string
): { subject: string; html: string } {
  switch (trigger.type) {
    case 'score_drop':
      return buildScoreDropHtml(repoName, trigger, dashboardUrl);
    case 'contributor_silent':
      return buildSilentContributorHtml(repoName, trigger, dashboardUrl);
    case 'bottleneck_spike':
      return buildBottleneckSpikeHtml(repoName, trigger, dashboardUrl);
    default:
      return {
        subject: `PulseCheck Alert for ${repoName}`,
        html: baseTemplate(
          `PulseCheck Alert — ${repoName}`,
          `<p class="body-text">A new alert has been triggered for <strong>${repoName}</strong>. Visit your dashboard for details.</p>`,
          dashboardUrl
        ),
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends an alert email via Resend.
 * NON-BLOCKING: always returns success/failure, never throws.
 * Gracefully returns failure if RESEND_API_KEY is not configured.
 */
export async function sendEmailAlert(
  toEmail: string,
  repoName: string,
  trigger: AlertTrigger,
  dashboardUrl: string
): Promise<EmailDeliveryResult> {
  try {
    if (!env.resendApiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    const fromEmail = env.resendFromEmail ?? 'alerts@pulsecheck.dev';
    const { subject, html } = buildEmailContent(repoName, trigger, dashboardUrl);

    const resend = new Resend(env.resendApiKey);
    const { error } = await resend.emails.send({
      from: `PulseCheck <${fromEmail}>`,
      to: toEmail,
      subject,
      html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error delivering email alert',
    };
  }
}
