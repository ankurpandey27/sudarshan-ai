// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MailCheck, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import type { InboxStatus } from '../lib/types';
import { Button, Card, CardHeader, Field, Input } from './ui';
import { useToast } from './toast';

const KINDS = [
  ['offer', 'offers'],
  ['interview', 'interviews'],
  ['assessment', 'tests'],
  ['rejected', 'not selected'],
  ['received', 'received'],
] as const;

/** Reads employers' replies from your mailbox (IMAP, app password) and matches them to your applications. */
export function InboxCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data } = useQuery({ queryKey: ['inbox'], queryFn: () => api.get<InboxStatus>('/inbox') });
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState('');
  const [showHost, setShowHost] = useState(false);
  const done = (s: InboxStatus) => {
    qc.setQueryData(['inbox'], s);
    void qc.invalidateQueries({ queryKey: ['replies'] });
  };
  const fail = (e: Error) => {
    if (/IMAP server/.test(e.message)) setShowHost(true);
    toast('error', e.message);
  };

  const connect = useMutation({
    mutationFn: () => api.post<InboxStatus>('/inbox/connect', { user, password, ...(host.trim() ? { host: host.trim() } : {}) }),
    onSuccess: (s) => {
      done(s);
      setPassword('');
      toast('ok', 'Mailbox connected - reading the last 30 days now');
    },
    onError: fail,
  });
  const check = useMutation({
    mutationFn: () => api.post<InboxStatus & { added: number }>('/inbox/check'),
    onSuccess: (s) => (done(s), toast('ok', s.added ? `${s.added} new reply(ies) found` : 'No new replies')),
    onError: fail,
  });
  const disconnect = useMutation({ mutationFn: () => api.del<InboxStatus>('/inbox'), onSuccess: done, onError: fail });

  const counts = KINDS.filter(([k]) => data?.replies[k]).map(([k, word]) => `${data!.replies[k]} ${word}`);

  return (
    <Card>
      <CardHeader title="Replies from your email (optional)" hint="See which applications got an answer - interviews, tests, offers, or no" />
      <div className="space-y-3 p-4 text-[13.5px]">
        {data?.connected ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Check className="size-4 text-good" />
              <span className="flex-1">
                Reading <b>{data.user}</b>
                {data.lastCheck && <span className="text-ink-3"> - checked {timeAgo(data.lastCheck)}</span>}
              </span>
              <Button size="sm" icon={<RefreshCw className="size-3.5" />} loading={check.isPending} onClick={() => check.mutate()}>
                Check now
              </Button>
              <Button size="sm" variant="ghost" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
                Disconnect
              </Button>
            </div>
            <p className="text-ink-2">{counts.length ? `Matched so far: ${counts.join(', ')}.` : 'No replies matched to your applications yet.'} They show on Applications.</p>
          </>
        ) : (
          <>
            <p className="text-ink-2">
              Works with Gmail, Yahoo, iCloud, Zoho, Fastmail and most others. Use an <b>app password</b> - for Gmail: Google Account, Security, 2-Step
              Verification, App passwords.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Email address">
                <Input type="email" value={user} onChange={(e) => setUser(e.target.value)} placeholder="you@gmail.com" autoComplete="off" />
              </Field>
              <Field label="App password">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="abcd efgh ijkl mnop" autoComplete="new-password" />
              </Field>
            </div>
            {showHost && (
              <Field label="IMAP server" hint="Only needed for providers Sudarshan AI does not know">
                <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="imap.example.com" />
              </Field>
            )}
            <Button size="sm" icon={<MailCheck className="size-3.5" />} loading={connect.isPending} disabled={!user.trim() || !password.trim()} onClick={() => connect.mutate()}>
              Connect mailbox
            </Button>
          </>
        )}
        {data?.error && <p className="text-[13px] text-bad">Last check failed: {data.error}</p>}
        <p className="text-[12.5px] text-ink-3">
          Read on this computer only, never by an AI. Only replies about your applications are kept - sender, subject and what they mean, not the email. The
          password is stored encrypted.
        </p>
      </div>
    </Card>
  );
}
