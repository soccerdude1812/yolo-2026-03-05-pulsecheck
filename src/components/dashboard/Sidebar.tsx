'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useUserProfile';
import type { RepoSummary, UserProfile } from '@/types/index';
import { PLAN_LIMITS } from '@/lib/utils/plan';

interface SidebarProps {
  repos: RepoSummary[];
  currentRepoId: string | null;
  onRepoChange: (repoId: string) => void;
  onAddRepo: () => void;
  profile: UserProfile | null;
}

const navItems = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/contributors',
    label: 'Contributors',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/bottlenecks',
    label: 'Bottlenecks',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/alerts',
    label: 'Alerts',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function getScoreColor(score: number | null) {
  if (score === null) return 'text-zinc-500';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-rose-400';
}

export function Sidebar({ repos, currentRepoId, onRepoChange, onAddRepo, profile }: SidebarProps) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentRepo = repos.find((r) => r.id === currentRepoId);
  const plan = profile?.plan ?? 'free';
  const maxRepos = PLAN_LIMITS[plan].max_repos === Infinity ? Infinity : PLAN_LIMITS[plan].max_repos;
  const atRepoLimit = repos.length >= maxRepos;

  // Filter repos by search
  const filteredRepos = repos.filter((r) =>
    r.github_full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRepoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <aside className="w-64 shrink-0 flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-zinc-800">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center group-hover:bg-emerald-400 transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-semibold text-zinc-50 tracking-tight">PulseCheck</span>
        </Link>
      </div>

      {/* Repo Selector */}
      <div className="px-3 py-3 border-b border-zinc-800" ref={dropdownRef}>
        <button
          onClick={() => setRepoDropdownOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors text-left group"
          aria-haspopup="listbox"
          aria-expanded={repoDropdownOpen}
        >
          <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          <span className="flex-1 text-sm text-zinc-300 truncate">
            {currentRepo?.github_full_name ?? (repos.length === 0 ? 'No repos connected' : 'Select repo')}
          </span>
          {currentRepo?.latest_score != null && (
            <span className={`text-xs font-semibold tabular-nums ${getScoreColor(currentRepo.latest_score)}`}>
              {Math.round(currentRepo.latest_score)}
            </span>
          )}
          <svg className={`w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform ${repoDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown */}
        {repoDropdownOpen && (
          <div className="absolute z-30 w-56 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl">
            {/* Search */}
            {repos.length > 3 && (
              <div className="p-2 border-b border-zinc-800">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search repos…"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="w-full bg-zinc-800 text-sm text-zinc-200 placeholder-zinc-500 px-3 py-1.5 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
                />
              </div>
            )}
            {/* Repo list */}
            <div className="max-h-48 overflow-y-auto scrollbar-thin py-1">
              {filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => {
                    onRepoChange(repo.id);
                    setRepoDropdownOpen(false);
                    setRepoSearch('');
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800 transition-colors ${repo.id === currentRepoId ? 'bg-zinc-800/50' : ''}`}
                >
                  <span className="flex-1 text-sm text-zinc-300 truncate">{repo.github_full_name}</span>
                  {repo.latest_score != null && (
                    <span className={`text-xs font-semibold ${getScoreColor(repo.latest_score)}`}>
                      {Math.round(repo.latest_score)}
                    </span>
                  )}
                  {repo.id === currentRepoId && (
                    <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
              {filteredRepos.length === 0 && (
                <div className="px-3 py-2 text-xs text-zinc-500">No repos found</div>
              )}
            </div>
            {/* Add repo */}
            <div className="border-t border-zinc-800 p-1.5">
              {atRepoLimit ? (
                <div className="px-3 py-2">
                  <p className="text-xs text-amber-400 mb-1.5">
                    {maxRepos === Infinity ? '' : `${repos.length} of ${maxRepos} repos connected`}
                  </p>
                  <button
                    onClick={() => { window.location.href = '/#pricing'; }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Upgrade to add more repos →
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { onAddRepo(); setRepoDropdownOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add repo
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={currentRepoId ? `${item.href}?repo=${currentRepoId}` : item.href}
              className={`
                flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent'}
              `}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-zinc-800">
        {profile && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
            {profile.github_avatar_url ? (
              <img
                src={profile.github_avatar_url}
                alt={profile.github_username}
                className="w-8 h-8 rounded-full shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                <span className="text-sm text-zinc-400 font-medium">
                  {profile.github_username[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-200 font-medium truncate">@{profile.github_username}</div>
              <Badge variant={`plan-${profile.plan}`} className="mt-0.5 capitalize">{profile.plan}</Badge>
            </div>
            <button
              onClick={signOut}
              className="shrink-0 text-zinc-600 hover:text-zinc-400 transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
