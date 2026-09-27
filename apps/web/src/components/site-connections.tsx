// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LogIn, MonitorSmartphone } from 'lucide-react';
import { api } from '../lib/api';
import { useBrowser } from '../lib/queries';
import { Badge, Button } from './ui';
import { useToast } from './toast';

export function SiteConnections() {
  const { data } = useBrowser();
  const qc = useQueryClient();
  const toast = useToast();
  const login = useMutation({
    mutationFn: (site: string) => api.post('/browser/login', { site }),
    onSuccess: () => {
      toast('ok', 'Log in inside the browser window that opened. This page updates when you are in.');
      void qc.invalidateQueries({ queryKey: ['browser'] });
    },
    onError: (e: Error) => toast('error', e.message),
  });

  if (data && !data.executable) {
    return (
      <p className="rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn">
        No Chrome, Edge or Brave found on this computer. Install Google Chrome, then refresh.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {(data?.sessions ?? []).map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <MonitorSmartphone className="size-4 text-ink-3" />
            <span className="text-sm font-medium">{s.label}</span>
            {s.loggedIn ? (
              <Badge tone="good">
                <CheckCircle2 className="size-3" /> Connected
              </Badge>
            ) : (
              <Badge>{data?.running ? 'Not logged in' : 'Browser closed'}</Badge>
            )}
          </div>
          <Button size="sm" variant={s.loggedIn ? 'ghost' : 'secondary'} icon={<LogIn className="size-3.5" />} onClick={() => login.mutate(s.id)} loading={login.isPending && login.variables === s.id}>
            {s.loggedIn ? 'Open' : 'Log in'}
          </Button>
        </div>
      ))}
      <p className="text-[12px] text-ink-3">
        Opens a separate browser profile just for the agent. Your passwords go to the site, never to this app.
      </p>
    </div>
  );
}
