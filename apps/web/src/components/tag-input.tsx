// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/format';

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  /** Names the box for screen readers, e.g. "Core skills". */
  label: string;
  className?: string;
}

/**
 * A list typed as chips: Enter or a comma adds what you typed, x removes one, Backspace in the
 * empty box removes the last, and pasting "Node.js, NestJS" adds both. Typed text is added when
 * you leave the box too, so pressing Save straight away keeps it.
 */
export function TagInput({ value, onChange, placeholder, label, className }: TagInputProps) {
  const [text, setText] = useState('');

  const add = (raw: string) => {
    const fresh = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s, i, all) => all.findIndex((o) => o.toLowerCase() === s.toLowerCase()) === i)
      .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (fresh.length) onChange([...value, ...fresh]);
    setText('');
  };
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && text.trim()) {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Enter') {
      // Never submit the surrounding form from an empty chip box.
      e.preventDefault();
    } else if (e.key === 'Backspace' && !text && value.length) {
      remove(value.length - 1);
    }
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (/[,\n]/.test(pasted)) {
      e.preventDefault();
      add(`${text},${pasted}`);
    }
  };

  return (
    <div
      className={cn(
        'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2 py-1 transition-colors hover:border-ink-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30',
        className,
      )}
    >
      {value.map((v, i) => (
        <span key={`${v}-${i}`} className="inline-flex items-center gap-1 rounded-md bg-surface-2 py-0.5 pr-1 pl-2 text-[13px] text-ink">
          {v}
          <button type="button" onClick={() => remove(i)} aria-label={`Remove ${v}`} className="rounded p-0.5 text-ink-3 hover:bg-bad-soft hover:text-bad">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => text.trim() && add(text)}
        placeholder={value.length ? 'Add another' : placeholder}
        aria-label={label}
        className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus-visible:outline-none"
      />
    </div>
  );
}
