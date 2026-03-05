// src/lib/utils/plan.ts
// Plan checking utilities — centralized feature gating for all workstreams.
// Import PLAN_LIMITS from types/index.ts — that is the single source of truth.

import { PLAN_LIMITS, PlanType } from '@/types/index';

export { PLAN_LIMITS };

/**
 * Returns true if the given plan has access to the specified feature.
 * Features are boolean keys in PLAN_LIMITS.
 */
export function canUseFeature(
  plan: PlanType,
  feature: keyof typeof PLAN_LIMITS.free
): boolean {
  const limits = PLAN_LIMITS[plan];
  const value = limits[feature];

  // For numeric limits, treat 0 as false, positive numbers as true
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'boolean') return value;
  // null means unlimited (e.g., ai_narrative_monthly_cap: null)
  if (value === null) return true;
  // Infinity = unlimited (max_repos: Infinity)
  return true;
}

/**
 * Returns the number of history weeks a plan can access.
 */
export function getHistoryWeeks(plan: PlanType): number {
  return PLAN_LIMITS[plan].history_weeks;
}

/**
 * Returns the maximum number of repos for a plan.
 */
export function getMaxRepos(plan: PlanType): number {
  const max = PLAN_LIMITS[plan].max_repos;
  return max === Infinity ? Number.MAX_SAFE_INTEGER : max;
}

/**
 * Returns the AI narrative monthly cap for a plan.
 * null means unlimited.
 */
export function getNarrativeMonthlyCAP(plan: PlanType): number | null {
  return PLAN_LIMITS[plan].ai_narrative_monthly_cap;
}

/**
 * Returns the minimum gap (in hours) required between manual syncs.
 * 0 means no restriction.
 */
export function getManualSyncMinGapHours(plan: PlanType): number {
  return PLAN_LIMITS[plan].manual_sync_min_gap_hours;
}

/**
 * Checks if a free user has exhausted their monthly AI narrative quota.
 * Returns true if the user cannot generate another narrative this month.
 *
 * @param plan - The user's plan
 * @param narrativeMonth - The 'YYYY-MM' string of last generation (from user_profiles)
 * @param narrativeCount - The count of generations in that month
 */
export function isNarrativeQuotaExhausted(
  plan: PlanType,
  narrativeMonth: string | null,
  narrativeCount: number
): boolean {
  const cap = getNarrativeMonthlyCAP(plan);

  // null cap = unlimited
  if (cap === null) return false;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const sameMonth = narrativeMonth === currentMonth;

  return sameMonth && narrativeCount >= cap;
}
