// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import type { ReactNode } from 'react';
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

/** Underlined section tabs for splitting a long page. */
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
  return (
    <div role="tablist" className={cn('mb-6 flex gap-1 overflow-x-auto border-b border-line/80', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[13.5px] whitespace-nowrap transition-colors',
            value === t.id ? 'border-accent font-semibold text-ink' : 'border-transparent text-ink-3 hover:border-line-strong hover:text-ink',
          )}
        >
          {t.icon && <span className="text-ink-3">{t.icon}</span>}
          {t.label}
          {!!t.badge && <span className="rounded-md bg-warn-soft px-1.5 text-[11px] font-semibold text-warn tabular">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}
