-- PulseCheck — Complete Database Schema
-- Run this in Supabase SQL Editor

-- ─────────────────────────────────────────────────────────────────────────────
-- USER PROFILES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.user_profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_username     TEXT NOT NULL,
  github_avatar_url   TEXT,
  plan                TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team')),
  slack_webhook_url   TEXT,
  resend_email        TEXT,
  narrative_month     TEXT,
  narrative_count     INTEGER NOT NULL DEFAULT 0,
  last_manual_sync_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_self"
  ON public.user_profiles FOR ALL USING (auth.uid() = id);


-- ─────────────────────────────────────────────────────────────────────────────
-- REPOS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.repos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  github_owner     TEXT NOT NULL,
  github_repo      TEXT NOT NULL,
  github_full_name TEXT NOT NULL,
  github_repo_id   BIGINT NOT NULL,
  default_branch   TEXT NOT NULL DEFAULT 'main',
  is_private       BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at   TIMESTAMPTZ,
  sync_cursor_date TIMESTAMPTZ,
  sync_status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'syncing', 'done', 'partial', 'error')),
  sync_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, github_repo_id)
);

ALTER TABLE public.repos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repos_owner"
  ON public.repos FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_repos_user_id ON public.repos(user_id);
CREATE INDEX idx_repos_active ON public.repos(is_active) WHERE is_active = TRUE;


-- ─────────────────────────────────────────────────────────────────────────────
-- PR LIFECYCLE RECORDS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.pr_lifecycle (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id                   UUID NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
  github_pr_number          INTEGER NOT NULL,
  title                     TEXT NOT NULL,
  author_login              TEXT NOT NULL,
  state                     TEXT NOT NULL CHECK (state IN ('open', 'closed', 'merged')),
  created_at_gh             TIMESTAMPTZ NOT NULL,
  first_review_at           TIMESTAMPTZ,
  approved_at               TIMESTAMPTZ,
  merged_at                 TIMESTAMPTZ,
  closed_at                 TIMESTAMPTZ,
  additions                 INTEGER NOT NULL DEFAULT 0,
  deletions                 INTEGER NOT NULL DEFAULT 0,
  changed_files             INTEGER NOT NULL DEFAULT 0,
  total_review_comments     INTEGER NOT NULL DEFAULT 0,
  review_count              INTEGER NOT NULL DEFAULT 0,
  is_revert                 BOOLEAN NOT NULL DEFAULT FALSE,
  week_start                DATE NOT NULL,
  time_to_first_review_hrs  NUMERIC(10,2),
  time_to_approval_hrs      NUMERIC(10,2),
  time_to_merge_hrs         NUMERIC(10,2),
  synced_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(repo_id, github_pr_number)
);

ALTER TABLE public.pr_lifecycle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr_lifecycle_owner"
  ON public.pr_lifecycle FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.repos
    WHERE repos.id = pr_lifecycle.repo_id AND repos.user_id = auth.uid()
  ));

CREATE INDEX idx_pr_lifecycle_repo_week ON public.pr_lifecycle(repo_id, week_start);
CREATE INDEX idx_pr_lifecycle_author ON public.pr_lifecycle(repo_id, author_login, week_start);
CREATE INDEX idx_pr_lifecycle_repo_state ON public.pr_lifecycle(repo_id, state)
  WHERE state = 'open';


-- ─────────────────────────────────────────────────────────────────────────────
-- CONTRIBUTOR WEEKLY ROLLUPS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.contributor_rollups (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id                          UUID NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
  github_login                     TEXT NOT NULL,
  week_start                       DATE NOT NULL,
  prs_opened                       INTEGER NOT NULL DEFAULT 0,
  prs_merged                       INTEGER NOT NULL DEFAULT 0,
  prs_closed_unmerged              INTEGER NOT NULL DEFAULT 0,
  lines_added                      INTEGER NOT NULL DEFAULT 0,
  lines_deleted                    INTEGER NOT NULL DEFAULT 0,
  avg_pr_size_lines                NUMERIC(10,2),
  revert_prs                       INTEGER NOT NULL DEFAULT 0,
  median_time_to_first_review_hrs  NUMERIC(10,2),
  reviews_given                    INTEGER NOT NULL DEFAULT 0,
  review_comments_given            INTEGER NOT NULL DEFAULT 0,
  median_review_turnaround_hrs     NUMERIC(10,2),
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(repo_id, github_login, week_start)
);

