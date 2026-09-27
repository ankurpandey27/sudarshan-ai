// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '../lib/format';

/**
 * An (i) next to a control that explains it. Opens on hover or keyboard focus,
 * and on tap for touch screens; Escape or a click elsewhere closes it.
 */
export function InfoTip({
  title,
  children,
  align = 'right',
  side = 'bottom',
}: {
  title: string;
  children: ReactNode;
  align?: 'left' | 'right';
  /** 'top' for controls near the bottom of the screen. */
  side?: 'top' | 'bottom';
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <span ref={ref} className="group relative inline-flex" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={`What does "${title}" do?`}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-6 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Info className="size-4" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          'pointer-events-none invisible absolute z-50 w-72 rounded-lg border border-line bg-surface p-3 text-left opacity-0 shadow-card transition-opacity duration-150',
          'group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100',
          open && 'visible opacity-100',
          align === 'right' ? 'right-0' : 'left-0',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        )}
      >
        <span className="block text-[13px] font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-[12.5px] leading-relaxed font-normal text-ink-2">{children}</span>
      </span>
    </span>
  );
}
