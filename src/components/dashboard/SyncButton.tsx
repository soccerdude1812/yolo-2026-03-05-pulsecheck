'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import type { Repo } from '@/types/index';

interface SyncButtonProps {
  repo: Repo | null;
  onSyncComplete?: () => void;
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Never synced';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function SyncButton({ repo, onSyncComplete }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const { addToast } = useToast();

  const handleSync = async () => {
    if (!repo || syncing) return;
    setSyncing(true);
    try {
      const text = await fetch(`/api/repos/${repo.id}/sync`, {
        method: 'POST',
      }).then((r) => r.text());

      const json = JSON.parse(text) as {
        data: { status: string; prs_fetched: number; weeks_scored: number } | null;
        error: string | null;
      };

      if (json.error) {
        addToast({
          type: 'error',
          title: 'Sync failed',
          description: json.error,
        });
      } else if (json.data) {
        const { status, prs_fetched, weeks_scored } = json.data;
        if (status === 'partial') {
          addToast({
            type: 'warning',
            title: 'Sync timed out',
            description: `Partially synced ${prs_fetched} PRs. Try syncing again for complete data.`,
          });
        } else {
          addToast({
            type: 'success',
            title: 'Sync complete',
            description: `Fetched ${prs_fetched} PRs, scored ${weeks_scored} weeks.`,
          });
        }
        onSyncComplete?.();
      }
    } catch {
      addToast({ type: 'error', title: 'Sync failed', description: 'Network error. Please try again.' });
    } finally {
      setSyncing(false);
    }
  };

  const isSyncing = syncing || repo?.sync_status === 'syncing';

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={!repo || isSyncing}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-lg text-sm font-medium text-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg
          className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {isSyncing ? 'Syncing…' : 'Sync Now'}
      </button>
      {repo?.last_synced_at && (
        <span className="text-xs text-zinc-500">
          Last synced: {formatRelativeTime(repo.last_synced_at)}
        </span>
      )}
    </div>
  );
}
