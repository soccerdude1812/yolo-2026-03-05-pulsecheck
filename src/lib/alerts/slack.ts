// src/lib/alerts/slack.ts
// Slack webhook delivery for PulseCheck alerts.
// NON-BLOCKING: returns success/failure, never throws.
// SECURITY: NEVER logs the webhook URL (MF-8).

import type { AlertTrigger } from './check-triggers';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SlackDeliveryResult {
  success: boolean;
  error?: string;
}

// Slack Block Kit types (minimal — only what we use)
interface SlackBlockElement {
  type: string;
  text?: { type: string; text: string };
  url?: string;
  style?: string;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  fields?: Array<{ type: string; text: string }>;
  elements?: SlackBlockElement[];
}

interface SlackMessage {
  text: string;
  blocks: SlackBlock[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// MF-8: Validate format before sending — must match Slack's standard webhook pattern
const SLACK_WEBHOOK_REGEX = /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+$/;

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a Slack webhook URL format.
 * Returns true if valid, false otherwise.
 * NEVER call this with logging of the URL itself.
 */
export function isValidSlackWebhook(url: string): boolean {
  return SLACK_WEBHOOK_REGEX.test(url);
}

/**
 * Returns a masked version of the webhook URL safe for display.
 * e.g. "hooks.slack.com/services/.../XYZ" (last 8 chars of token)
 */
export function maskWebhookUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/');
    const token = parts[parts.length - 1] ?? '';
    const maskedToken = token.length > 8
      ? `...${token.slice(-8)}`
      : `...${token}`;
    return `hooks.slack.com/services/.../${maskedToken}`;
  } catch {
    return 'hooks.slack.com/services/...[invalid]';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE FORMATTERS
// ─────────────────────────────────────────────────────────────────────────────

function buildScoreDropMessage(
  repoName: string,
  trigger: AlertTrigger,
  dashboardUrl: string
): SlackMessage {
  const { score_from, score_to, drop, weeks_consecutive } = trigger.payload as {
    score_from: number;
    score_to: number;
    drop: number;
    weeks_consecutive: number;
    week_start: string;
  };

  const emoji = drop >= 20 ? ':rotating_light:' : ':warning:';

  return {
    text: `${emoji} PulseCheck Alert: Score drop in *${repoName}*`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Health Score Alert — ${repoName}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Score dropped ${drop} points over ${weeks_consecutive} consecutive week${weeks_consecutive !== 1 ? 's' : ''}.*\n${score_from} → ${score_to}`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Dashboard' },
            url: dashboardUrl,
            style: 'primary',
          },
        ],
      },
    ],
  };
}

function buildSilentContributorMessage(
  repoName: string,
  trigger: AlertTrigger,
  dashboardUrl: string
): SlackMessage {
  const { contributors, weeks_threshold } = trigger.payload as {
    contributors: string[];
    weeks_threshold: number;
    week_start: string;
  };

  const names = contributors.map((c) => `*${c}*`).join(', ');

  return {
    text: `:zzz: PulseCheck: ${contributors.length} contributor(s) silent in *${repoName}*`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:zzz: Silent Contributor Alert — ${repoName}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${names} ${contributors.length === 1 ? 'has' : 'have'} had no PRs or reviews for *${weeks_threshold}+ weeks*.\n\nConsider checking in to ensure they're unblocked.`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Contributors' },
            url: dashboardUrl,
          },
        ],
      },
    ],
  };
}

function buildBottleneckSpikeMessage(
  repoName: string,
  trigger: AlertTrigger,
  dashboardUrl: string
): SlackMessage {
  const { current_ttfr_hrs, baseline_ttfr_hrs, multiplier } = trigger.payload as {
    current_ttfr_hrs: number;
    baseline_ttfr_hrs: number;
    multiplier: string;
    week_start: string;
  };

  return {
    text: `:hourglass_flowing_sand: PulseCheck: Review bottleneck in *${repoName}*`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:hourglass_flowing_sand: Review Bottleneck Alert — ${repoName}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Current TTFR*\n${current_ttfr_hrs.toFixed(1)} hours`,
          },
          {
            type: 'mrkdwn',
            text: `*Baseline TTFR*\n${baseline_ttfr_hrs.toFixed(1)} hours`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Median time-to-first-review is *${multiplier}x* the normal baseline — PRs are sitting longer than usual. This may indicate review bandwidth is constrained.`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Dashboard' },
            url: dashboardUrl,
          },
        ],
      },
    ],
  };
}

function buildTestMessage(repoName: string): SlackMessage {
  return {
    text: ':white_check_mark: PulseCheck Slack integration is working!',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':white_check_mark: PulseCheck Test Alert',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Your Slack webhook is connected and working correctly for *${repoName || 'your repos'}*.\n\nReal alerts will appear here when health thresholds are breached.`,
        },
      },
    ],
  };
}

function buildMessage(
  repoName: string,
  trigger: AlertTrigger,
  dashboardUrl: string
): SlackMessage {
  switch (trigger.type) {
    case 'score_drop':
      return buildScoreDropMessage(repoName, trigger, dashboardUrl);
    case 'contributor_silent':
      return buildSilentContributorMessage(repoName, trigger, dashboardUrl);
    case 'bottleneck_spike':
      return buildBottleneckSpikeMessage(repoName, trigger, dashboardUrl);
    default:
      return {
        text: `:bell: PulseCheck Alert for *${repoName}*`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:bell: New alert detected for *${repoName}*. Visit your dashboard for details.`,
            },
          },
        ],
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends an alert to a Slack webhook.
 * NON-BLOCKING: always returns success/failure, never throws.
 * SECURITY: Never logs the webhook URL.
 */
export async function sendSlackAlert(
  webhookUrl: string,
  repoName: string,
  trigger: AlertTrigger,
  dashboardUrl: string
): Promise<SlackDeliveryResult> {
  try {
    // Validate format before making any network call (MF-8)
    if (!isValidSlackWebhook(webhookUrl)) {
      return { success: false, error: 'Invalid Slack webhook URL format' };
    }

    const message = buildMessage(repoName, trigger, dashboardUrl);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        error: `Slack returned ${response.status}: ${body}`,
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error delivering Slack alert',
    };
  }
}

/**
 * Sends a test message to confirm the webhook is working.
 * NON-BLOCKING: always returns success/failure, never throws.
 * SECURITY: Never logs the webhook URL.
 */
export async function sendSlackTestMessage(
  webhookUrl: string,
  repoName?: string
): Promise<SlackDeliveryResult> {
  try {
    if (!isValidSlackWebhook(webhookUrl)) {
      return { success: false, error: 'Invalid Slack webhook URL format' };
    }

    const message = buildTestMessage(repoName ?? '');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        error: `Slack returned ${response.status}: ${body}`,
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error sending test message',
    };
  }
}
