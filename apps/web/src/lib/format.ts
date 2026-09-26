export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '-';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function timeUntil(iso: string | null | undefined): string {
  if (!iso) return '-';
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (s <= 0) return 'now';
  if (s < 60) return `in ${s}s`;
  if (s < 3600) return `in ${Math.round(s / 60)}m`;
  return `in ${Math.round(s / 3600)}h`;
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

export const sourceLabel: Record<string, string> = { linkedin: 'LinkedIn', naukri: 'Naukri', web: 'Web' };

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
