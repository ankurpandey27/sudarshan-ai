// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { BookOpenCheck, Briefcase, Inbox, Menu, MessageCircleQuestion, ScrollText, Moon, Settings2, Sun, Target, UserRound, X } from 'lucide-react';
import { cn } from '../lib/format';
import { useEvents } from '../lib/events';
import { useAgent, useStats } from '../lib/queries';
import { useTheme } from '../lib/theme';
import { AgentToggle } from './agent-toggle';
import { SudarshanMark } from './sudarshan-logo';
import { ScoringProgress } from './scoring-progress';

function Item({ to, icon, label, count, tone }: { to: string; icon: ReactNode; label: string; count?: number; tone?: 'warn' }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors',
          isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        )
      }
    >
      <span className="text-ink-3">{icon}</span>
      <span className="flex-1">{label}</span>
      {!!count && (
        <span
          className={cn(
            'tabular rounded-md px-1.5 text-[11.5px] font-semibold',
            tone === 'warn' ? 'bg-warn text-white dark:text-black' : 'bg-surface-2 text-ink-2',
          )}
        >
          {count}
        </span>
      )}
    </NavLink>
  );
}

export function Layout() {
  const [theme, toggleTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const { data: agent } = useAgent();
  const { data: stats } = useStats();
  const { connected } = useEvents();

  const nav = (
    <nav className="flex flex-col gap-0.5" onClick={() => setOpen(false)}>
      <Item to="/" icon={<Target className="size-4" />} label="Lakshya" />
      <Item to="/review" icon={<Inbox className="size-4" />} label="Review" count={stats?.byStatus.review} />
      <Item to="/questions" icon={<MessageCircleQuestion className="size-4" />} label="Questions" count={agent?.openQuestions} tone="warn" />
      <Item to="/applications" icon={<Briefcase className="size-4" />} label="Applications" count={stats?.appliedTotal} />
      <Item to="/answers" icon={<BookOpenCheck className="size-4" />} label="Answer memory" />
      <Item to="/activity" icon={<ScrollText className="size-4" />} label="Flight log" />
      <Item to="/profile" icon={<UserRound className="size-4" />} label="Profile" />
      <Item to="/settings" icon={<Settings2 className="size-4" />} label="Settings" />
    </nav>
  );

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-bg px-3 py-4 md:flex">
        <Brand spinning={agent?.running} />
        <div className="mt-6 flex-1">{nav}</div>
        <AgentToggle />
        <Footer theme={theme} toggleTheme={toggleTheme} connected={connected} />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b border-line bg-bg/95 px-4 backdrop-blur md:hidden">
        <Brand spinning={agent?.running} />
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-1.5 hover:bg-surface-2">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-bg px-3 py-4 shadow-card">
            <div className="flex items-center justify-between">
              <Brand spinning={agent?.running} />
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-surface-2">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-6 flex-1">{nav}</div>
            <AgentToggle />
            <Footer theme={theme} toggleTheme={toggleTheme} connected={connected} />
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto pt-12 md:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <ScoringProgress />
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Brand({ spinning }: { spinning?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-1" title="Sudarshan - goes out, finishes the task, returns">
      <SudarshanMark size={30} spinning={spinning} />
      <span className="leading-tight">
        <span className="block font-display text-[21px] leading-none tracking-tight">Sudarshan</span>
        <span className="mt-0.5 block text-[11px] text-ink-3">goes out · finishes · returns</span>
      </span>
    </div>
  );
}

function Footer({ theme, toggleTheme, connected }: { theme: string; toggleTheme: () => void; connected: boolean }) {
  return (
    <div className="mt-3 flex items-center justify-between px-1 text-[11.5px] text-ink-3">
      <span className="flex items-center gap-1.5" title={connected ? 'Live updates connected' : 'Reconnecting to the agent...'}>
        <span className={cn('size-1.5 rounded-full', connected ? 'bg-good' : 'bg-bad')} />
        {connected ? 'live' : 'offline'}
      </span>
      <button onClick={toggleTheme} aria-label="Toggle dark mode" className="rounded-md p-1 hover:bg-surface-2 hover:text-ink">
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>
    </div>
  );
}
