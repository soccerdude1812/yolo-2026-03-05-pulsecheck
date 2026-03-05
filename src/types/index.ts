// src/types/index.ts
// Shared TypeScript types for PulseCheck — ALL workstreams import from here.
// Define API response shapes here first; both API routes and frontend consumers import from this file.

// ─────────────────────────────────────────────────────────────────────────────
// PLAN TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type PlanType = 'free' | 'pro' | 'team';

export const PLAN_LIMITS = {
  free: {
    max_repos: 1,
    history_weeks: 4,
    ai_narrative: true,           // MF-1: free users CAN use narrative
    ai_narrative_monthly_cap: 1,  // MF-1: but only 1x per month
    slack_alerts: false,
    email_alerts: false,
    contributor_deep_dive: false,
    csv_export: false,
    auto_sync: false,
    manual_sync_min_gap_hours: 6, // rate limit manual syncs for free users
  },
  pro: {
    max_repos: 5,
    history_weeks: 26,
    ai_narrative: true,
    ai_narrative_monthly_cap: null as null,   // unlimited
    slack_alerts: true,
    email_alerts: true,
    contributor_deep_dive: true,
    csv_export: false,
    auto_sync: true,
    manual_sync_min_gap_hours: 0.5,  // 30 minutes
  },
  team: {
    max_repos: Infinity,
    history_weeks: 52,
    ai_narrative: true,
    ai_narrative_monthly_cap: null as null,
    slack_alerts: true,
    email_alerts: true,
    contributor_deep_dive: true,
    csv_export: true,
    auto_sync: true,
    manual_sync_min_gap_hours: 0,    // unlimited
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// USER PROFILE
// ─────────────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;                         // UUID, matches auth.users.id
  github_username: string;
  github_avatar_url: string | null;
  plan: PlanType;
  slack_webhook_url: string | null;
  resend_email: string | null;
  // MF-1: Free tier narrative quota tracking
  narrative_month: string | null;     // 'YYYY-MM' of last narrative generation
  narrative_count: number;
  // GitHub OAuth token (persisted from auth callback)
  github_token: string | null;
  // MF-3: Manual sync rate limiting
  last_manual_sync_at: string | null; // ISO timestamptz
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPO
// ─────────────────────────────────────────────────────────────────────────────

export type SyncStatus = 'pending' | 'syncing' | 'done' | 'partial' | 'error';

export interface Repo {
  id: string;                    // UUID
  user_id: string;               // UUID
  github_owner: string;
  github_repo: string;
  github_full_name: string;      // "owner/repo"
  github_repo_id: number;        // GitHub's numeric ID
  default_branch: string;
  is_private: boolean;
  is_active: boolean;
  last_synced_at: string | null; // ISO timestamptz
  sync_cursor_date: string | null; // MF-4: ISO timestamptz (not date-only)
  sync_status: SyncStatus;        // MF-5: includes 'partial'
  sync_error: string | null;
  created_at: string;
}

// Lightweight repo summary returned in list API (includes latest score)
export interface RepoSummary extends Repo {
  latest_score: number | null;
  latest_score_week: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PR LIFECYCLE RECORD
// ─────────────────────────────────────────────────────────────────────────────

export type PRState = 'open' | 'closed' | 'merged';

export interface PRLifecycle {
  id: string;
  repo_id: string;
  github_pr_number: number;
  title: string;
  author_login: string;
  state: PRState;
  created_at_gh: string;              // ISO timestamptz from GitHub
  first_review_at: string | null;
  approved_at: string | null;
  merged_at: string | null;
  closed_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  total_review_comments: number;
  review_count: number;
  is_revert: boolean;
  week_start: string;                 // ISO date string (Monday)
  time_to_first_review_hrs: number | null;
  time_to_approval_hrs: number | null;
  time_to_merge_hrs: number | null;
  synced_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRIBUTOR ROLLUP
// ─────────────────────────────────────────────────────────────────────────────

export interface ContributorRollup {
  id: string;
  repo_id: string;
  github_login: string;
  week_start: string;                        // ISO date string
  prs_opened: number;
  prs_merged: number;
  prs_closed_unmerged: number;
  lines_added: number;
  lines_deleted: number;
  avg_pr_size_lines: number | null;
  revert_prs: number;
  median_time_to_first_review_hrs: number | null;
  reviews_given: number;
  review_comments_given: number;
  median_review_turnaround_hrs: number | null;
  created_at: string;
  updated_at: string;
}

// Aggregated contributor view across weeks
export interface ContributorSummary {
  github_login: string;
  avatar_url?: string;
  total_prs_opened: number;
  total_prs_merged: number;
  total_reviews_given: number;
  total_lines_added: number;
  total_lines_deleted: number;
  avg_pr_size_lines: number | null;
  avg_review_turnaround_hrs: number | null;
  revert_count: number;
  weeks_active: number;
  rhythm_flags: RhythmFlag[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE SUB-SIGNALS
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreSubSignals {
  review_velocity: number;       // 0-100
  contributor_rhythm: number;    // 0-100
  stale_pr_burden: number;       // 0-100
  pr_size_discipline: number;    // 0-100
  review_depth: number;          // 0-100
  revert_rate: number;           // 0-100
}

// ─────────────────────────────────────────────────────────────────────────────
// RHYTHM FLAGS
// ─────────────────────────────────────────────────────────────────────────────

export type RhythmFlagSeverity = 'warning' | 'critical';
export type RhythmFlagType =
  | 'review_drop'
  | 'pr_drop'
  | 'size_spike'
  | 'silent_contributor';

export interface RhythmFlag {
  contributor: string;
  flag_type: RhythmFlagType;
  severity: RhythmFlagSeverity;
  current_value: number;
  baseline_value: number;
  week_start: string;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTTLENECK ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export type BottleneckType =
  | 'review_concentration'   // Too few reviewers handling all reviews
  | 'author_concentration'   // One author opening too many PRs
  | 'slow_lane'              // Specific authors' PRs take much longer
  | 'large_pr_pattern'       // Author consistently opens large PRs
  | 'stale_pr_author';       // Author's PRs go stale repeatedly

export interface BottleneckItem {
  type: BottleneckType;
  severity: RhythmFlagSeverity;
  contributors_involved: string[];
  metric: string;       // Human-readable metric name
  value: number;        // Current value
  baseline: number;     // Expected/normal value
  description: string;  // Human-readable explanation
}

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY HEALTH SCORE
// ─────────────────────────────────────────────────────────────────────────────

export interface WeeklyHealthScore {
  id: string;
  repo_id: string;
  week_start: string;                           // ISO date string
  score: number;                                // 0-100
  sub_score_review_velocity: number;
  sub_score_pr_size_discipline: number;
  sub_score_stale_pr_burden: number;
  sub_score_contributor_rhythm: number;
  sub_score_review_depth: number;
  sub_score_revert_rate: number;
  active_contributors: number;
  total_prs_opened: number;
  total_prs_merged: number;
  stale_pr_count: number;
  total_reviews: number;
  median_time_to_first_review_hrs: number | null;
  median_time_to_merge_hrs: number | null;
  rhythm_flags: RhythmFlag[];                  // stored as JSONB
  bottleneck_analysis: BottleneckItem[];        // stored as JSONB
  narrative_digest: string | null;
  narrative_model: string | null;
  narrative_generated_at: string | null;
  alert_sent: boolean;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export interface AlertConfig {
  id: string;
  repo_id: string;
  email_enabled: boolean;
  score_drop_threshold: number;       // points drop that triggers alert
  consecutive_weeks_required: number; // weeks of consecutive drop before firing
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT LOG
// ─────────────────────────────────────────────────────────────────────────────

export type AlertType = 'score_drop' | 'contributor_silent' | 'bottleneck_spike';

export interface AlertLog {
  id: string;
  repo_id: string;
  week_start: string;
  alert_type: AlertType;
  payload: Record<string, unknown>;
  sent_slack: boolean;
  sent_email: boolean;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC STATUS / RESULT
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncResult {
  repo_id: string;
  status: SyncStatus;
  prs_fetched: number;
  prs_upserted: number;
  weeks_scored: number;
  alerts_sent: number;
  elapsed_ms: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API RESPONSE WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

// All API routes return { data: T | null, error: string | null }
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  message?: string;    // Optional human-readable message (e.g., for quota errors)
}

// ─────────────────────────────────────────────────────────────────────────────
// STALE PR (derived from PRLifecycle for tracker UI)
// ─────────────────────────────────────────────────────────────────────────────

export interface StalePR {
  github_pr_number: number;
  title: string;
  author_login: string;
  created_at_gh: string;
  days_open: number;
  review_count: number;
  github_url: string;         // Link to GitHub PR (e.g., https://github.com/owner/repo/pull/123)
  last_activity_at: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// NARRATIVE
// ─────────────────────────────────────────────────────────────────────────────

export interface NarrativeRequest {
  repo_id: string;
  week_start: string;
  force_regenerate?: boolean;
}

export interface NarrativeResponse {
  narrative: string;
  model_used: string;
  generated_at: string;
  quota_remaining: number | null;  // null = unlimited (pro/team); number = remaining for free
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRIBUTOR DEEP DIVE
// ─────────────────────────────────────────────────────────────────────────────

export interface ContributorDeepDive {
  github_login: string;
  weeks: ContributorRollup[];           // last N weeks (plan-gated)
  rhythm_flags: RhythmFlag[];
  summary: ContributorSummary;
}

// ─────────────────────────────────────────────────────────────────────────────
// GITHUB API SHAPES (raw from GitHub REST API — only what we use)
// ─────────────────────────────────────────────────────────────────────────────

export interface GitHubPR {
  number: number;
  title: string;
  state: 'open' | 'closed';
  user: { login: string } | null;
  created_at: string;
  merged_at: string | null;
  closed_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  base: { repo: { id: number; full_name: string; default_branch: string; private: boolean } };
  draft: boolean;
}

export interface GitHubReview {
  id: number;
  user: { login: string } | null;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  submitted_at: string | null;
  body: string;
}

export interface GitHubReviewComment {
  id: number;
  user: { login: string } | null;
  created_at: string;
  body: string;
}

export interface GitHubRateLimit {
  remaining: number;
  limit: number;
  reset: number;  // Unix timestamp
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD DATA SHAPES (compound types for page queries)
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardRepo {
  repo: Repo;
  latest_score: WeeklyHealthScore | null;
  score_trend: WeeklyHealthScore[];  // last 13 weeks
}

export interface RepoDashboardData {
  repo: Repo;
  scores: WeeklyHealthScore[];          // last N weeks based on plan
  contributors: ContributorSummary[];
  stale_prs: StalePR[];
  latest_bottlenecks: BottleneckItem[];
  user_plan: PlanType;
}
