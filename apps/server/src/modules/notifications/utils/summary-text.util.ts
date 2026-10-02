// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { DaySummary } from '../interfaces/notification.interface';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The day in a few plain lines, for a phone notification. */
export function summaryText(s: DaySummary): { title: string; body: string } {
  const applied = s.applied.reduce((n, a) => n + a.count, 0);
  const lines = [
    applied
      ? `Applied: ${applied} (${s.applied
          .filter((a) => a.count > 0)
          .map((a) => `${a.platform} ${a.count}`)
          .join(', ')})`
      : 'Applied: none today',
  ];
  if (s.needsYou || s.questions)
    lines.push(
      `Needs you: ${[s.needsYou && plural(s.needsYou, 'application'), s.questions && plural(s.questions, 'question')].filter(Boolean).join(' and ')}`,
    );
  if (s.failed) lines.push(`Could not apply: ${s.failed}`);
  lines.push(`New jobs found: ${s.found}`);
  return { title: `Sudarshan today: ${plural(applied, 'application')} sent`, body: lines.join('\n') };
}

/** One message for several applications that need you. */
export function needsYouText(items: { label: string; why: string }[]): { title: string; body: string } {
  const shown = items.slice(0, 5).map((i) => `- ${i.label}: ${i.why}`);
  if (items.length > 5) shown.push(`...and ${items.length - 5} more`);
  return {
    title: items.length === 1 ? 'An application needs you' : `${items.length} applications need you`,
    body: `${shown.join('\n')}\nOpen Sudarshan -> Needs attention.`,
  };
}
