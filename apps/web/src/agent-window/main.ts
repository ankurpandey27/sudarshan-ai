// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import '@fontsource-variable/geist';
import '@fontsource/jetbrains-mono/latin-400.css';
import './agent-window.css';
import { CHAKRA_SPOKES, CHAKRA_TEETH } from '../lib/chakra';
import { PLATFORMS, platformLabel, tokensShort } from '../lib/format';
import type { AgentEvent, JobStats, LlmUsage, Settings } from '../lib/types';
import { signConsole } from '../lib/signature';

interface Status {
  running: boolean;
  phase: 'stopped' | 'idle' | 'discovering' | 'applying' | 'waiting' | 'sleeping';
  currentJob: { title: string; company: string; platform?: string } | null;
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
}

const POLL_MS = 3000;
const SVG_NS = 'http://www.w3.org/2000/svg';
const RIM = 178;
const byId = (id: string) => document.getElementById(id)!;

const SUN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

/** The saved choice (the same key as the app), or the computer's setting when there is none. */
function savedTheme(): 'light' | 'dark' | null {
  try {
    const theme = localStorage.getItem('jaa-theme');
    return theme === 'dark' || theme === 'light' ? theme : null;
  } catch {
    // Storage can be blocked; fall back to the system setting.
    return null;
  }
}

function applyTheme(): void {
  const dark = (savedTheme() ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  // The button shows what it switches to: a sun in the dark, a moon in the light - as in the app.
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.innerHTML = dark ? SUN : MOON;
    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  }
}

/** This window runs in the agent's own browser, which does not share the app's saved choice - so it has its own switch. */
function toggleTheme(): void {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem('jaa-theme', next);
  } catch {
    // Not remembered - it still switches for now.
  }
  document.documentElement.dataset.theme = next;
  applyTheme();
}

/** The chakra itself, in a -16..16 box, for the brand mark and the centre of the orbit. */
function chakraMarkup(): string {
  const spokes = CHAKRA_SPOKES.map(
    (angle) =>
      `<line x1="${(Math.cos(angle) * 2.6).toFixed(2)}" y1="${(Math.sin(angle) * 2.6).toFixed(2)}" x2="${(Math.cos(angle) * 7.6).toFixed(2)}" y2="${(Math.sin(angle) * 7.6).toFixed(2)}"/>`,
  ).join('');
  return (
    `<polygon points="${CHAKRA_TEETH}" style="fill:var(--accent)"/>` +
    `<circle r="10.6" style="fill:var(--surface)"/>` +
    `<circle r="7.6" fill="none" stroke-width="1.3" style="stroke:var(--accent)"/>` +
    `<g stroke-width="0.9" stroke-linecap="round" style="stroke:var(--accent)">${spokes}</g>` +
    `<circle r="2.5" style="fill:var(--accent)"/>`
  );
}

