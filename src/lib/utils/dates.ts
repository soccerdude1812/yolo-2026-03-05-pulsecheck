// src/lib/utils/dates.ts
// Date utilities for PulseCheck. All functions are pure (no side effects).
// Week boundaries are ISO weeks starting on Monday.

/**
 * Returns ISO date string (YYYY-MM-DD) for the Monday of the week containing `date`.
 * Uses ISO week convention: weeks start on Monday.
 */
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  // getDay() returns 0=Sunday, 1=Monday, ..., 6=Saturday
  // We want Monday = 0 offset, so: (day + 6) % 7 gives 0 for Monday
  const dayOfWeek = d.getDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  d.setDate(d.getDate() - daysFromMonday);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Returns the number of hours between two dates.
 * Result is always positive (absolute difference).
 */
export function diffHours(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60);
}

/**
 * Returns a human-readable "time ago" string.
 * Examples: "just now", "5m ago", "2h ago", "3d ago", "2w ago", "Jan 5"
 */
export function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSecs < 30) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 14) return `${diffDays}d ago`;
  if (diffWeeks < 8) return `${diffWeeks}w ago`;

  // Older than 8 weeks: show "Mon DD" (e.g., "Jan 5")
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Returns the current month as 'YYYY-MM' string.
 * Used for narrative quota month tracking (MF-1).
 */
export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Returns the first day of next month as a Date.
 * Used to compute narrative quota reset date.
 */
export function getNextMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

/**
 * Returns an ISO date string for a date N weeks before the given date (or today if not provided).
 */
export function weeksAgo(weeks: number, from?: Date): string {
  const d = from ? new Date(from) : new Date();
  d.setDate(d.getDate() - weeks * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Formats an ISO timestamptz or date string for display (e.g., "Mar 5, 2026").
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Returns true if the given ISO timestamp is older than `hours` hours ago.
 */
export function isOlderThan(isoString: string, hours: number): boolean {
  const then = new Date(isoString).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60) > hours;
}
