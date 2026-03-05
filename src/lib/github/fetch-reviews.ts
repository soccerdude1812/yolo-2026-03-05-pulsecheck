// src/lib/github/fetch-reviews.ts
// Fetch reviews for a single PR from GitHub REST API.
// Caps at SYNC_TIMING.reviewsPerPrCap (100) reviews per PR.

import 'server-only';

import { githubRequest } from './client';
import { SYNC_TIMING } from '@/lib/scoring/config';
import { RateLimitError } from '@/lib/sync/errors';
import type { GitHubReview } from '@/types/index';

export interface FetchReviewsOptions {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
}

export interface FetchReviewsResult {
  reviews: GitHubReview[];
  rateLimitRemaining: number;
}

/**
 * Fetch reviews for a single PR.
 * Fetches 1 page (100 reviews max) per SYNC_TIMING.reviewsPerPrCap.
 * Reviews are returned in chronological order (oldest first from GitHub).
 */
export async function fetchReviewsForPR(
  options: FetchReviewsOptions
): Promise<FetchReviewsResult> {
  const { token, owner, repo, prNumber } = options;

  const params = new URLSearchParams({
    per_page: String(SYNC_TIMING.reviewsPerPrCap),
    page: '1',
  });

  try {
    const result = await githubRequest<GitHubReview[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews?${params.toString()}`,
      { token }
    );

    return {
      reviews: result.data,
      rateLimitRemaining: result.rateLimitRemaining,
    };
  } catch (err) {
    if (err instanceof RateLimitError) {
      throw err;
    }
    // For individual PR review failures, return empty (not all PRs are accessible)
    return { reviews: [], rateLimitRemaining: 5000 };
  }
}

/**
 * Batch fetch reviews for multiple PRs.
 * Respects rate limit — throws RateLimitError if limit reached.
 * Returns a Map<prNumber, reviews[]>
 */
export async function fetchReviewsForPRs(
  token: string,
  owner: string,
  repo: string,
  prNumbers: number[],
  isOverBudget?: () => boolean
): Promise<Map<number, GitHubReview[]>> {
  const reviewMap = new Map<number, GitHubReview[]>();

  for (const prNumber of prNumbers) {
    if (isOverBudget?.()) {
      break;
    }

    const result = await fetchReviewsForPR({ token, owner, repo, prNumber });
    reviewMap.set(prNumber, result.reviews);
  }

  return reviewMap;
}