const point = (radius: number, angle: number) => [radius * Math.cos(angle), radius * Math.sin(angle)] as const;
function arc(radius: number, from: number, to: number): string {
  const [x0, y0] = point(radius, from);
  const [x1, y1] = point(radius, to);
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${radius} ${radius} 0 ${to - from > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
const span = (index: number) => {
  const width = (2 * Math.PI) / PLATFORMS.length;
  const from = -Math.PI / 2 + index * width + 0.06;
  return { from, to: from + width - 0.12 };
};

/**
 * The orbit: the chakra in the middle, a sweep while the agent runs, queued jobs circling close in and jobs to
 * review further out, each site's daily limit as an arc on the rim, and a comet while an application is in flight.
 */
function drawOrbit(): void {
  byId('brand-mark').innerHTML = `<svg viewBox="-16 -16 32 32" aria-hidden="true">${chakraMarkup()}</svg>`;
  const rims = PLATFORMS.map((platform, index) => {
    const { from, to } = span(index);
    const [lx, ly] = point(RIM + 15, (from + to) / 2);
    return (
      `<path d="${arc(RIM, from, to)}" fill="none" stroke-width="5" stroke-linecap="round" style="stroke:var(--line)"/>` +
      `<path id="rim-${platform.key}" fill="none" stroke-width="5" stroke-linecap="round" style="stroke:var(--p-${platform.key});filter:drop-shadow(0 0 4px var(--p-${platform.key}))"/>` +
      `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${platform.label.toUpperCase()}</text>`
    );
  }).join('');
  const [sx, sy] = point(RIM - 10, -0.5);
  const [ex, ey] = point(RIM - 10, 0);
  byId('orbit').innerHTML =
    `<svg viewBox="-215 -215 430 430" role="img" aria-label="Sudarshan AI's orbit: today's applications against each site's limit">` +
    `<defs><radialGradient id="core"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.5"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></radialGradient>` +
    `<linearGradient id="sweep" x1="0" x2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:0"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:.22"/></linearGradient>` +
    `<linearGradient id="tail" x1="0" x2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:0"/><stop offset="1" style="stop-color:var(--accent)"/></linearGradient></defs>` +
    [60, 100, 140].map((radius) => `<circle r="${radius}" fill="none" stroke-dasharray="${radius === 100 ? '0' : '2 5'}" style="stroke:var(--line)"/>`).join('') +
    `<g class="sweep spin"><path d="M 0 0 L ${sx.toFixed(1)} ${sy.toFixed(1)} A ${RIM - 10} ${RIM - 10} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)} Z" fill="url(#sweep)"/></g>` +
    `<g class="satellites outer spin" id="sat-review"></g>` +
    `<g class="satellites spin" id="sat-queue"></g>` +
    rims +
    `<g class="comet"><g id="comet-angle"><g class="comet-body"><line x1="-46" y1="0" x2="34" y2="0" stroke-width="2.6" stroke-linecap="round" stroke="url(#tail)"/><circle cx="34" r="4.5" style="fill:var(--accent);filter:drop-shadow(0 0 6px var(--accent))"/></g></g></g>` +
    `<circle r="70" fill="url(#core)"/>` +
    `<g transform="scale(2.4)"><g class="chakra-group">${chakraMarkup()}</g></g>` +
    `</svg>`;
}

/** Small dots circling the chakra: one per queued job (inner ring), and jobs to review (outer ring). */
function drawSatellites(id: string, count: number, radius: number, size: number, opacity: number): void {
  const group = byId(id);
  const shown = Math.min(count, id === 'sat-queue' ? 24 : 40);
  if (group.dataset.count === String(shown)) return;
  group.dataset.count = String(shown);
  group.replaceChildren(
    ...Array.from({ length: shown }, (_, index) => {
      const [x, y] = point(radius, (index / Math.max(1, shown)) * 2 * Math.PI + (id === 'sat-queue' ? 0 : 0.3));
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', x.toFixed(1));
      dot.setAttribute('cy', y.toFixed(1));
      dot.setAttribute('r', String(size));
      dot.style.fill = 'var(--accent)';
      dot.style.opacity = String(opacity);
      return dot;
    }),
  );
}

/** The comet flies to the arc of the site it is applying on - the arc that grows when it lands. */
function aimComet(job: Status['currentJob']): void {
  const index = PLATFORMS.findIndex((platform) => platform.key === job?.platform);
  const { from, to } = span(index < 0 ? PLATFORMS.length - 1 : index);
  byId('comet-angle').setAttribute('transform', `rotate(${(((from + to) / 2) * 180) / Math.PI})`);
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
      headline: 'Sudarshan AI is <em>resting</em>.',
      detail: 'Press Start agent on Lakshya and this window comes to life: tabs open here as it searches and applies.',
    };
  }
  switch (s.phase) {
    case 'applying':
      return {
        tone: 'work',
        label: 'Applying',
        headline: s.currentJob ? `Applying to <em>${escape(s.currentJob.title)}</em> at ${escape(s.currentJob.company)}.` : 'Filling an <em>application</em>.',
        detail: 'Watch it in the tab that just opened. Leave the form to Sudarshan AI until it moves on.',
      };
    case 'discovering':
      return {
        tone: 'work',
        label: 'Searching',
        headline: 'Looking for <em>new jobs</em>.',
        detail: 'Searching the job sites you switched on for your job titles and locations. New jobs are scored and wait for you in Review.',
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
      };
    }
    case 'sleeping':
      return {
        tone: 'idle',
        label: 'Off hours',
        headline: 'Outside your <em>active hours</em>.',
        detail: 'Sudarshan AI picks up again when your active hours start. Change them in Settings → Agent.',
      };
    default: {
      const logins = s.blockedSources.filter((block) => /log in/i.test(block.reason));
      if (s.queue > 0 && logins.length) {
        const sites = logins.map((block) => platformLabel(block.source));
        return {
          tone: 'attention',
          label: 'Log in needed',
          headline: `Log in to <em>${escape(sites.join(' and '))}</em> to continue.`,
          detail: `${s.queue} approved job${s.queue === 1 ? ' is' : 's are'} waiting. Open a new tab in this window and sign in (or use Settings → Site logins); Sudarshan AI picks them up within a couple of minutes.`,
        };
      }
      if (s.queue === 0 && s.awaitingReview > 0) {
        return {
          tone: 'attention',
          label: 'Needs your approval',
          headline: `<em>${s.awaitingReview} job${s.awaitingReview === 1 ? '' : 's'}</em> waiting for your approval.`,
          detail: 'Sudarshan AI applies only to jobs you approve. Approve them in Review, on the radar, or in one sentence with the command bar.',
        };
      }
      if (s.openQuestions > 0) {
        return {
          tone: 'attention',
          label: 'Needs you',
          headline: 'Waiting for <em>your answer</em>.',
          detail: `${s.openQuestions} question${s.openQuestions === 1 ? '' : 's'} only you can answer. Answer once and every waiting job continues.`,
        };
      }
      return {
        tone: 'work',
        label: 'On watch',
        headline: s.queue ? 'Getting the <em>next job</em> ready.' : 'On watch for <em>approved jobs</em>.',
        detail: s.queue ? `${s.queue} approved job${s.queue === 1 ? '' : 's'} in the queue.` : 'Approve jobs in Review and Sudarshan AI applies to them one by one.',
      };
    }
  }
}

