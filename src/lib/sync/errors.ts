// src/lib/sync/errors.ts
// Custom error classes for the sync pipeline.
// All sync errors use these — never throw raw Error().
// Error handling rules per APPROVED.md MF-10:
//   RateLimitError   → abort sync, set status='error', non-retryable
//   UpsertError      → abort sync, set status='error', log step
//   AlertError       → NON-BLOCKING: log failure, do not fail sync, still attempt email
//   SyncTimeoutError → set status='partial', return partial SyncResult

export class SyncTimeoutError extends Error {
  readonly code = 'SYNC_TIMEOUT' as const;

  constructor(message: string) {
    super(message);
    this.name = 'SyncTimeoutError';
  }
}

export class RateLimitError extends Error {
  readonly code = 'RATE_LIMITED' as const;
  readonly remaining: number;

  constructor(remaining: number) {
    super(`GitHub API rate limit reached: ${remaining} calls remaining`);
    this.name = 'RateLimitError';
    this.remaining = remaining;
  }
}

export class UpsertError extends Error {
  readonly code = 'UPSERT_FAILED' as const;
  readonly step: string;

  constructor(step: string, cause?: unknown) {
    super(`Upsert failed at step: ${step}`);
    this.name = 'UpsertError';
    this.step = step;
    this.cause = cause;
  }
}

export class AlertError extends Error {
  readonly code = 'ALERT_FAILED' as const;
  readonly channel: 'slack' | 'email';

  constructor(channel: 'slack' | 'email', cause?: unknown) {
    super(`Alert delivery failed on ${channel}`);
    this.name = 'AlertError';
    this.channel = channel;
    this.cause = cause;
  }
}

export class GitHubFetchError extends Error {
  readonly code = 'GITHUB_FETCH_FAILED' as const;
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'GitHubFetchError';
    this.statusCode = statusCode;
  }
}

// Type guard helpers
export function isSyncTimeoutError(err: unknown): err is SyncTimeoutError {
  return err instanceof SyncTimeoutError;
}

export function isRateLimitError(err: unknown): err is RateLimitError {
  return err instanceof RateLimitError;
}

export function isUpsertError(err: unknown): err is UpsertError {
  return err instanceof UpsertError;
}

export function isAlertError(err: unknown): err is AlertError {
  return err instanceof AlertError;
}
