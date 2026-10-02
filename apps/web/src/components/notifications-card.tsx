// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Send } from 'lucide-react';
import { api } from '../lib/api';
import { desktopNotifyOn, setDesktopNotify } from '../lib/desktop-notify';
import type { Settings, TelegramStatus } from '../lib/types';
import { Button, Card, CardHeader, Field, Input, Select, Toggle } from './ui';
import { useToast } from './toast';

const hourLabel = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? 'am' : 'pm'}`;

/** Desktop notifications, the daily summary, and Telegram. `agent` and `onAgent` are the Settings draft (saved with it). */
export function NotificationsCard({
  agent,
  onAgent,
}: {
  agent: Settings['agent'];
  onAgent: <K extends keyof Settings['agent']>(k: K, v: Settings['agent'][K]) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [desktop, setDesktop] = useState(desktopNotifyOn());
  const [token, setToken] = useState('');
  const { data: tg } = useQuery({ queryKey: ['telegram'], queryFn: () => api.get<TelegramStatus>('/notifications/telegram') });
  const done = (s: TelegramStatus) => qc.setQueryData(['telegram'], s);
  const fail = (e: Error) => toast('error', e.message);

  const saveToken = useMutation({ mutationFn: () => api.post<TelegramStatus>('/notifications/telegram/token', { token }), onSuccess: (s) => (done(s), setToken('')), onError: fail });
  const connect = useMutation({
    mutationFn: () => api.post<TelegramStatus>('/notifications/telegram/connect'),
    onSuccess: (s) => (done(s), toast('ok', 'Telegram connected')),
    onError: fail,
  });
  const disconnect = useMutation({ mutationFn: () => api.del<TelegramStatus>('/notifications/telegram'), onSuccess: done, onError: fail });
  const test = useMutation({
    mutationFn: () => api.post<{ telegram: boolean }>('/notifications/test'),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['telegram'] });
      toast('ok', r.telegram ? 'Test sent - check Telegram and your desktop' : tg?.chatId ? 'Telegram did not take it - see the error below' : 'Test sent to this computer');
    },
    onError: fail,
  });
  const summary = useMutation({ mutationFn: () => api.post('/notifications/summary/send'), onSuccess: () => toast('ok', "Today's summary sent"), onError: fail });

  const toggleDesktop = async (on: boolean) => {
    const now = await setDesktopNotify(on);
    setDesktop(now);
    if (on && !now) toast('error', 'The browser blocked notifications - allow them for this site in its address bar, then try again');
  };

  return (
    <>
      <Card>
        <CardHeader title="Notifications" hint="Know what happened without watching Sudarshan" />
        <div className="space-y-3 p-4">
          <Toggle
            checked={desktop}
            onChange={(v) => void toggleDesktop(v)}
            label="Desktop notifications"
            hint="While Sudarshan is open in this browser. Your browser asks once."
          />
          <Toggle
            checked={agent.notifyNeedsYou}
            onChange={(v) => onAgent('notifyNeedsYou', v)}
            label="When an application needs me"
            hint="A captcha to solve, or questions only you can answer - gathered into one message"
          />
          <Field label="Daily summary" hint="Applied, waiting for you, failed and found - once a day">
            <Select value={agent.dailySummaryHour} onChange={(e) => onAgent('dailySummaryHour', Number(e.target.value))}>
              <option value={-1}>Off</option>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  At {hourLabel(h)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" icon={<Bell className="size-3.5" />} loading={test.isPending} onClick={() => test.mutate()}>
              Send a test
            </Button>
            <Button size="sm" icon={<Send className="size-3.5" />} loading={summary.isPending} onClick={() => summary.mutate()}>
              Send today's summary now
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Telegram (optional)" hint="Get the same messages on your phone, even away from this computer" />
        <div className="space-y-3 p-4 text-[13.5px]">
          {tg?.chatId ? (
            <div className="flex flex-wrap items-center gap-3">
              <Check className="size-4 text-good" />
              <span className="flex-1">
                Connected to <b>{tg.bot}</b>
              </span>
              <Button size="sm" variant="ghost" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
                Disconnect
              </Button>
            </div>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-ink-2">
              <li>
                In Telegram, open <b>@BotFather</b>, send <code>/newbot</code>, and pick any name. It gives you a token like <code>123456:AAH...</code>.
              </li>
              <li>
                <div className="flex gap-2">
                  <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the bot token" aria-label="Bot token" />
                  <Button size="sm" loading={saveToken.isPending} disabled={!token.trim()} onClick={() => saveToken.mutate()}>
                    Save
                  </Button>
                </div>
                {tg?.connected && <span className="mt-1 block text-[12.5px] text-good">Token saved for {tg.bot}</span>}
              </li>
              <li>
                Send your bot any message (like "hi"), then{' '}
                <Button size="sm" loading={connect.isPending} disabled={!tg?.connected} onClick={() => connect.mutate()}>
                  Connect
                </Button>
              </li>
            </ol>
          )}
          {tg?.error && <p className="text-[13px] text-bad">Last message failed: {tg.error}</p>}
          <p className="text-[12.5px] text-ink-3">The token is stored encrypted on this computer. Only you and your bot are in the chat.</p>
        </div>
      </Card>
    </>
  );
}
