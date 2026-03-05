// src/lib/github/fetch-prs.ts
// Fetch all PRs for a repo from GitHub REST API.
// Supports incremental fetching via sync_cursor_date.
// Caps at 3000 PRs (30 pages × 100 per page).

import 'server-only';

import { githubRequest } from './client';
import { SYNC_TIMING, INITIAL_BACKFILL_DAYS } from '@/lib/scoring/config';
import { RateLimitError } from '@/lib/sync/errors';
import type { GitHubPR } from '@/types/index';

const PER_PAGE = 100;
const MAX_PAGES = SYNC_TIMING.prsPerSyncCap / PER_PAGE;  // 30

export interface FetchPRsOptions {
  token: string;
  owner: string;
  repo: string;
  /** ISO timestamptz string — only fetch PRs updated since this time */
  syncCursorDate: string | null;
  /** Callback to check elapsed time during pagination */
  onPage?: (page: number, totalFetched: number) => void;
  /** Elapsed time checker — returns true if we've exceeded budget */
  isOverFetchBudget?: () => boolean;
}

export interface FetchPRsResult {
  prs: GitHubPR[];
  rateLimitRemaining: number;
  pagesFetched: number;
}

/**
 * Fetch PRs for a repository.
 * - On first sync (syncCursorDate = null): fetches last INITIAL_BACKFILL_DAYS days
 * - On incremental sync: fetches PRs updated since syncCursorDate
 * - Pagination caps at MAX_PAGES (3000 PRs total)
 * - Stops pagination if isOverFetchBudget() returns true (MF-5)
 */
export async function fetchPRsForRepo(options: FetchPRsOptions): Promise<FetchPRsResult> {
  const { token, owner, repo, syncCursorDate, onPage, isOverFetchBudget } = options;

  // Determine the since date for filtering
  let sinceDate: string;
  if (syncCursorDate) {
    sinceDate = syncCursorDate;
  } else {
    // Initial backfill: go back INITIAL_BACKFILL_DAYS
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - INITIAL_BACKFILL_DAYS);
    sinceDate = cutoff.toISOString();
  }

  const allPRs: GitHubPR[] = [];
  let rateLimitRemaining = 5000;
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= MAX_PAGES) {
    // MF-5: check fetch budget before each page
    if (isOverFetchBudget?.()) {
      break;
    }

    const params = new URLSearchParams({
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: String(PER_PAGE),
      page: String(page),
    });

    try {
      const result = await githubRequest<GitHubPR[]>(
        `/repos/${owner}/${repo}/pulls?${params.toString()}`,
        { token }
      );

      rateLimitRemaining = result.rateLimitRemaining;
      const prs = result.data;

      if (prs.length === 0) {
        hasMore = false;
        break;
      }

      // Filter PRs updated since our cutoff date
      const filtered = prs.filter(pr => {
        const updatedAt = pr.closed_at ?? pr.merged_at ?? pr.created_at;
        return new Date(updatedAt) >= new Date(sinceDate) || pr.state === 'open';
      });

      allPRs.push(...filtered);

      // If all PRs on this page are older than sinceDate and none are open, stop
      const oldestPROnPage = prs[prs.length - 1];
      const oldestDate = oldestPROnPage.closed_at ?? oldestPROnPage.created_at;
      if (new Date(oldestDate) < new Date(sinceDate) && oldestPROnPage.state !== 'open') {
        hasMore = false;
        break;
      }

      // Less than full page = last page
      if (prs.length < PER_PAGE) {
        hasMore = false;
      }

      onPage?.(page, allPRs.length);
      page++;
    } catch (err) {
      if (err instanceof RateLimitError) {
        throw err;  // propagate — abort sync
      }
      throw err;
    }
  }

  return {
    prs: allPRs,
    rateLimitRemaining,
    pagesFetched: page - 1,
  };
}
