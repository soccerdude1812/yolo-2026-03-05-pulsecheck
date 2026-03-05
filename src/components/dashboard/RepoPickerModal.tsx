'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { GitHubRepo } from '@/types/index';

interface RepoPickerModalProps {
  open: boolean;
  onClose: () => void;
  onRepoAdded: (repoId: string) => void;
}

export function RepoPickerModal({ open, onClose, onRepoAdded }: RepoPickerModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleBrowse = async () => {
    setBrowsing(true);
    setError(null);
    try {
      const text = await fetch('/api/github/repos').then((r) => r.text());
      const json = JSON.parse(text) as { data: GitHubRepo[] | null; error: string | null };
      if (json.error) {
        setError(json.error);
      } else {
        setGithubRepos(json.data ?? []);
      }
    } catch {
      setError('Failed to load your GitHub repos');
    } finally {
      setBrowsing(false);
    }
  };

  const handleAdd = async (fullName: string) => {
    setLoading(true);
    setLimitError(null);
    setError(null);
    const [owner, repo] = fullName.split('/');
    if (!owner || !repo) {
      setError('Enter a valid repo in the format "owner/repo-name"');
      setLoading(false);
      return;
    }

    try {
      const text = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      }).then((r) => r.text());

      const json = JSON.parse(text) as {
        data: { repo_id: string; sync?: unknown } | null;
        error: string | null;
        message?: string;
      };

      if (json.error === 'REPO_LIMIT_REACHED') {
        // MF-12: inline upgrade prompt
        setLimitError('Free plan allows 1 repo. Upgrade to Pro for up to 5 repos.');
        return;
      }

      if (json.error) {
        setError(json.error);
        return;
      }

      if (json.data?.repo_id) {
        addToast({
          type: 'success',
          title: 'Repo added!',
          description: `Syncing ${fullName}… fetching 90 days of PR history.`,
        });
        onRepoAdded(json.data.repo_id);
        onClose();
        setInputValue('');
        setGithubRepos([]);
      }
    } catch {
      setError('Failed to add repo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      handleAdd(inputValue.trim());
    }
  };

  const handleClose = () => {
    setInputValue('');
    setGithubRepos([]);
    setLimitError(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add a GitHub Repo"
      description="Connect a repo to start tracking your team's engineering health."
      size="md"
    >
      {/* Limit error — prominent, not dismissable (MF-12) */}
      {limitError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm text-amber-300 font-medium">Repo limit reached</p>
              <p className="text-xs text-zinc-400 mt-0.5">{limitError}</p>
              <Button
                variant="primary"
                size="sm"
                className="mt-3"
                onClick={() => { handleClose(); window.location.href = '/#pricing'; }}
              >
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual input form */}
      <form onSubmit={handleSubmit} className="mb-5">
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Enter repo name
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setError(null); }}
            placeholder="owner/repo-name (e.g. vercel/next.js)"
            className="flex-1 bg-zinc-800 text-zinc-200 placeholder-zinc-500 text-sm px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
            disabled={loading}
          />
          <Button variant="primary" size="md" type="submit" loading={loading}>
            Add
          </Button>
        </div>
        {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
      </form>

      {/* Divider */}
      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-800" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 bg-zinc-900 text-xs text-zinc-500">or</span>
        </div>
      </div>

      {/* Browse GitHub repos */}
      {githubRepos.length === 0 ? (
        <Button variant="secondary" size="md" className="w-full" onClick={handleBrowse} loading={browsing}>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          Browse my GitHub repos
        </Button>
      ) : (
        <div>
          <div className="text-xs font-medium text-zinc-400 mb-2">Your recently updated repos</div>
          <div className="max-h-60 overflow-y-auto space-y-1 scrollbar-thin rounded-xl border border-zinc-800 p-1">
            {githubRepos.map((repo) => (
              <button
                key={repo.id}
                onClick={() => handleAdd(repo.full_name)}
                disabled={loading}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-left disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="flex-1 text-sm text-zinc-300 truncate">{repo.full_name}</span>
                {repo.private && (
                  <span className="text-xs text-zinc-500 shrink-0">Private</span>
                )}
                <svg className="w-3.5 h-3.5 text-zinc-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
