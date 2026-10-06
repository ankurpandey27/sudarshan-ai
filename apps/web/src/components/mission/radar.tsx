// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useMemo, useRef, useState } from 'react';
import { CHAKRA_TEETH, CHAKRA_SPOKES } from '../../lib/chakra';
import { useEvents } from '../../lib/events';
import { cn, platformLabel, timeAgo } from '../../lib/format';
import type { Job, JobStatus } from '../../lib/types';
import { PLATFORM_COLOR } from '../platform-badge';
import { ScoreDial } from '../ui';

const SIZE = 760;
const CENTER = SIZE / 2;
const RIM = 338;
const BANDS = [90, 80, 70, 50] as const;

/** Closer to the chakra is a better match: 100 sits just outside it, 40 and below at the edge. */
const radiusFor = (score: number | null) => 58 + (100 - Math.max(40, Math.min(100, score ?? 40))) * (250 / 60);

/** A stable 0..1 number per job, so a job keeps its place on the radar between visits. */
function spread(id: number, salt = 0): number {
  let mixed = Math.imul(id ^ (salt * 0x9e3779b1), 0x85ebca6b);
  mixed ^= mixed >>> 13;
  mixed = Math.imul(mixed, 0xc2b2ae35);
  mixed ^= mixed >>> 16;
  return (mixed >>> 0) / 0xffffffff;
}

/** Your country on the left, abroad on the right, "not said" in a wedge at the bottom. */
function angleFor(job: Pick<Job, 'id' | 'region'>): number {
  const along = 0.14 + spread(job.id) * 0.8;
  if (job.region === 'home') return Math.PI / 2 + along * Math.PI;
  if (job.region === 'abroad') return -Math.PI / 2 + along * Math.PI;
  return Math.PI / 2 + (spread(job.id, 1) - 0.5) * 0.6;
}

const pointAt = (radius: number, angle: number) => ({ x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) });
const normalize = (angle: number) => ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

