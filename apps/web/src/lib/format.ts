// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '-';
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 45) return 'just now';
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

export function timeUntil(iso: string | null | undefined): string {
  if (!iso) return '-';
  const secs = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (secs <= 0) return 'now';
  if (secs < 60) return `in ${secs}s`;
  if (secs < 3600) return `in ${Math.round(secs / 60)}m`;
  return `in ${Math.round(secs / 3600)}h`;
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

/** 1800000 -> "18 L"; 25000000 -> "2.5 Cr" (Indian units). */
export function inr(n: number | null | undefined): string {
  if (!n) return '-';
  if (n >= 1e7) return `${+(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${+(n / 1e5).toFixed(2)} L`;
  return n.toLocaleString('en-IN');
}

export const sourceLabel: Record<string, string> = { linkedin: 'LinkedIn', naukri: 'Naukri', indeed: 'Indeed', web: 'Other sites' };

/** Every platform, with the settings key that switches it on or off. */
export const PLATFORMS = [
  { key: 'linkedin', label: 'LinkedIn', setting: 'linkedin' },
  { key: 'naukri', label: 'Naukri', setting: 'naukri' },
  { key: 'indeed', label: 'Indeed', setting: 'indeed' },
  { key: 'instahyre', label: 'Instahyre', setting: 'instahyre' },
  { key: 'foundit', label: 'Foundit', setting: 'foundit' },
  { key: 'hirist', label: 'Hirist', setting: 'hirist' },
  { key: 'himalayas', label: 'Himalayas', setting: 'himalayas' },
  { key: 'other', label: 'Other sites', setting: 'links' },
] as const;

export const platformLabel = (p: string): string => PLATFORMS.find((x) => x.key === p)?.label ?? p;

export const statusLabel: Record<string, string> = {
  new: 'New',
  skipped: 'Skipped',
  review: 'To review',
  approved: 'Queued',
  applying: 'Applying',
  needs_input: 'Needs you',
  applied: 'Applied',
  manual: 'Do by hand',
  failed: 'Failed',
  dismissed: 'Dismissed',
};

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** 9,007 / 482K / 1.2M - exact below 100,000. */
export function tokensShort(n: number): string {
  return n < 100_000 ? n.toLocaleString() : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Text colour of a flight-log line by level. */
export const levelColor: Record<'info' | 'success' | 'warn' | 'error', string> = {
  info: 'text-ink-2',
  success: 'text-good',
  warn: 'text-warn',
  error: 'text-bad',
};
