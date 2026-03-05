// src/lib/github/rate-limit.ts
// Rate limit utilities — track remaining calls and throw RateLimitError when too low.

import 'server-only';

import { RateLimitError } from '@/lib/sync/errors';

const RATE_LIMIT_ABORT_THRESHOLD = 100;

/**
 * Check the X-RateLimit-Remaining header value.
 * Throws RateLimitError if at or below the abort threshold.
 */
export function checkRateLimit(remaining: number): void {
  if (remaining < RATE_LIMIT_ABORT_THRESHOLD) {
    throw new RateLimitError(remaining);
  }
}

/**
 * Parse X-RateLimit-Remaining from a Response header.
 * Returns the number of remaining calls, defaults to 5000 if header is missing.
 */
export function parseRateLimitRemaining(headers: Headers): number {
  const val = headers.get('X-RateLimit-Remaining');
  if (!val) return 5000;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? 5000 : parsed;
}

/**
 * Parse X-RateLimit-Reset from a Response header.
 * Returns the Unix timestamp when the rate limit resets.
 */
export function parseRateLimitReset(headers: Headers): number {
  const val = headers.get('X-RateLimit-Reset');
  if (!val) return 0;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? 0 : parsed;
}
