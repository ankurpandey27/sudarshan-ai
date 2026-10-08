// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { cn, PLATFORMS } from '../lib/format';
import { useAgent, useSettings, useStats } from '../lib/queries';
import type { Settings } from '../lib/types';
import { PlatformDot } from './platform-badge';
import { Card, CardHeader } from './ui';
import { InfoTip } from './info-tip';
import { useToast } from './toast';

/** Which platforms Sudarshan AI searches and applies on. Off = its jobs wait, nothing is lost. */
export function ApplyOnCard() {
  const { data: settings } = useSettings();
  const { data: stats } = useStats();
  const qc = useQueryClient();
  const toast = useToast();
  const set = useMutation({
    mutationFn: ({ setting, enabled }: { setting: string; enabled: boolean }) => api.patch<Settings>('/settings', { sources: { [setting]: { enabled } } }),
    onSuccess: (s, v) => {
      qc.setQueryData(['settings'], s);
      void qc.invalidateQueries({ queryKey: ['agent'] });
      void qc.invalidateQueries({ queryKey: ['insights'] });
      const name = PLATFORMS.find((p) => p.setting === v.setting)?.label ?? 'Company career sites';
      toast('ok', v.enabled ? `${name} is on` : `${name} is off - its jobs wait until you turn it back on`);
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const on = PLATFORMS.filter((p) => settings?.sources[p.setting].enabled).length;
  const { data: agent } = useAgent();
  const healthOf = (p: string) => agent?.platformHealth.find((h) => h.platform === p)?.status;
  // When a site that is refusing applications gets tried again, on this computer's clock.
  const untilOf = (p: string) => {
    const until = agent?.platformHealth.find((h) => h.platform === p)?.until;
    return until ? new Date(until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'later';
  };

  return (
    <Card>
      <div id="apply-on" className="scroll-mt-4" />
      <CardHeader
        title="Apply on"
        hint={
          on === PLATFORMS.length
            ? 'Every platform is on.'
            : on === 0
              ? 'Everything is off - Sudarshan AI will not apply anywhere.'
              : 'Only platforms that are on are searched and applied to. Switching one off keeps its jobs waiting.'
        }
        action={
          <InfoTip title="What Sudarshan AI can and can't do">
            <span className="block">
              It fills most application forms by itself - LinkedIn Easy Apply, Naukri, Indeed, Instahyre and company career sites (Keka, Greenhouse, Lever...) -
              and uploads your resume.
            </span>
            <span className="mt-2 block font-semibold text-ink">What it can't do on its own</span>
            <span className="mt-1 block">
              <b>Captchas and security checks</b> - by design, you do them. It fills everything else, leaves the tab open and moves on to the next job; the job
              waits in Applications as "Do by hand". Solve the captcha and press Submit in that tab and it turns Applied by itself. Everywhere else it presses
              Submit itself - it stops only when a real captcha (an "I'm not a robot" box or a picture test) shows up.
            </span>
            <span className="mt-1 block">
              <b>Sites that make you create an account or log in</b>, or <b>verify with a code sent to your email or phone (OTP)</b> - these become "Do by hand"
              in Applications.
            </span>
            <span className="mt-2 block">When it gets stuck, the tab stays open: finish it there and Sudarshan AI learns your answers for next time.</span>
          </InfoTip>
        }
      />
      <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const cfg = settings?.sources[p.setting];
          const enabled = cfg?.enabled ?? false;
          const queued = stats?.queuedByPlatform[p.key] ?? 0;
          const today = stats?.appliedTodayByPlatform[p.key] ?? 0;
          const health = healthOf(p.key);
          return (
            <SiteCard
              key={p.key}
              title={p.label}
              dot={p.key}
              description={ABOUT[p.key]}
              enabled={enabled}
              disabled={!settings || set.isPending}
              onToggle={() => set.mutate({ setting: p.setting, enabled: !enabled })}
              used={enabled ? { done: today, limit: cfg?.dailyLimit ?? 0 } : null}
              status={
                health === 'broken'
                  ? { text: 'Paused - its pages seem to have changed', tone: 'warn' }
                  : health === 'careful'
                    ? { text: 'Careful mode - stops before each Submit', tone: 'warn' }
                    : health === 'cooling'
                      ? { text: `Refusing for now - again at ${untilOf(p.key)}`, tone: 'warn' }
                      : enabled
                        ? { text: queued ? `${queued} queued` : 'Nothing queued' }
                        : { text: queued ? `Off - ${queued} waiting` : 'Off' }
              }
            />
          );
        })}
        {settings && (
          <SiteCard
            title="Company career sites"
            description="Follows “Apply on company site” and fills the company's own form - Greenhouse, Lever, Ashby, Workday and others."
            enabled={settings.sources.externalSites.enabled}
            disabled={set.isPending}
            onToggle={() => set.mutate({ setting: 'externalSites', enabled: !settings.sources.externalSites.enabled })}
            used={null}
            status={{ text: settings.sources.externalSites.enabled ? `Up to ${settings.sources.externalSites.dailyLimit} a day` : 'Off' }}
          />
        )}
      </div>
    </Card>
  );
}

/** What each site is and how Sudarshan AI applies there. */
const ABOUT: Record<string, string> = {
  linkedin: 'Easy Apply inside LinkedIn; other jobs go on to the company’s own site.',
  naukri: 'One-click apply, including its chat-style screening questions.',
  indeed: 'Indeed Apply. Log in for more than the first page; a real captcha comes to you.',
  instahyre: 'One-click apply to tech jobs.',
  foundit: 'One-click apply, or on to the company’s own site.',
  hirist: 'Tech jobs - one click, or its short screening form.',
  himalayas: 'Remote jobs open to your country, applied to on the company’s form.',
  other: 'Job links you add from any career site.',
};

function SiteCard({
  title,
  dot,
  description,
  enabled,
  disabled,
  onToggle,
  used,
  status,
}: {
  title: string;
  dot?: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
  /** Today's applications against the daily limit, when it is on. */
  used: { done: number; limit: number } | null;
  status: { text: string; tone?: 'warn' };
}) {
  const full = !!used?.limit && used.done >= used.limit;
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border p-3.5 transition-colors',
        enabled ? 'border-accent/35 bg-accent-soft/25' : 'border-line bg-surface-2/40',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className={cn('flex items-center gap-1.5 text-[14px] font-semibold', !enabled && 'text-ink-2')}>
          {dot && <PlatformDot platform={dot as never} />}
          {title}
        </h4>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${title}: ${enabled ? 'on' : 'off'}`}
          disabled={disabled}
          onClick={onToggle}
          className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60', enabled ? 'bg-accent' : 'bg-line-strong')}
        >
          <span
            className={cn('absolute top-0.5 left-0 size-4 rounded-full bg-surface shadow transition-transform', enabled ? 'translate-x-4.5' : 'translate-x-0.5')}
          />
        </button>
      </div>
      <p className="mt-1 mb-3 text-[12.5px] leading-snug text-ink-3">{description}</p>
      <div className="mt-auto">
        {used && used.limit > 0 && (
          <>
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="text-ink-3">Today</span>
              <b className={cn('tabular', full ? 'text-warn' : 'text-ink')}>
                {used.done} / {used.limit}
              </b>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <i className={cn('block h-full rounded-full', full ? 'bg-warn' : 'bg-accent')} style={{ width: `${Math.min(100, (used.done / used.limit) * 100)}%` }} />
            </div>
          </>
        )}
        <p className={cn('mt-1.5 text-[12px]', status.tone === 'warn' ? 'font-medium text-warn' : 'text-ink-3')}>{status.text}</p>
      </div>
    </div>
  );
}