function arcPath(radius: number, from: number, to: number): string {
  const start = pointAt(radius, from);
  const end = pointAt(radius, to);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${to - from > Math.PI ? 1 : 0} 1 ${end.x} ${end.y}`;
}

export interface SiteLimit {
  key: string;
  label: string;
  color: string;
  done: number;
  limit: number;
  enabled: boolean;
}

export type RadarAction = 'approve' | 'skip' | 'dismiss' | 'unqueue' | 'apply-now';

interface Flight {
  jobId: number;
  angle: number;
  startedAt: number;
  endedAt: number | null;
  outcome: 'applied' | 'stopped' | 'failed' | null;
  line: SVGLineElement;
  head: SVGCircleElement;
  gradient: SVGLinearGradientElement;
  reachedAt: number;
}

/** How an application ended, from the job's new status: anything but "applying" ends its flight. */
const outcomeOf = (status: JobStatus | undefined): Flight['outcome'] =>
  !status || status === 'applying' ? null : status === 'applied' ? 'applied' : status === 'failed' ? 'failed' : 'stopped';
/** A flight with no word for this long ends anyway - the page may have missed the event. */
const STALE_FLIGHT_MS = 15 * 60_000;
const OUTCOME_COLOR = { applied: 'var(--good)', failed: 'var(--bad)', stopped: 'var(--warn)' } as const;

/**
 * Lakshya's radar: every job Sudarshan is weighing is a dot. Rings are score bands, the left half is your country,
 * the right half abroad. While the agent runs, a sweep circles and lights the jobs it passes; each application flies
 * out from the chakra as a comet and lands on the rim - green when it went through.
 */
export function Radar({
  jobs,
  running,
  phase,
  applyingJobId,
  applyingPlatform,
  limits,
  country,
  highlight,
  onAct,
  busy,
}: {
  jobs: Job[];
  running: boolean;
  phase: string;
  applyingJobId: number | null;
  /** The site of the job being applied to. */
  applyingPlatform?: string | null;
  limits: SiteLimit[];
  country: string | null;
  /** Jobs the command bar matches; the rest dim. Null: no filter. */
  highlight: Set<number> | null;
  onAct: (action: RadarAction, job: Job) => void;
  busy: boolean;
}) {
  const { events } = useEvents();
  const sweepRef = useRef<SVGGElement>(null);
  const chakraRef = useRef<SVGGElement>(null);
  const cometLayer = useRef<SVGGElement>(null);
  const defsRef = useRef<SVGDefsElement>(null);
  const dots = useRef(new Map<number, { el: SVGCircleElement; angle: number }>());
  const flights = useRef(new Map<number, Flight>());
  const seenEvent = useRef<number | null>(null);
  const known = useRef<Set<number> | null>(null);
  const live = useRef({ running, phase });
  live.current = { running, phase };
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const still = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  const placed = useMemo(
    () =>
      jobs.map((job) => {
        const angle = angleFor(job);
        const radius = radiusFor(job.score) + (spread(job.id, 2) - 0.5) * 14;
        return { job, angle, ...pointAt(radius, angle) };
      }),
    [jobs],
  );
  // Jobs that arrived since the page opened grow in; the first load does not.
  const born = known.current ? new Set(jobs.filter((job) => !known.current!.has(job.id)).map((job) => job.id)) : new Set<number>();
  useEffect(() => {
    known.current = new Set(jobs.map((job) => job.id));
  }, [jobs]);

  const counts = useMemo(() => {
    const tally = { home: 0, abroad: 0, unknown: 0 };
    for (const job of jobs) tally[job.region === 'home' ? 'home' : job.region === 'abroad' ? 'abroad' : 'unknown']++;
    return tally;
  }, [jobs]);

  // --- comets: one per application, from the events the agent sends
  // Each comet flies to its own site's arc on the rim - the arc that grows when it lands. Aiming at the job's dot
  // sent an Indian LinkedIn job towards Hirist's arc on the left (2026-10-06).
  const limitsRef = useRef(limits);
  limitsRef.current = limits;
  const siteAngle = (platform: string | undefined): number | null => {
    const index = limitsRef.current.findIndex((site) => site.key === platform);
    if (index < 0) return null;
    const span = (2 * Math.PI) / limitsRef.current.length;
    return -Math.PI / 2 + (index + 0.5) * span;
  };
  const launch = (jobId: number, platform?: string) => {
    if (flights.current.has(jobId) || !cometLayer.current || !defsRef.current) return;
    const svgNs = 'http://www.w3.org/2000/svg';
    const gradient = document.createElementNS(svgNs, 'linearGradient');
    gradient.id = `comet-${jobId}`;
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    const fade = document.createElementNS(svgNs, 'stop');
    fade.setAttribute('offset', '0');
    fade.style.stopColor = 'var(--accent)';
    fade.style.stopOpacity = '0';
    const bright = document.createElementNS(svgNs, 'stop');
    bright.setAttribute('offset', '1');
    bright.style.stopColor = 'var(--accent)';
    gradient.append(fade, bright);
    defsRef.current.appendChild(gradient);
    const line = document.createElementNS(svgNs, 'line');
    line.setAttribute('stroke', `url(#comet-${jobId})`);
    line.setAttribute('stroke-width', '2.6');
    line.setAttribute('stroke-linecap', 'round');
    const head = document.createElementNS(svgNs, 'circle');
    head.setAttribute('r', '4.5');
    head.style.fill = 'var(--accent)';
    head.style.filter = 'drop-shadow(0 0 6px var(--accent))';
    cometLayer.current.append(line, head);
    const job = jobs.find((candidate) => candidate.id === jobId);
    const angle = siteAngle(platform ?? job?.platform) ?? (job ? angleFor(job) : angleFor({ id: jobId, region: null }));
    flights.current.set(jobId, { jobId, angle, startedAt: performance.now(), endedAt: null, outcome: null, line, head, gradient, reachedAt: 0 });
  };

  useEffect(() => {
    if (!events.length) return;
    const newest = events[0].id;
    if (seenEvent.current === null) {
      seenEvent.current = newest;
      return;
    }
    const fresh = events.filter((event) => event.id > seenEvent.current!).reverse();
    seenEvent.current = Math.max(seenEvent.current, newest);
    for (const event of fresh) {
      if (event.type === 'apply.step' && event.jobId && /^(Applying|Continuing):/.test(event.message)) launch(event.jobId, event.source);
      if (event.type === 'job.updated') {
        // One job ("… -> applied", with its id) or several at once ({ ids, status }).
        const outcome = outcomeOf(event.data?.status as JobStatus | undefined);
        const ids = event.jobId ? [event.jobId] : ((event.data?.ids as number[] | undefined) ?? []);
        for (const id of ids) {
          const flight = flights.current.get(id);
          if (flight && outcome && flight.endedAt === null) {
            flight.endedAt = performance.now();
            flight.outcome = outcome;
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // The job being applied to when the page opened gets its comet too - and is re-aimed at its site's arc once the
  // site is known (a comet launched before it flew towards the job's dot instead, 2026-10-06).
  useEffect(() => {
    if (!applyingJobId) return;
    const flight = flights.current.get(applyingJobId);
    const angle = siteAngle(applyingPlatform ?? undefined);
    if (flight && angle !== null && flight.endedAt === null) flight.angle = angle;
    else if (!flight) launch(applyingJobId, applyingPlatform ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyingJobId, applyingPlatform]);

  // --- one animation loop for the chakra, the sweep, the pings and the comets
  useEffect(() => {
    if (still) return;
    let frame = 0;
    let last = performance.now();
    let spin = 0;
    let sweep = -Math.PI / 2;
    let edge = normalize(sweep);
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const { running: on, phase: state } = live.current;
      spin += dt * (flights.current.size ? 0.08 : on ? 0.025 : 0.006);
      chakraRef.current?.setAttribute('transform', `translate(${CENTER} ${CENTER}) rotate(${spin})`);

      if (on) {
        sweep += dt * (state === 'discovering' ? 0.0022 : 0.0009);
        sweepRef.current?.setAttribute('transform', `rotate(${(sweep * 180) / Math.PI} ${CENTER} ${CENTER})`);
        const next = normalize(sweep);
        for (const { el, angle } of dots.current.values()) {
          const target = normalize(angle);
          const passed = edge <= next ? target > edge && target <= next : target > edge || target <= next;
          if (passed && !el.classList.contains('born')) {
            el.classList.remove('ping', 'twinkle');
            void el.getBoundingClientRect();
            el.classList.add('ping');
            window.setTimeout(() => {
              el.classList.remove('ping');
              el.classList.add('twinkle');
            }, 760);
          }
        }
        edge = next;
      }

      for (const flight of flights.current.values()) {
        const age = now - flight.startedAt;
        if (flight.endedAt === null && age > STALE_FLIGHT_MS) {
          flight.endedAt = now;
          flight.outcome = 'stopped';
        }
        let reach: number;
        if (flight.endedAt === null) {
          // Out to the edge of the score bands, then hold there, breathing, until the application ends.
          const out = 1 - Math.pow(1 - Math.min(1, age / 3200), 3);
          reach = 50 + out * 230 + Math.sin(now / 420) * 6 * out;
        } else {
          const after = Math.min(1, (now - flight.endedAt) / 650);
          reach = 280 + after * (RIM - 280);
          if (after >= 1 && !flight.reachedAt) {
            flight.reachedAt = now;
            const spot = pointAt(RIM, flight.angle);
            const burst = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            burst.setAttribute('cx', String(spot.x));
            burst.setAttribute('cy', String(spot.y));
            burst.setAttribute('fill', 'none');
            burst.setAttribute('stroke-width', '2');
            burst.style.stroke = OUTCOME_COLOR[flight.outcome ?? 'stopped'];
            cometLayer.current?.appendChild(burst);
            burst.animate([{ r: '4', opacity: 1 }, { r: '30', opacity: 0 }], { duration: 800, easing: 'ease-out' }).onfinish = () => burst.remove();
            flight.line.remove();
            flight.head.remove();
            flight.gradient.remove();
            flights.current.delete(flight.jobId);
            continue;
          }
        }
        const head = pointAt(reach, flight.angle);
        const tail = pointAt(Math.max(30, reach - 120), flight.angle);
        for (const node of [flight.line, flight.gradient]) {
          node.setAttribute('x1', String(tail.x));
          node.setAttribute('y1', String(tail.y));
          node.setAttribute('x2', String(head.x));
          node.setAttribute('y2', String(head.y));
        }
        flight.head.setAttribute('cx', String(head.x));
        flight.head.setAttribute('cy', String(head.y));
        if (flight.endedAt !== null) flight.head.style.fill = OUTCOME_COLOR[flight.outcome ?? 'stopped'];
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [still]);

  // --- the job card, and keys for it
  const focusId = pinned ?? hovered;
  const focus = placed.find((entry) => entry.job.id === focusId) ?? null;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPinned(null);
        setHovered(null);
        return;
      }
      const target = event.target as HTMLElement;
      if (!focus || busy || event.metaKey || event.ctrlKey || /input|textarea|select/i.test(target.tagName) || target.isContentEditable) return;
      const key = event.key.toLowerCase();
      const action: RadarAction | null =
        focus.job.status === 'review'
          ? key === 'a' ? 'approve' : key === 's' ? 'skip' : key === 'x' ? 'dismiss' : null
          : focus.job.status === 'approved'
            ? key === 'u' ? 'unqueue' : key === 'n' ? 'apply-now' : null
            : null;
      if (action) {
        event.preventDefault();
        onAct(action, focus.job);
        setPinned(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, busy, onAct]);

  const center =
    phase === 'applying' || applyingJobId ? 'APPLYING' : phase === 'discovering' ? 'SEARCHING' : running ? (phase === 'sleeping' ? 'OUTSIDE ACTIVE HOURS' : 'IN ORBIT') : 'RESTING';
  const label = (x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle', tone = 'var(--ink-3)') => (
    <text x={x} y={y} textAnchor={anchor} pointerEvents="none" style={{ fill: tone, font: '10.5px "JetBrains Mono", monospace', letterSpacing: '0.16em' }}>
      {text}
    </text>
  );

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[760px]" onPointerLeave={() => setHovered(null)}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full" role="img" aria-label={`Radar: ${counts.home} jobs in your country, ${counts.abroad} abroad, ${counts.unknown} not said`} onClick={() => setPinned(null)}>
        <defs ref={defsRef}>
          <radialGradient id="radar-core">
            <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.55 }} />
            <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
          </radialGradient>
          <linearGradient id="radar-sweep" x1="0" x2="1">
            <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
            <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0.2 }} />
          </linearGradient>
        </defs>

        {/* your country's half, and the line between */}
        <path d={`M ${CENTER} ${CENTER - RIM + 8} A ${RIM - 8} ${RIM - 8} 0 0 0 ${CENTER} ${CENTER + RIM - 8} Z`} style={{ fill: 'var(--accent)', opacity: 0.035 }} />
        <line x1={CENTER} y1={CENTER - RIM - 4} x2={CENTER} y2={CENTER + RIM + 4} strokeDasharray="2 6" style={{ stroke: 'var(--line-strong)' }} />
        {label(CENTER - 150, 22, `${(country ?? 'YOUR COUNTRY').toUpperCase()} · ${counts.home}`, 'middle', 'var(--accent)')}
        {label(CENTER + 150, 22, `ABROAD · ${counts.abroad}`)}
        {counts.unknown > 0 && label(CENTER, SIZE - 8, `NOT SAID · ${counts.unknown}`)}

        {BANDS.map((band) => (
          <g key={band}>
            <circle cx={CENTER} cy={CENTER} r={radiusFor(band)} fill="none" style={{ stroke: 'var(--line)' }} />
            {label(CENTER + 6, CENTER - radiusFor(band) + 13, `${band}+`, 'start')}
          </g>
        ))}

        {/* each site's daily limit, around the rim */}
        {limits.map((site, index) => {
          const span = (2 * Math.PI) / limits.length;
          const from = -Math.PI / 2 + index * span + 0.05;
          const to = from + span - 0.1;
          const used = site.limit ? Math.min(1, site.done / site.limit) : 0;
          return (
            <g key={site.key}>
              <title>{`${site.label}: ${site.enabled ? `${site.done} of ${site.limit} today` : 'off'}`}</title>
              <path d={arcPath(RIM, from, to)} fill="none" strokeWidth={5} strokeLinecap="round" style={{ stroke: 'var(--line)', opacity: site.enabled ? 1 : 0.4 }} />
              {used > 0 && (
                <path d={arcPath(RIM, from, from + (to - from) * used)} fill="none" strokeWidth={5} strokeLinecap="round" style={{ stroke: used >= 1 ? 'var(--warn)' : site.color, filter: `drop-shadow(0 0 4px ${site.color})` }} />
              )}
            </g>
          );
        })}

        <g ref={sweepRef} pointerEvents="none" style={{ opacity: running && !still ? 1 : 0, transition: 'opacity .6s' }}>
          <path d={`M ${CENTER} ${CENTER} L ${pointAt(RIM - 14, -0.42).x} ${pointAt(RIM - 14, -0.42).y} A ${RIM - 14} ${RIM - 14} 0 0 1 ${pointAt(RIM - 14, 0).x} ${pointAt(RIM - 14, 0).y} Z`} fill="url(#radar-sweep)" />
        </g>

        {placed.map(({ job, x, y, angle }) => {
          const queued = job.status === 'approved';
          const hot = job.id === focusId || job.id === applyingJobId;
          const dim = highlight ? !highlight.has(job.id) : false;
          return (
            <g key={job.id}>
              <circle
                ref={(el) => {
                  if (el) dots.current.set(job.id, { el, angle });
                  else dots.current.delete(job.id);
                }}
                cx={x}
                cy={y}
                r={(job.score ?? 0) >= 85 ? 5 : 3.8}
                className={cn('radar-dot', born.has(job.id) ? 'born' : 'twinkle', dim && 'dim', hot && 'hot')}
                style={{ fill: PLATFORM_COLOR[job.platform], opacity: dim ? undefined : job.region === 'abroad' ? 0.62 : 0.95, animationDelay: born.has(job.id) ? undefined : `${-spread(job.id, 3) * 3.4}s` }}
              />
              {queued && <circle cx={x} cy={y} r={8.5} fill="none" strokeWidth={1.4} style={{ stroke: 'var(--accent)', opacity: dim ? 0.2 : 0.9 }} />}
              <circle
                cx={x}
                cy={y}
                r={10}
                fill="transparent"
                className="radar-hit"
                onPointerEnter={() => setHovered(job.id)}
                onClick={(event) => {
                  event.stopPropagation();
                  setPinned((current) => (current === job.id ? null : job.id));
                }}
              >
                <title>{`${job.title} · ${job.company}`}</title>
              </circle>
            </g>
          );
        })}

        <g ref={cometLayer} pointerEvents="none" />

        {/* The chakra and its glow sit over the best matches: they let the pointer through to those dots. */}
        <circle cx={CENTER} cy={CENTER} r={78} fill="url(#radar-core)" pointerEvents="none" style={{ opacity: running ? 1 : 0.45 }} />
        <g ref={chakraRef} transform={`translate(${CENTER} ${CENTER})`} pointerEvents="none">
          <g transform="scale(2.6)">
            <polygon points={CHAKRA_TEETH} style={{ fill: 'var(--accent)' }} />
            <circle r={10.6} style={{ fill: 'var(--surface)' }} />
            <circle r={9.4} fill="none" strokeWidth={0.8} style={{ stroke: 'var(--accent)' }} />
            {CHAKRA_SPOKES.map((angle) => (
              <line key={angle} x1={2.6 * Math.cos(angle)} y1={2.6 * Math.sin(angle)} x2={9 * Math.cos(angle)} y2={9 * Math.sin(angle)} strokeWidth={0.7} style={{ stroke: 'var(--accent)' }} />
            ))}
            <circle r={2.4} style={{ fill: 'var(--accent)' }} />
          </g>
        </g>
        {label(CENTER, CENTER + 66, center, 'middle', running ? 'var(--accent)' : 'var(--ink-3)')}
      </svg>

      {focus && <Probe entry={focus} pinned={pinned === focus.job.id} busy={busy} onAct={(action) => { onAct(action, focus.job); setPinned(null); }} />}
    </div>
  );
}

function Probe({ entry, pinned, busy, onAct }: { entry: { job: Job; x: number; y: number }; pinned: boolean; busy: boolean; onAct: (action: RadarAction) => void }) {
  const { job, x, y } = entry;
  const detail = job.scoreDetail;
  const right = x < SIZE * 0.58;
  const below = y < SIZE * 0.3;
  const bars: [string, number | null | undefined][] = [
    ['Skills', detail?.technical],
    ['Location', detail?.location],
    ['Pay', detail?.salary],
    ['AI view', detail?.llm],
    ['Your interest', job.taste],
  ];
  const mode = job.workMode === 'onsite' ? 'On-site' : job.workMode ? job.workMode[0].toUpperCase() + job.workMode.slice(1) : null;
  return (
    <div
      className="mission-probe absolute z-10 w-[272px] rounded-xl border border-accent/40 bg-surface/95 p-3.5 text-[12.5px] shadow-[var(--shadow-lg,0_20px_50px_-20px_rgb(0_0_0/.5))] backdrop-blur"
      style={{
        left: `${(x / SIZE) * 100}%`,
        top: `${(y / SIZE) * 100}%`,
        transform: `translate(${right ? '18px' : 'calc(-100% - 18px)'}, ${below ? '-12px' : 'calc(-100% + 24px)'})`,
      }}
      onPointerEnter={(event) => event.stopPropagation()}
    >
      <div className="flex items-start gap-2.5">
        <ScoreDial score={job.score} size={36} />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-ink" title={job.title}>
            {job.title}
          </p>
          <p className="truncate text-ink-3">
            {job.company} · {platformLabel(job.platform)}
          </p>
        </div>
      </div>
      <p className="mt-1.5 text-[11.5px] text-ink-3">
        {[job.location, mode, job.region === 'abroad' ? 'Abroad' : null, job.postedAt ? `posted ${timeAgo(job.postedAt)}` : `found ${timeAgo(job.discoveredAt)}`].filter(Boolean).join(' · ')}
      </p>
      <div className="mt-2.5 grid grid-cols-[84px_1fr_24px] items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-2">
        {bars
          .filter(([, value]) => value !== null && value !== undefined)
          .map(([name, value]) => (
            <div key={name} className="contents">
              <span>{name}</span>
              <span className="h-1 overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, value!))}%` }} />
              </span>
              <span className="text-right tabular">{Math.round(value!)}</span>
            </div>
          ))}
      </div>
      {detail?.summary && <p className="mt-2 line-clamp-2 text-[11.5px] text-ink-3">{detail.summary}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {job.status === 'review' && (
          <>
            <ProbeButton primary disabled={busy} onClick={() => onAct('approve')} keyHint="A">Approve</ProbeButton>
            <ProbeButton disabled={busy} onClick={() => onAct('skip')} keyHint="S">Skip</ProbeButton>
            <ProbeButton disabled={busy} onClick={() => onAct('dismiss')} keyHint="X">Dismiss</ProbeButton>
          </>
        )}
        {job.status === 'approved' && (
          <>
            <ProbeButton primary disabled={busy} onClick={() => onAct('apply-now')} keyHint="N">Apply now</ProbeButton>
            <ProbeButton disabled={busy} onClick={() => onAct('unqueue')} keyHint="U">Back to review</ProbeButton>
          </>
        )}
        <a href={job.url} target="_blank" rel="noreferrer" className="ml-auto text-[11.5px] text-info hover:underline">
          Open job
        </a>
      </div>
      {!pinned && <p className="mt-2 text-[10.5px] text-ink-3">Click the dot to keep this open · Esc closes</p>}
    </div>
  );
}

function ProbeButton({ children, onClick, keyHint, primary, disabled }: { children: string; onClick: () => void; keyHint: string; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium transition-colors disabled:opacity-50',
        primary ? 'bg-accent text-accent-ink hover:brightness-105' : 'border border-line text-ink-2 hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
      <kbd className="font-mono text-[10px] opacity-60">{keyHint}</kbd>
    </button>
  );
}
