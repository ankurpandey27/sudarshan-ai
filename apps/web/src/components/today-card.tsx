// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { cn, PLATFORMS } from '../lib/format';
import { useSettings, useStats } from '../lib/queries';
import { PlatformDot } from './platform-badge';
import { Card } from './ui';

/** Today's applications against each site's daily limit - the agent window's "Today", on Lakshya. */
export function TodayCard() {
  const { data: stats } = useStats();
  const { data: settings } = useSettings();
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  return (
    <Card className="flex flex-col">
      <div className="flex items-baseline justify-between px-5 pt-4">
        <h3 className="text-[12px] font-semibold tracking-[0.1em] text-ink-2 uppercase">Today</h3>
        <span className="text-[12.5px] text-ink-3">{today}</span>
      </div>
      <div className="grid flex-1 grid-cols-[auto_1fr] gap-6 px-5 pt-3 pb-5">
        <div className="self-center text-center">
          <div className="font-display text-[64px] leading-none tabular">{stats?.appliedToday ?? 0}</div>
          <div className="mt-1 text-[12.5px] text-ink-3">applied today</div>
        </div>
        <ul className="flex flex-col justify-between gap-2.5">
          {PLATFORMS.map(({ key, label, setting }) => {
            const cfg = settings?.sources[setting];
            const off = cfg?.enabled === false;
            const done = stats?.appliedTodayByPlatform[key] ?? 0;
            const limit = cfg?.enabled ? cfg.dailyLimit : 0;
            const full = !!limit && done >= limit;
            return (
              <li key={key} className={cn(off && 'opacity-55')}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-1.5 text-ink-2">
                    <PlatformDot platform={key} />
                    {label}
                  </span>
                  <b className={cn('tabular', full ? 'text-warn' : 'text-ink')}>{off ? 'Off' : limit ? `${done} / ${limit}` : done}</b>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" role="presentation">
                  <i
                    className={cn('block h-full rounded-full transition-[width] duration-500', full ? 'bg-warn' : 'bg-accent')}
                    style={{ width: `${limit ? Math.min(100, (done / limit) * 100) : 0}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
