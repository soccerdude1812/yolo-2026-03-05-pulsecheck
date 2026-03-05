'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Topbar } from '@/components/dashboard/Topbar';
import { RepoPickerModal } from '@/components/dashboard/RepoPickerModal';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { useRepos } from '@/hooks/useRepo';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { Repo } from '@/types/index';

export const dynamic = 'force-dynamic';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { repos, loading: reposLoading, refetch: refetchRepos } = useRepos();
  const { profile, loading: profileLoading } = useUserProfile();
  const [currentRepoId, setCurrentRepoId] = useState<string | null>(null);
  const [currentRepo, setCurrentRepo] = useState<Repo | null>(null);
  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { addToast } = useToast();

  // Initialize repo from URL or first available
  useEffect(() => {
    const urlRepoId = searchParams.get('repo');
    if (urlRepoId) {
      setCurrentRepoId(urlRepoId);
    } else if (repos.length > 0 && !currentRepoId) {
      setCurrentRepoId(repos[0].id);
    }
  }, [repos, searchParams, currentRepoId]);

  // Fetch current repo details when ID changes
  useEffect(() => {
    if (!currentRepoId) {
      setCurrentRepo(null);
      return;
    }
    const repo = repos.find((r) => r.id === currentRepoId) ?? null;
    setCurrentRepo(repo);
  }, [currentRepoId, repos]);

  const handleRepoChange = useCallback((repoId: string) => {
    setCurrentRepoId(repoId);
    const url = new URL(window.location.href);
    url.searchParams.set('repo', repoId);
    router.push(url.pathname + url.search);
  }, [router]);

  const handleSync = useCallback(async () => {
    if (!currentRepoId || syncing) return;
    setSyncing(true);
    try {
      const text = await fetch(`/api/repos/${currentRepoId}/sync`, {
        method: 'POST',
      }).then((r) => r.text());
      const json = JSON.parse(text) as {
        data: { status: string; prs_fetched: number; weeks_scored: number } | null;
        error: string | null;
      };

      if (json.error) {
        if (json.error === 'RATE_LIMIT_REACHED') {
          addToast({
            type: 'warning',
            title: 'GitHub API rate limit reached',
            description: 'Sync will resume automatically in ~1 hour.',
          });
        } else {
          addToast({ type: 'error', title: 'Sync failed', description: json.error });
        }
      } else if (json.data) {
        const { status, prs_fetched, weeks_scored } = json.data;
        if (status === 'partial') {
          addToast({
            type: 'warning',
            title: 'Sync timed out',
            description: `Partially synced ${prs_fetched} PRs. Data is partially updated. Try syncing again.`,
          });
        } else {
          addToast({
            type: 'success',
            title: 'Sync complete',
            description: `${prs_fetched} PRs fetched, ${weeks_scored} weeks scored.`,
          });
        }
        await refetchRepos();
      }
    } catch {
      addToast({ type: 'error', title: 'Sync failed', description: 'Network error. Please try again.' });
    } finally {
      setSyncing(false);
    }
  }, [currentRepoId, syncing, addToast, refetchRepos]);

  const handleRepoAdded = useCallback(async (newRepoId: string) => {
    await refetchRepos();
    handleRepoChange(newRepoId);
  }, [refetchRepos, handleRepoChange]);

  const isLoading = reposLoading || profileLoading;

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Sidebar — desktop */}
      <div className={`hidden sm:flex shrink-0 ${mobileMenuOpen ? '' : ''}`}>
        <Sidebar
          repos={repos}
          currentRepoId={currentRepoId}
          onRepoChange={handleRepoChange}
          onAddRepo={() => setAddRepoOpen(true)}
          profile={profile}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="sm:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-zinc-950/80" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 flex">
            <Sidebar
              repos={repos}
              currentRepoId={currentRepoId}
              onRepoChange={(id) => { handleRepoChange(id); setMobileMenuOpen(false); }}
              onAddRepo={() => { setAddRepoOpen(true); setMobileMenuOpen(false); }}
              profile={profile}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          repo={currentRepo}
          profile={profile}
          onSync={handleSync}
          syncing={syncing}
          onMenuToggle={() => setMobileMenuOpen((v) => !v)}
        />

        {/* No-repo onboarding banner */}
        {!isLoading && repos.length === 0 && (
          <div className="mx-4 sm:mx-6 mt-4 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="flex-1 text-sm text-emerald-300">
              Getting started: connect a repo to see your team&apos;s health
            </p>
            <button
              onClick={() => setAddRepoOpen(true)}
              className="shrink-0 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-2"
            >
              Add repo →
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
          {children}
        </main>
      </div>

      {/* Repo picker modal */}
      <RepoPickerModal
        open={addRepoOpen}
        onClose={() => setAddRepoOpen(false)}
        onRepoAdded={handleRepoAdded}
      />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Suspense fallback={
        <div className="flex h-screen bg-zinc-950 items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      }>
        <DashboardShell>{children}</DashboardShell>
      </Suspense>
    </ToastProvider>
  );
}
