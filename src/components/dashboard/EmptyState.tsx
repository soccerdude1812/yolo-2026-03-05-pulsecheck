'use client';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { SyncStatus } from '@/types/index';

interface EmptyStateProps {
  syncStatus: SyncStatus | null;
  hasData?: boolean;
  onSync?: () => void;
  onAddRepo?: () => void;
  error?: string | null;
  syncing?: boolean;
  username?: string;
}

export function EmptyState({
  syncStatus,
  hasData = false,
  onSync,
  onAddRepo,
  error,
  syncing = false,
  username,
}: EmptyStateProps) {
  // If we have data, don't render empty state
  if (hasData) return null;

  // No repo connected at all
  if (!syncStatus) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        {username && (
          <p className="text-zinc-400 text-sm mb-2">Welcome, <span className="text-zinc-200 font-medium">@{username}</span></p>
        )}
        <h2 className="text-2xl font-bold text-zinc-50 mb-3">Connect your first GitHub repo</h2>
        <p className="text-zinc-400 text-sm max-w-sm mb-8 leading-relaxed">
          Start tracking your team&apos;s engineering health. We&apos;ll fetch 90 days of PR history and build your dashboard in minutes.
        </p>
        <Button variant="primary" size="lg" onClick={onAddRepo}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Your First Repo
        </Button>
      </div>
    );
  }

  // sync_status = 'pending'
  if (syncStatus === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-zinc-50 mb-3">Ready to sync</h2>
        <p className="text-zinc-400 text-sm max-w-sm mb-8 leading-relaxed">
          This repo hasn&apos;t been synced yet. Click below to fetch 90 days of PR history and populate your dashboard.
        </p>
        <Button variant="primary" size="lg" onClick={onSync} loading={syncing}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync Now — Connect This Repo
        </Button>
      </div>
    );
  }

  // sync_status = 'syncing'
  if (syncStatus === 'syncing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
          <Spinner size="lg" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-50 mb-3">Syncing your repo</h2>
        <p className="text-zinc-400 text-sm max-w-sm leading-relaxed">
          Fetching 90 days of PR history, computing health scores, and analyzing contributor patterns&hellip;
        </p>
        <div className="flex items-center gap-1.5 mt-8">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: '200ms' }} />
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: '400ms' }} />
        </div>
      </div>
    );
  }

  // sync_status = 'error'
  if (syncStatus === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-zinc-50 mb-3">Sync failed</h2>
        {error && <p className="text-rose-400 text-sm mb-4 max-w-sm">{error}</p>}
        <p className="text-zinc-400 text-sm max-w-sm mb-8 leading-relaxed">
          Something went wrong while syncing your repo. This may be a temporary GitHub API issue.
        </p>
        <Button variant="secondary" size="lg" onClick={onSync} loading={syncing}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Retry Sync
        </Button>
      </div>
    );
  }

  // sync_status = 'done' but no PR data
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-zinc-50 mb-3">No PR activity found</h2>
      <p className="text-zinc-400 text-sm max-w-sm mb-8 leading-relaxed">
        We didn&apos;t find any pull requests in the last 90 days. Add some PRs to this repo and sync again to see your team&apos;s health.
      </p>
      <Button variant="ghost" size="md" onClick={onSync} loading={syncing}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Sync Again
      </Button>
    </div>
  );
}
