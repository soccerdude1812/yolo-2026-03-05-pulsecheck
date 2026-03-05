'use client';

import { Badge } from '@/components/ui/Badge';
import type { Repo, UserProfile } from '@/types/index';

interface TopbarProps {
  repo: Repo | null;
  profile: UserProfile | null;
  onSync?: () => void;
  syncing?: boolean;
  onMenuToggle?: () => void;
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function isDataStale(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;
  const diff = Date.now() - new Date(lastSyncedAt).getTime();
  return diff > 48 * 3600000; // > 48 hours
}

function getSyncStatusBadge(status: string) {
  switch (status) {
    case 'syncing': return <Badge variant="status-syncing" dot>Syncing…</Badge>;
    case 'done': return <Badge variant="status-done" dot>Synced</Badge>;
    case 'partial': return <Badge variant="status-partial" dot>Partial</Badge>;
    case 'error': return <Badge variant="status-error" dot>Sync error</Badge>;
    case 'pending': return <Badge variant="status-pending" dot>Pending</Badge>;
    default: return null;
  }
}

export function Topbar({ repo, profile, onSync, syncing = false, onMenuToggle }: TopbarProps) {
  const plan = profile?.plan ?? 'free';
  const showStaleBanner =
    plan === 'free' &&
    repo &&
    isDataStale(repo.last_synced_at);

  return (
    <div className="shrink-0">
      {/* Stale data banner (MF-11) */}
      {showStaleBanner && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Data last synced {repo.last_synced_at ? formatRelativeTime(repo.last_synced_at) : 'never'}.
              Free plan requires manual sync.
            </span>
          </div>
          <button
            onClick={onSync}
            disabled={syncing}
            className="shrink-0 text-xs font-medium text-amber-400 hover:text-amber-300 underline underline-offset-2 disabled:opacity-50 transition-colors"
          >
            Sync Now
          </button>
        </div>
      )}

      {/* Main topbar */}
      <header className="h-14 px-4 sm:px-6 flex items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile menu toggle */}
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="sm:hidden text-zinc-400 hover:text-zinc-200 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          {/* Repo name */}
          {repo ? (
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-zinc-200 truncate">{repo.github_full_name}</span>
              {repo.is_private && (
                <span className="text-zinc-600 shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-zinc-500">No repo selected</span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Sync status */}
          {repo && getSyncStatusBadge(repo.sync_status)}

          {/* Last synced */}
          {repo?.last_synced_at && (
            <span className="text-xs text-zinc-500 hidden sm:block">
              Last synced: {formatRelativeTime(repo.last_synced_at)}
            </span>
          )}

          {/* Sync Now button */}
          {repo && (
            <button
              onClick={onSync}
              disabled={syncing || repo.sync_status === 'syncing'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-lg text-xs font-medium text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className={`w-3.5 h-3.5 ${syncing || repo.sync_status === 'syncing' ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          )}
        </div>
      </header>
    </div>
  );
}
