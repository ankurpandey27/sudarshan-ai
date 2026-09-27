// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Link } from 'react-router';
import { useTaste } from '../lib/queries';
import { Badge, Card, CardHeader } from './ui';
import { InfoTip } from './info-tip';

// "title: backend" -> "backend"; "platform: naukri" -> "Naukri jobs"
const label = (f: string) => (f.startsWith('title: ') ? f.slice(7) : f.startsWith('platform: ') ? `${f.slice(10)} jobs` : f === 'remote' ? 'remote jobs' : f);

/** What Sudarshan has learned about the jobs you want, from your own Approve / Skip decisions. */
export function TasteCard() {
  const { data: t } = useTaste();
  if (!t) return null;
  return (
    <Card>
      <CardHeader
        title="Your taste"
        hint={t.status === 'ready' ? `Learned from ${t.decisions} of your decisions, on this computer.` : 'Learns from the jobs you approve and skip.'}
        action={
          <InfoTip title="How it learns" align="right">
            Every job you approve or mark applied counts as "want", every job you skip or dismiss as "don't want". A small model on your computer learns which
            titles, platforms and kinds of fit you prefer. It sorts Review by "Your taste" and, in Auto mode, holds back jobs you would very likely skip. Your
            own rules always come first, and it never sends anything by itself.
          </InfoTip>
        }
      />
      <div className="px-5 py-4 text-[13px]">
        {t.status === 'learning' ? (
          <>
            <p className="text-ink-2">
              {t.decisions} decision{t.decisions === 1 ? '' : 's'} so far - {t.needed} more and it starts ranking jobs for you
              {t.wanted < 5 || t.unwanted < 5 ? ' (it needs some approvals and some skips)' : ''}.
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${Math.min(100, (t.decisions / (t.decisions + t.needed)) * 100)}%` }}
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
              Review can be sorted by "Your taste".
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