function render(view: View, s: Status | null): void {
  const body = document.body;
  body.dataset.tone = view.tone;
  body.dataset.running = String(!!s?.running);
  body.dataset.phase = s?.running ? s.phase : 'stopped';
  body.dataset.busy = String(s?.phase === 'applying' || s?.phase === 'discovering');
  byId('state-label').textContent = view.label;
  byId('eyebrow').textContent = view.tone === 'offline' ? 'Not connected' : `Mission status · ${view.label}`;
  byId('headline').innerHTML = view.headline;
  byId('detail').textContent = view.detail;
  document.title = view.tone === 'offline' ? 'Sudarshan AI' : `Sudarshan AI · ${view.label}`;

  byId('review-link').hidden = !s || s.queue > 0 || s.awaitingReview === 0;
  byId('questions-link').hidden = !s || s.openQuestions === 0;
  if (!s) return;
  aimComet(s.phase === 'applying' ? s.currentJob : null);
  drawSatellites('sat-queue', s.queue, 100, 3.4, 0.95);
  drawSatellites('sat-review', s.awaitingReview, 140, 2.2, 0.4);
  byId('queue').textContent = String(s.queue);
  byId('review').textContent = String(s.awaitingReview);
  byId('questions').textContent = String(s.openQuestions);
  byId('questions').classList.toggle('hot', s.openQuestions > 0);
  byId('next-apply').textContent = s.running ? until(s.nextApplyAt) : '–';
  byId('next-search').textContent = s.running ? until(s.nextDiscoveryAt) : '–';
  byId('last-search').textContent = ago(s.lastDiscoveryAt);
  byId('model').textContent = s.llm ?? 'No AI (memory only)';
}

let lastApplied = -1;
function renderToday(stats: JobStats, settings: Settings | null): void {
  const applied = byId('applied');
  applied.textContent = String(stats.appliedToday);
  if (lastApplied >= 0 && stats.appliedToday > lastApplied) {
    applied.classList.remove('bump');
    void applied.offsetWidth;
    applied.classList.add('bump');
  }
  lastApplied = stats.appliedToday;
  byId('total').textContent = stats.appliedTotal.toLocaleString();
  byId('memory').textContent = stats.memoryHitRate === null ? '–' : `${Math.round(stats.memoryHitRate * 100)}%`;
  byId('speed').textContent = stats.medianApplySeconds === null ? '–' : duration(stats.medianApplySeconds);
  byId('today-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  byId('sites').replaceChildren(
    ...PLATFORMS.map(({ key, label, setting }, index) => {
      const done = stats.appliedTodayByPlatform[key] ?? 0;
      const cfg = settings?.sources[setting];
      const limit = cfg?.enabled ? cfg.dailyLimit : 0;
      const used = limit ? Math.min(1, done / limit) : 0;
      const { from, to } = span(index);
      const rim = document.getElementById(`rim-${key}`);
      if (rim) {
        rim.setAttribute('d', used > 0 ? arc(RIM, from, from + (to - from) * used) : '');
        rim.style.stroke = used >= 1 ? 'var(--warn)' : `var(--p-${key})`;
      }
      const li = document.createElement('li');
      li.classList.toggle('off', cfg?.enabled === false);
      const row = document.createElement('div');
      row.className = 'site-row';
      const name = document.createElement('span');
      const dot = document.createElement('i');
      dot.style.background = `var(--p-${key})`;
      name.append(dot, label);
      const count = document.createElement('b');
      count.textContent = cfg?.enabled === false ? 'Off' : limit ? `${done} / ${limit}` : String(done);
      row.append(name, count);
      const bar = document.createElement('div');
      bar.className = limit && done >= limit ? 'bar full' : 'bar';
      const fill = document.createElement('i');
      fill.style.width = `${used * 100}%`;
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
let newestShown = 0;

function renderFeed(events: AgentEvent[], s: Status | null): void {
  const items = events.filter(noteworthy).slice(-40).reverse();
  if (items.length) {
    const previous = newestShown;
    byId('feed').replaceChildren(
      ...items.map((e) => {
        const li = document.createElement('li');
        li.className = e.level;
        // Only lines that arrived since the last look slide in.
        if (previous && e.id > previous) li.classList.add('new');
        const time = document.createElement('time');
        time.textContent = new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const text = document.createElement('span');
        text.textContent = e.message;
        li.append(time, text);
        return li;
      }),
    );
    newestShown = Math.max(...items.map((e) => e.id));
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
        headline: 'Can’t reach <em>Sudarshan AI</em>.',
        detail: 'Is it still running in your terminal? Start it again with npm start and this page reconnects by itself.',
      },
      null,
    );
  }
}

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
byId('theme-toggle').addEventListener('click', toggleTheme);
// Switched in another tab of this browser (the app opened here): follow it.
window.addEventListener('storage', (event) => {
  if (event.key === 'jaa-theme') applyTheme();
});
drawOrbit();
void poll();
setInterval(() => void poll(), POLL_MS);

signConsole();
