// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn, statusLabel } from '../lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'press inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium whitespace-nowrap select-none disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-3.5 text-[13.5px]',
        variant === 'primary' &&
          'bg-accent text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.2),0_6px_18px_-8px_var(--accent)] hover:brightness-[1.06]',
        variant === 'secondary' && 'border border-line-strong bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:border-ink-3/50 hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        variant === 'danger' && 'border border-line-strong bg-surface text-bad hover:border-bad/40 hover:bg-bad-soft',
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-[14px] border border-line bg-surface shadow-card', className)}>{children}</section>;
}

export function CardHeader({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[14.5px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-[12.5px] text-pretty text-ink-3">{hint}</p>}
      </div>
      {action}
    </header>
  );
}

const tone: Record<string, string> = {
  neutral: 'bg-surface-2 text-ink-2 ring-line',
  accent: 'bg-accent-soft text-ink ring-accent/25',
  good: 'bg-good-soft text-good ring-good/20',
  warn: 'bg-warn-soft text-warn ring-warn/20',
  bad: 'bg-bad-soft text-bad ring-bad/20',
  info: 'bg-info-soft text-info ring-info/20',
};

export function Badge({ tone: t = 'neutral', children, className }: { tone?: keyof typeof tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset', tone[t], className)}>
      {children}
    </span>
  );
}

const statusTone: Record<string, keyof typeof tone> = {
  applied: 'good',
  approved: 'accent',
  applying: 'accent',
  review: 'info',
  needs_input: 'warn',
  manual: 'warn',
  failed: 'bad',
  skipped: 'neutral',
  dismissed: 'neutral',
  new: 'neutral',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? 'neutral'}>{statusLabel[status] ?? status}</Badge>;
}

export function ScoreDial({ score, size = 40 }: { score: number | null; size?: number }) {
  const value = score ?? 0;
  const radius = size / 2 - 3;
  const circumference = 2 * Math.PI * radius;
  const color = score === null ? 'var(--line-strong)' : value >= 70 ? 'var(--good)' : value >= 50 ? 'var(--accent)' : 'var(--ink-3)';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`Match score ${score ?? 'not scored'}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line)" strokeWidth="2.5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
        />
      </svg>
      <span className="tabular absolute inset-0 grid place-items-center font-mono text-[11.5px] font-medium">{score ?? '-'}</span>
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[12.5px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12px] text-ink-3">{hint}</span>}
    </label>
  );
}

const control =
  'w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[13.5px] text-ink shadow-[inset_0_1px_2px_rgb(0_0_0/0.04)] placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 hover:border-ink-3/60 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(control, 'h-9', className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(control, 'min-h-20 py-2 leading-relaxed', className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(control, 'h-9 pr-8', className)}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="group flex cursor-pointer items-start justify-between gap-4 py-2.5">
      <span>
        <span className="block text-[13.5px] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] text-ink-3">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0 size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.3)] transition-transform duration-200 ease-[var(--ease-out)]',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-11 place-items-center rounded-full bg-surface-2 text-ink-3 ring-1 ring-line">{icon}</div>}
      <p className="font-display text-[19px]">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-[13.5px] text-pretty text-ink-3">{children}</div>}
    </div>
  );
}

export function PageTitle({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[28px] leading-[1.1]">{title}</h1>
        {sub && <p className="mt-1.5 text-[13.5px] text-ink-3">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
