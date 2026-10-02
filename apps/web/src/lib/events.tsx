// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { AgentEvent } from './types';
import { showDesktop } from './desktop-notify';

const MAX_EVENTS = 300;

interface EventsState {
  events: AgentEvent[];
  connected: boolean;
}

const EventsContext = createContext<EventsState>({ events: [], connected: false });

export function EventsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const pending = useRef<Set<string>>(new Set());
  const flush = useRef<number | null>(null);

  useEffect(() => {
    let closed = false;
    api
      .get<AgentEvent[]>('/events/recent?limit=150')
      .then((recent) => !closed && setEvents((cur) => (cur.length ? cur : recent.slice().reverse())))
      .catch(() => undefined);

    const invalidate = (keys: string[]) => {
      keys.forEach((k) => pending.current.add(k));
      // Batch bursts (a scoring run emits dozens of events) into one refetch.
      flush.current ??= window.setTimeout(() => {
        pending.current.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
        pending.current.clear();
        flush.current = null;
      }, 600);
    };

    const es = new EventSource('/api/events/stream');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (msg) => {
      const e = JSON.parse(msg.data) as AgentEvent;
      setEvents((cur) => [e, ...cur].slice(0, MAX_EVENTS));
      if (e.type === 'job.updated' || e.type === 'jobs.discovered') invalidate(['jobs', 'stats', 'agent', 'insights']);
      if (e.type === 'question.pending') invalidate(['questions', 'agent', 'insights']);
      if (e.type === 'agent.state') invalidate(['agent', 'insights']);
      if (e.type === 'log' && (e.level === 'warn' || e.level === 'error')) invalidate(['insights']);
      if (e.type === 'browser.state') invalidate(['browser']);
      if (e.type === 'notify') {
        const d = (e.data ?? {}) as { title?: string; body?: string };
        showDesktop(d.title ?? e.message, d.body ?? '');
      }
      if (e.type === 'log' && /Resume imported|Spreadsheet imported/.test(e.message)) invalidate(['profile', 'answers', 'settings', 'jobs', 'insights']);
    };
    return () => {
      closed = true;
      es.close();
    };
  }, [qc]);

  return <EventsContext.Provider value={{ events, connected }}>{children}</EventsContext.Provider>;
}

export const useEvents = () => useContext(EventsContext);