ALTER TABLE public.contributor_rollups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rollups_owner"
  ON public.contributor_rollups FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.repos
    WHERE repos.id = contributor_rollups.repo_id AND repos.user_id = auth.uid()
  ));

CREATE INDEX idx_rollups_repo_week ON public.contributor_rollups(repo_id, week_start DESC);
CREATE INDEX idx_rollups_contributor ON public.contributor_rollups(repo_id, github_login, week_start DESC);
CREATE INDEX idx_rollups_repo_login ON public.contributor_rollups(repo_id, github_login);


-- ─────────────────────────────────────────────────────────────────────────────
-- WEEKLY HEALTH SCORES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.weekly_health_scores (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id                         UUID NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
  week_start                      DATE NOT NULL,
  score                           NUMERIC(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  sub_score_review_velocity       NUMERIC(5,2) NOT NULL DEFAULT 0,
  sub_score_pr_size_discipline    NUMERIC(5,2) NOT NULL DEFAULT 0,
  sub_score_stale_pr_burden       NUMERIC(5,2) NOT NULL DEFAULT 0,
  sub_score_contributor_rhythm    NUMERIC(5,2) NOT NULL DEFAULT 0,
  sub_score_review_depth          NUMERIC(5,2) NOT NULL DEFAULT 0,
  sub_score_revert_rate           NUMERIC(5,2) NOT NULL DEFAULT 0,
  active_contributors             INTEGER NOT NULL DEFAULT 0,
  total_prs_opened                INTEGER NOT NULL DEFAULT 0,
  total_prs_merged                INTEGER NOT NULL DEFAULT 0,
  stale_pr_count                  INTEGER NOT NULL DEFAULT 0,
  total_reviews                   INTEGER NOT NULL DEFAULT 0,
  median_time_to_first_review_hrs NUMERIC(10,2),
  median_time_to_merge_hrs        NUMERIC(10,2),
  rhythm_flags                    JSONB NOT NULL DEFAULT '[]',
  bottleneck_analysis             JSONB NOT NULL DEFAULT '[]',
  narrative_digest                TEXT,
  narrative_model                 TEXT,
  narrative_generated_at          TIMESTAMPTZ,
  alert_sent                      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(repo_id, week_start)
);

ALTER TABLE public.weekly_health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scores_owner"
  ON public.weekly_health_scores FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.repos
    WHERE repos.id = weekly_health_scores.repo_id AND repos.user_id = auth.uid()
  ));

CREATE INDEX idx_scores_repo_week ON public.weekly_health_scores(repo_id, week_start DESC);
CREATE INDEX idx_health_scores_repo_alert ON public.weekly_health_scores(repo_id, alert_sent)
  WHERE alert_sent = FALSE;


-- ─────────────────────────────────────────────────────────────────────────────
-- ALERT CONFIGS (per repo)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.alert_configs (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id                    UUID NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE UNIQUE,
  email_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  score_drop_threshold       INTEGER NOT NULL DEFAULT 15,
  consecutive_weeks_required INTEGER NOT NULL DEFAULT 2,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.alert_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert_configs_owner"
  ON public.alert_configs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.repos
    WHERE repos.id = alert_configs.repo_id AND repos.user_id = auth.uid()
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- ALERT LOG (append-only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.alert_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id    UUID NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('score_drop', 'contributor_silent', 'bottleneck_spike')),
  payload    JSONB NOT NULL DEFAULT '{}',
  sent_slack BOOLEAN NOT NULL DEFAULT FALSE,
  sent_email BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.alert_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert_log_owner"
  ON public.alert_log FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.repos
    WHERE repos.id = alert_log.repo_id AND repos.user_id = auth.uid()
  ));

CREATE INDEX idx_alert_log_repo ON public.alert_log(repo_id, week_start DESC);
