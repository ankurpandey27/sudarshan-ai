// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Link } from 'react-router';
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/format';
import { useInsights } from '../lib/queries';

/** One line on Lakshya: how many things need you, with a link to the Needs attention page. */
export function AttentionSummary() {
  const { data, isLoading } = useInsights();
  if (isLoading) return null;
  const items = data ?? [];
  const blocking = items.filter((i) => i.severity === 'error').length;
  const needsYou = items.filter((i) => i.severity === 'warn').length;
  const tips = items.length - blocking - needsYou;

  if (!blocking && !needsYou) {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-2xl border border-good/25 bg-good-soft/50 px-5 py-3 text-[13.5px]">
        <CheckCircle2 className="size-4 text-good" />
        <b>All clear.</b> Nothing is blocking the agent.
        {tips > 0 && (
          <Link to="/attention" className="ml-auto text-[12.5px] text-info hover:underline">
            {tips} tip{tips === 1 ? '' : 's'}
          </Link>
        )}
      </div>
    );
  }
  const first = items.find((i) => i.severity !== 'info');
  return (
    <Link
      to="/attention"
      className={cn(
        'group mb-5 flex items-center gap-3 rounded-2xl border px-5 py-3 text-[13.5px] transition-colors',
        blocking ? 'border-bad/35 bg-bad-soft/60 hover:border-bad/60' : 'border-warn/35 bg-warn-soft/60 hover:border-warn/60',
      )}
    >
      {blocking ? <AlertOctagon className="size-4 shrink-0 text-bad" /> : <AlertTriangle className="size-4 shrink-0 text-warn" />}
      <span className="min-w-0">
        <b>{[blocking && `${blocking} blocking`, needsYou && `${needsYou} need${needsYou === 1 ? 's' : ''} you`].filter(Boolean).join(', ')}</b>
        {first && <span className="text-ink-2"> - {first.title}</span>}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-ink-2 group-hover:text-ink">
        Open <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}
