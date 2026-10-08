// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { cn } from '../lib/format';

export interface TabDef<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
  /** A small number beside the label, e.g. how many need attention. */
  badge?: number;
}

/** The open tab, kept in the address (?tab=...) so links, reloads and Back land on it. */
export function useTab<T extends string>(tabs: readonly TabDef<T>[], param = 'tab'): [T, (t: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(param);
  const current = (tabs.find((t) => t.id === raw)?.id ?? tabs[0].id) as T;
  const set = (t: T) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (t === tabs[0].id) next.delete(param);
        else next.set(param, t);
        return next;
      },
      { replace: true },
    );
  return [current, set];
}

/** Section tabs for splitting a long page. The underline slides to the chosen tab. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: readonly TabDef<T>[];
  value: T;
  onChange: (t: T) => void;
  className?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ x: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const active = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (active) setBar({ x: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [value, tabs]);
  return (
    <div ref={list} role="tablist" className={cn('relative mb-6 flex gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex shrink-0 items-center gap-2 px-3 pt-2 pb-2.5 text-[13.5px] whitespace-nowrap transition-colors duration-150',
            value === t.id ? 'font-medium text-ink' : 'text-ink-3 hover:text-ink',
          )}
        >
          {t.icon && <span className={value === t.id ? 'text-accent' : 'text-ink-3'}>{t.icon}</span>}
          {t.label}
          {!!t.badge && <span className="rounded-full bg-warn-soft px-1.5 text-[11px] font-semibold text-warn tabular">{t.badge}</span>}
        </button>
      ))}
      {bar && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-[-1px] left-0 h-0.5 w-px origin-left rounded-full bg-accent transition-transform duration-[220ms] ease-[var(--ease-out)]"
          style={{ transform: `translateX(${bar.x}px) scaleX(${bar.width})` }}
        />
      )}
    </div>
  );
}
