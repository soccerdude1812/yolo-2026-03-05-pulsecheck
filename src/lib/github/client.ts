// src/lib/github/client.ts
// GitHub REST API client — server-only.
// Uses provider_token from Supabase session for authenticated requests.
// Never returns or logs the token.

import 'server-only';

import { RateLimitError, GitHubFetchError } from '@/lib/sync/errors';

export interface GitHubRequestOptions {
  token: string;
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
}

const GITHUB_API_BASE = 'https://api.github.com';
const RATE_LIMIT_ABORT_THRESHOLD = 100;  // abort if fewer than 100 calls remaining

/**
 * Make an authenticated request to the GitHub REST API.
 * Checks X-RateLimit-Remaining header and throws RateLimitError if < 100.
 * Per lesson: encode each path segment individually, never full path.
 */
export async function githubRequest<T>(
  path: string,
  options: GitHubRequestOptions
): Promise<{ data: T; rateLimitRemaining: number }> {
  const { token, method = 'GET', body } = options;

  // Encode each segment separately to preserve real '/' separators (lessons.md fix)
  const encodedPath = path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  const url = `${GITHUB_API_BASE}${encodedPath}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  // Check rate limit from response headers
  const rateLimitRemaining = parseInt(
    response.headers.get('X-RateLimit-Remaining') ?? '5000',
    10
  );

  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new RateLimitError(rateLimitRemaining);
    }
    throw new GitHubFetchError(
      `GitHub API error ${response.status} for ${path}`,
      response.status
    );
  }

  // After receiving response, throw if rate limit is critically low
  if (rateLimitRemaining < RATE_LIMIT_ABORT_THRESHOLD) {
    throw new RateLimitError(rateLimitRemaining);
  }

  const data = (await response.json()) as T;
  return { data, rateLimitRemaining };
}

/**
 * Build a paginated URL from base path + query params.
 * Handles appending page/per_page to existing query strings.
 */
export function buildPaginatedUrl(
  basePath: string,
  page: number,
  perPage: number,
  extraParams: Record<string, string> = {}
): string {
  const params = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
    ...extraParams,
  });
  return `${basePath}?${params.toString()}`;
}
