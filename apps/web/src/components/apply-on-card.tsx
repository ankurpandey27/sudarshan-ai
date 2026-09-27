// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { cn, PLATFORMS } from '../lib/format';
import { useSettings, useStats } from '../lib/queries';
import type { Settings } from '../lib/types';
import { PlatformDot } from './platform-badge';
import { Card, CardHeader } from './ui';
import { InfoTip } from './info-tip';
import { useToast } from './toast';

/** Which platforms Sudarshan searches and applies on. Off = its jobs wait, nothing is lost. */
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

  return (
    <Card>
      <div id="apply-on" className="scroll-mt-4" />
      <CardHeader
        title="Apply on"
        hint={
          on === PLATFORMS.length
            ? 'Every platform is on.'
            : on === 0
              ? 'Everything is off - Sudarshan will not apply anywhere.'
              : 'Only platforms that are on are searched and applied to. Switching one off keeps its jobs waiting.'
        }
        action={
          <InfoTip title="What Sudarshan can and can't do">
            <span className="block">
              It fills most application forms by itself - LinkedIn Easy Apply, Naukri, Indeed, Instahyre and company career sites (Keka, Greenhouse, Lever...) -
              and uploads your resume.
            </span>
            <span className="mt-2 block font-semibold text-ink">What it can't do on its own</span>
            <span className="mt-1 block">
              <b>Captchas and security checks</b> - by design, you do them. It fills everything else and leaves the tab open.
            </span>
            <span className="mt-1 block">
              <b>Sites that make you create an account or log in</b>, or <b>verify with a code sent to your email or phone (OTP)</b> - these become "Do by hand"
              in Applications.
            </span>
            <span className="mt-2 block">When it gets stuck, the tab stays open: finish it there and Sudarshan learns your answers for next time.</span>
          </InfoTip>
        }
      />
      <div className="flex flex-wrap gap-2 px-5 py-4">
        {PLATFORMS.map((p) => {
          const cfg = settings?.sources[p.setting];
          const enabled = cfg?.enabled ?? false;
          const queued = stats?.queuedByPlatform[p.key] ?? 0;
          const today = stats?.appliedTodayByPlatform[p.key] ?? 0;
          return (
            <Pill
              key={p.key}
              enabled={enabled}
              disabled={!settings || set.isPending}
              onToggle={() => set.mutate({ setting: p.setting, enabled: !enabled })}
              label={
                <>
                  <PlatformDot platform={p.key} /> {p.label}
                </>
              }
              meta={enabled ? `${today}/${cfg?.dailyLimit ?? '-'} today${queued ? ` · ${queued} queued` : ''}` : queued ? `off · ${queued} waiting` : 'off'}
            />
          );
        })}
        {settings && (
          <Pill
            enabled={settings.sources.externalSites.enabled}
            disabled={set.isPending}
            onToggle={() => set.mutate({ setting: 'externalSites', enabled: !settings.sources.externalSites.enabled })}
            title="When a job says 'Apply on company site', follow it and fill the company's form (Keka, Greenhouse, Lever...)"
            label="Company career sites"
            meta={settings.sources.externalSites.enabled ? `up to ${settings.sources.externalSites.dailyLimit}/day` : 'off'}
          />
        )}
      </div>
    </Card>
  );
}

function Pill({
  enabled,
  disabled,
  onToggle,
  label,
  meta,
  title,
}: {
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
  label: React.ReactNode;
  meta: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onToggle}
      title={title}
      className={cn(
        'flex items-center gap-2.5 rounded-full border py-1.5 pr-3.5 pl-1.5 text-left transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] disabled:opacity-60',
        enabled ? 'border-accent/45 bg-accent-soft/45' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', enabled ? 'bg-accent' : 'bg-line-strong')}>
        <span
          className={cn('absolute top-0.5 left-0 size-4 rounded-full bg-surface shadow transition-transform', enabled ? 'translate-x-4.5' : 'translate-x-0.5')}
        />
      </span>
      <span className="flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap">{label}</span>
      <span className={cn('text-[12px] whitespace-nowrap tabular', enabled ? 'text-ink-2' : 'text-ink-3')}>{meta}</span>
    </button>
  );
}
