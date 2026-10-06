// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import '@fontsource/inter-tight/latin-400.css';
import '@fontsource/inter-tight/latin-600.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './agent-window.css';
import { CHAKRA_SPOKES, CHAKRA_TEETH } from '../lib/chakra';
import { PLATFORMS, tokensShort } from '../lib/format';
import type { AgentEvent, JobStats, LlmUsage, Settings } from '../lib/types';
import { signConsole } from '../lib/signature';

interface Status {
  running: boolean;
  phase: 'stopped' | 'idle' | 'discovering' | 'applying' | 'waiting' | 'sleeping';
  currentJob: { title: string; company: string } | null;
  nextApplyAt: string | null;
  nextDiscoveryAt: string | null;
  lastDiscoveryAt: string | null;
  llm: string | null;
  queue: number;
  awaitingReview: number;
  blockedSources: { source: string; reason: string }[];
  openQuestions: number;
  appliedToday: number;
}

type Tone = 'work' | 'idle' | 'attention' | 'offline';
interface View {
  tone: Tone;
  label: string;
  headline: string;
  detail: string;
  spinning: boolean;
}

const POLL_MS = 3000;
const byId = (id: string) => document.getElementById(id)!;

function applyTheme(): void {
  let theme: string | null = null;
  try {
    theme = localStorage.getItem('jaa-theme');
  } catch {
    // Storage can be blocked; fall back to the system setting.
  }
  const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function drawChakra(): void {
  const spokes = CHAKRA_SPOKES.map(
    (a) =>
      `<line x1="${(Math.cos(a) * 2.6).toFixed(2)}" y1="${(Math.sin(a) * 2.6).toFixed(2)}" x2="${(Math.cos(a) * 7.6).toFixed(2)}" y2="${(Math.sin(a) * 7.6).toFixed(2)}"/>`,
  ).join('');
  byId('chakra').innerHTML =
    `<svg viewBox="-16 -16 32 32" role="img" aria-label="Sudarshan Chakra">` +
    `<polygon points="${CHAKRA_TEETH}" fill="var(--accent)"/>` +
    `<circle r="10.6" fill="var(--chakra-core)"/>` +
    `<circle r="7.6" fill="none" stroke="var(--accent)" stroke-width="1.3"/>` +
    `<g stroke="var(--accent)" stroke-width="0.9" stroke-linecap="round">${spokes}</g>` +
    `<circle r="2.5" fill="var(--accent)"/><circle r="0.9" fill="var(--chakra-core)"/></svg>`;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function seconds(iso: string | null): number | null {
  if (!iso) return null;
  const secs = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  return secs > 0 ? secs : null;
}

function describe(s: Status): View {
  if (!s.running) {
    return {
      tone: 'idle',
      label: 'Resting',
      headline: 'Sudarshan is <em>resting</em>.',
      detail: 'Press Start agent on Lakshya and this window comes to life.',
      spinning: false,
    };
  }
  switch (s.phase) {
    case 'applying':
      return {
        tone: 'work',
        label: 'Applying',
        headline: s.currentJob
          ? `Applying to <em>${escape(s.currentJob.title)}</em> at ${escape(s.currentJob.company)}.`
          : 'Filling an <em>application</em>.',
        detail: 'Watch it in the tab that just opened. Leave the form to Sudarshan until it moves on.',
        spinning: true,
      };
    case 'discovering':
      return {
        tone: 'work',
        label: 'Searching',
        headline: 'Looking for <em>new jobs</em>.',
        detail: 'Searching LinkedIn and Naukri for your job titles and locations.',
        spinning: true,
      };
    case 'waiting': {
      const wait = seconds(s.nextApplyAt);
      return {
        tone: 'work',
        label: 'Pausing',
        headline: 'Taking a <em>short breath</em>.',
        detail:
          (wait ? `Next application in about ${wait < 90 ? `${wait} seconds` : `${Math.round(wait / 60)} minutes`}. ` : '') +
          'Gaps between applications keep your accounts safe.',
        spinning: true,
      };
    }
    case 'sleeping':
      return {
        tone: 'idle',
        label: 'Off hours',
        headline: 'Outside your <em>active hours</em>.',
        detail: 'Sudarshan picks up again when your active hours start. Change them in Settings.',
        spinning: false,
      };
    default:
      if (s.queue > 0 && s.blockedSources.some((b) => /log in/i.test(b.reason))) {
        const sites = s.blockedSources
          .filter((b) => /log in/i.test(b.reason))
          .map((b) => ({ linkedin: 'LinkedIn', naukri: 'Naukri' })[b.source] ?? b.source);
        return {
          tone: 'attention',
          label: 'Log in needed',
          headline: `Log in to <em>${sites.join(' and ')}</em> to continue.`,
          detail: `${s.queue} approved job${s.queue === 1 ? ' is' : 's are'} waiting. Open a new tab in this window, sign in, and Sudarshan picks them up within a couple of minutes.`,
          spinning: false,
        };
      }
      if (s.queue === 0 && s.awaitingReview > 0) {
        return {
          tone: 'attention',
          label: 'Needs your approval',
          headline: `<em>${s.awaitingReview} job${s.awaitingReview === 1 ? '' : 's'}</em> waiting for your approval.`,
          detail: 'Sudarshan applies only to jobs you approve. Open Review, approve the ones you want, and it starts on them right away.',
          spinning: true,
        };
      }
      if (s.openQuestions > 0) {
        return {
          tone: 'attention',
          label: 'Needs you',
          headline: `Waiting for <em>your answer</em>.`,
          detail: `${s.openQuestions} question${s.openQuestions === 1 ? '' : 's'} only you can answer. Answer once and every waiting job continues.`,
          spinning: true,
        };
      }
      return {
        tone: 'work',
        label: 'On watch',
        headline: s.queue ? 'Getting the <em>next job</em> ready.' : 'On watch for <em>approved jobs</em>.',
        detail: s.queue
          ? `${s.queue} approved job${s.queue === 1 ? '' : 's'} in the queue.`
          : 'Approve jobs in Review and Sudarshan applies to them one by one.',
        spinning: true,
      };
  }
}

function render(view: View, s: Status | null): void {
  document.body.dataset.tone = view.tone;
  byId('state-label').textContent = view.label;
  byId('headline').innerHTML = view.headline;
  byId('detail').textContent = view.detail;
  const chakra = byId('chakra');
  chakra.classList.toggle('spinning', view.spinning);
  chakra.classList.toggle('resting', !view.spinning);
  document.title = view.tone === 'offline' ? 'Sudarshan' : `Sudarshan · ${view.label}`;

  byId('review-link').hidden = !s || s.queue > 0 || s.awaitingReview === 0;
  byId('questions-link').hidden = !s || s.openQuestions === 0;
  if (!s) return;
  byId('queue').textContent = String(s.queue);
  byId('review').textContent = String(s.awaitingReview);
  byId('questions').textContent = String(s.openQuestions);
  byId('questions').classList.toggle('hot', s.openQuestions > 0);
  byId('next-apply').textContent = s.running ? until(s.nextApplyAt) : '–';
  byId('next-search').textContent = s.running ? until(s.nextDiscoveryAt) : '–';
  byId('last-search').textContent = ago(s.lastDiscoveryAt);
  byId('model').textContent = s.llm ?? 'No AI (memory only)';
}


function renderToday(stats: JobStats, settings: Settings | null): void {
  byId('applied').textContent = String(stats.appliedToday);
  byId('total').textContent = stats.appliedTotal.toLocaleString();
  byId('memory').textContent = stats.memoryHitRate === null ? '–' : `${Math.round(stats.memoryHitRate * 100)}%`;
  byId('speed').textContent = stats.medianApplySeconds === null ? '–' : duration(stats.medianApplySeconds);
  byId('today-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  byId('sites').replaceChildren(
    ...PLATFORMS.map(({ key, label, setting }) => {
      const done = stats.appliedTodayByPlatform[key] ?? 0;
      const cfg = settings?.sources[setting];
      const limit = cfg?.enabled ? cfg.dailyLimit : 0;
      const li = document.createElement('li');
      li.classList.toggle('off', cfg?.enabled === false);
      const row = document.createElement('div');
      row.className = 'site-row';
      const name = document.createElement('span');
      name.textContent = label;
      const count = document.createElement('b');
      count.textContent = cfg?.enabled === false ? 'Off' : limit ? `${done} / ${limit}` : String(done);
      row.append(name, count);
      const bar = document.createElement('div');
      bar.className = limit && done >= limit ? 'bar full' : 'bar';
      const fill = document.createElement('i');
      fill.style.width = `${limit ? Math.min(100, (done / limit) * 100) : 0}%`;
      bar.append(fill);
      li.append(row, bar);
      return li;
    }),
  );
}

function renderUsage(u: LlmUsage): void {
  byId('ai-today').textContent = tokensShort(u.today.tokens);
  byId('ai-month').textContent = tokensShort(u.month.tokens);
  byId('ai-all').textContent = tokensShort(u.allTime.tokens);
  byId('ai-calls').textContent =
    `${u.allTime.calls.toLocaleString()} AI calls in total` + (u.allTime.since ? ` since ${new Date(u.allTime.since).toLocaleDateString()}` : '');
}

// The feed shows outcomes, not every form step.
const noteworthy = (e: AgentEvent) => e.level !== 'info' || /^(Applying:|Searching now|Agent (started|stopped))/.test(e.message);
const MARK: Record<AgentEvent['level'], string> = { success: '✓', warn: '!', error: '✕', info: '·' };

function renderFeed(events: AgentEvent[], s: Status | null): void {
  const items = events.filter(noteworthy).slice(-40).reverse();
  if (items.length) {
    byId('feed').replaceChildren(
      ...items.map((e) => {
        const li = document.createElement('li');
        li.className = e.level;
        const time = document.createElement('time');
        time.textContent = new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const mark = document.createElement('span');
        mark.className = 'mark';
        mark.textContent = MARK[e.level];
        const text = document.createElement('span');
        text.textContent = e.message;
        li.append(time, mark, text);
        return li;
      }),
    );
  }
  // The latest step of the application in progress.
  const step = s?.phase === 'applying' ? [...events].reverse().find((e) => /^(Step \d+|Naukri:)/.test(e.message)) : undefined;
  byId('now').hidden = !step;
  if (step) byId('now').textContent = step.message;
}

function duration(sec: number): string {
  return sec < 90 ? `${Math.round(sec)}s` : `${Math.round(sec / 60)} min`;
}

function until(iso: string | null): string {
  const secs = seconds(iso);
  if (secs === null) return '–';
  return secs < 60 ? `in ${secs}s` : secs < 3600 ? `in ${Math.round(secs / 60)} min` : `in ${Math.round(secs / 3600)} h`;
}

function ago(iso: string | null): string {
  if (!iso) return '–';
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  return secs < 60 ? 'just now' : secs < 3600 ? `${Math.round(secs / 60)} min ago` : `${Math.round(secs / 3600)} h ago`;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(String(res.status));
  return ((await res.json()) as { data: T }).data;
}

let tick = 0;
async function poll(): Promise<void> {
  try {
    const status = await get<Status>('/agent/status');
    render(describe(status), status);
    // Heavier numbers every third poll.
    if (tick++ % 3 === 0) {
      const [stats, settings, usage, events] = await Promise.all([
        get<JobStats>('/jobs/stats'),
        get<Settings>('/settings').catch(() => null),
        get<LlmUsage>('/llm/usage').catch(() => null),
        get<AgentEvent[]>('/events/recent?limit=300').catch(() => []),
      ]);
      renderToday(stats, settings);
      if (usage) renderUsage(usage);
      renderFeed(events, status);
    }
  } catch {
    tick = 0;
    render(
      {
        tone: 'offline',
        label: 'Not connected',
        headline: 'Can’t reach <em>Sudarshan</em>.',
        detail: 'Is it still running in your terminal? Start it again with npm start and this page reconnects by itself.',
        spinning: false,
      },
      null,
    );
  }
}

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
drawChakra();
void poll();
setInterval(() => void poll(), POLL_MS);

signConsole();
