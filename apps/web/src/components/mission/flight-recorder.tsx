// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useEvents } from '../../lib/events';
import { cn } from '../../lib/format';
import type { ActivityPage, AgentEvent } from '../../lib/types';
import { Card } from '../ui';

type Kind = 'applied' | 'needed' | 'searched' | 'failed';
const LANES: { kind: Kind; label: string; color: string }[] = [
  { kind: 'applied', label: 'applied', color: 'var(--good)' },
  { kind: 'needed', label: 'needed you', color: 'var(--warn)' },
  { kind: 'searched', label: 'searched', color: 'var(--accent)' },
  { kind: 'failed', label: 'failed', color: 'var(--bad)' },
];

/** Which lane a flight-log line belongs on, or none. */
function kindOf(event: AgentEvent): Kind | null {
  if (event.level === 'error') return 'failed';
  if (event.level === 'success' && /: Applied\b|Finished by you/.test(event.message)) return 'applied';
  if (event.level === 'success' && /unique jobs|^Scored \d+/.test(event.message)) return 'searched';
  if (event.level === 'warn' && event.type !== 'notify') return 'needed';
  return null;
}

const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;

/**
 * Today on one line: every application, hand-over, search and failure from the flight log, across your active
 * hours. Drag along it to see what had happened by then; let go and it follows the live time again.
 */
export function FlightRecorder({ startHour, endHour }: { startHour: number; endHour: number }) {
  const today = localDay(new Date());
  const { data } = useQuery({
    queryKey: ['flight-recorder', today],
    queryFn: () => api.get<ActivityPage>(`/events/history?day=${today}&limit=300`),
    refetchInterval: 30_000,
  });
  const { events: live } = useEvents();
  const [now, setNow] = useState(() => new Date());
  const [scrub, setScrub] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // The day's span: your active hours, stretched to include anything that happened outside them.
  const minuteOf = (iso: string) => {
    const at = new Date(iso);
    return at.getHours() * 60 + at.getMinutes() + at.getSeconds() / 60;
  };
  const marks = useMemo(() => {
    const byId = new Map<number, AgentEvent>();
    for (const event of [...(data?.items ?? []), ...live]) if (localDay(new Date(event.at)) === today) byId.set(event.id, event);
    return [...byId.values()]
      .map((event) => ({ event, kind: kindOf(event), minute: minuteOf(event.at) }))
      .filter((mark): mark is { event: AgentEvent; kind: Kind; minute: number } => mark.kind !== null)
      .sort((a, b) => a.minute - b.minute);
  }, [data, live, today]);
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const from = Math.min(startHour * 60, marks[0]?.minute ?? Infinity, nowMinute);
  const to = Math.max(endHour >= startHour ? endHour * 60 : 24 * 60, (marks.at(-1)?.minute ?? 0) + 1, nowMinute + 1);
  const at = (minute: number) => ((minute - from) / (to - from)) * 100;
  const head = scrub ?? nowMinute;

  const upTo = marks.filter((mark) => mark.minute <= head);
  const tally = LANES.map((lane) => ({ ...lane, count: upTo.filter((mark) => mark.kind === lane.kind).length }));
  const nearest = scrub === null ? null : marks.reduce<(typeof marks)[number] | null>((best, mark) => (!best || Math.abs(mark.minute - head) < Math.abs(best.minute - head) ? mark : best), null);

  const scrubTo = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return;
    const ratio = Math.max(0, Math.min(1, (clientX - box.left) / box.width));
    setScrub(from + ratio * (to - from));
  };
  const hours = Array.from({ length: 6 }, (_, index) => from + ((to - from) * index) / 5);

  return (
    <Card className="px-5 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] tracking-[0.16em] text-ink-3 uppercase">Flight recorder · drag to replay today</span>
        <span className="flex flex-wrap gap-3 text-[11.5px] text-ink-3">
          {tally.map((lane) => (
            <span key={lane.kind} className="inline-flex items-center gap-1.5">
              <i className="size-2 rounded-sm" style={{ background: lane.color }} />
              <b className="font-medium text-ink tabular">{lane.count}</b> {lane.label}
            </span>
          ))}
        </span>
      </div>
      <div
        ref={track}
        className="relative mt-3 h-[66px] cursor-ew-resize touch-none select-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          scrubTo(event.clientX);
        }}
        onPointerMove={(event) => event.buttons === 1 && scrubTo(event.clientX)}
        onPointerUp={() => window.setTimeout(() => setScrub(null), 2500)}
        role="slider"
        aria-label="Replay today"
        aria-valuemin={from}
        aria-valuemax={to}
        aria-valuenow={Math.round(head)}
        aria-valuetext={hhmm(head)}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') setScrub(Math.max(from, head - 10));
          if (event.key === 'ArrowRight') setScrub(Math.min(to, head + 10));
          if (event.key === 'Escape') setScrub(null);
        }}
      >
        {LANES.map((lane, index) => (
          <div key={lane.kind} className="absolute inset-x-0 h-px bg-line/70" style={{ top: 7 + index * 12 }} />
        ))}
        {marks.map((mark) => (
          <i
            key={mark.event.id}
            title={`${hhmm(mark.minute)} ${mark.event.message}`}
            className={cn('absolute w-[3px] rounded-sm transition-opacity', mark.minute > head && 'opacity-25')}
            style={{ left: `${at(mark.minute)}%`, top: 2 + LANES.findIndex((lane) => lane.kind === mark.kind) * 12, height: 10, background: LANES.find((lane) => lane.kind === mark.kind)!.color }}
          />
        ))}
        <div
          className="absolute inset-y-0 right-0 border-l border-dashed border-line"
          style={{ left: `${at(nowMinute)}%`, background: 'repeating-linear-gradient(135deg, color-mix(in oklab, var(--ink) 4%, transparent) 0 6px, transparent 6px 12px)', bottom: 16 }}
        />
        <div className="pointer-events-none absolute top-0 w-0.5 bg-accent shadow-[0_0_10px_var(--accent)]" style={{ left: `${at(head)}%`, bottom: 16 }}>
          <span className="absolute -top-0.5 left-1.5 font-mono text-[10px] whitespace-nowrap text-accent">{scrub === null ? `now ${hhmm(head)}` : hhmm(head)}</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-between font-mono text-[10px] text-ink-3">
          {hours.map((minute) => (
            <span key={minute}>{hhmm(minute)}</span>
          ))}
        </div>
      </div>
      <p className="mt-1.5 h-4 truncate text-[12px] text-ink-2">
        {nearest ? (
          <>
            <span className="font-mono text-ink-3">{hhmm(nearest.minute)}</span> {nearest.event.message}
          </>
        ) : marks.length ? (
          <span className="text-ink-3">Drag along the line to see what happened when.</span>
        ) : (
          <span className="text-ink-3">Nothing yet today - applications, searches and hand-overs appear here as they happen.</span>
        )}
      </p>
    </Card>
  );
}
