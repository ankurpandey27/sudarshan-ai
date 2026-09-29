// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Link } from 'react-router';
import { useTaste } from '../lib/queries';
import { Badge, Card, CardHeader } from './ui';
import { InfoTip } from './info-tip';

// "skill: node.js" -> "Node.js"; "platform: naukri" -> "Naukri jobs"
const label = (f: string) =>
  f.startsWith('skill: ')
    ? f.charAt(7).toUpperCase() + f.slice(8)
    : f.startsWith('title: ')
      ? f.slice(7)
      : f.startsWith('platform: ')
        ? `${f.charAt(10).toUpperCase()}${f.slice(11)} jobs`
        : f === 'remote'
          ? 'Remote jobs'
          : f;

/** What Sudarshan has learned about the jobs you want, from your own Approve / Skip decisions. */
export function TasteCard() {
  const { data: t } = useTaste();
  if (!t) return null;
  return (
    <Card>
      <CardHeader
        title="Your interest"
        hint={
          t.status === 'ready'
            ? `Learned from ${t.wanted} job${t.wanted === 1 ? '' : 's'} you kept${t.unwanted ? ` and ${t.unwanted} you turned down` : ''}, on this computer.`
            : 'Learns from the jobs you apply to and approve.'
        }
        action={
          <InfoTip title="How it learns" align="right">
            What the jobs you apply to or approve have in common is what you like: the skills they ask for most (Node.js, TypeScript...), their titles and
            platforms. Each new job gets how much it looks like them - "92% your interest" - and hovering it shows what it shares with your applications.
            Anything you skip or dismiss again and again counts against a job. It sorts Review by "Your interest" and, in Auto mode, holds back jobs very unlike
            yours. Your own rules always come first, and it never sends anything by itself.
          </InfoTip>
        }
      />
      <div className="px-5 py-4 text-[13px]">
        {t.status === 'learning' ? (
          <>
            <p className="text-ink-2">
              {t.wanted} job{t.wanted === 1 ? '' : 's'} applied to or approved so far - {t.needed} more and it starts ranking jobs for you.
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${Math.min(100, (t.wanted / (t.wanted + t.needed)) * 100)}%` }}
              />
            </div>
            <Link to="/review" className="mt-3 inline-block text-info hover:underline">
              Approve or skip jobs in Review
            </Link>
          </>
        ) : (
          <>
            {t.likes.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="w-16 shrink-0 text-ink-3">You like</span>
                {t.likes.map((f) => (
                  <Badge key={f} tone="good">
                    {label(f)}
                  </Badge>
                ))}
              </p>
            )}
            {t.dislikes.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="w-16 shrink-0 text-ink-3">You skip</span>
                {t.dislikes.map((f) => (
                  <Badge key={f} tone="warn">
                    {label(f)}
                  </Badge>
                ))}
              </p>
            )}
            <p className="mt-3 text-[12px] text-ink-3">
              {t.accuracy !== null ? `Right about ${Math.round(t.accuracy * 100)}% of the time on decisions it had not seen. ` : ''}
              Review can be sorted by "Your interest".
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
