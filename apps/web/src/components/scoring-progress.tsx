// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useAgent } from '../lib/queries';
import type { ScoringProgress as Progress } from '../lib/types';

const STAGE: Record<Progress['stage'], string> = {
  rules: 'Checking location, salary and your skip rules',
  ai: 'Asking the AI how well each job fits you',
  saving: 'Sorting jobs into Review, the queue and Skipped',
};

const eta = (s: number | null) =>
  s === null ? 'working out time left' : s < 60 ? `about ${Math.max(5, Math.round(s / 5) * 5)}s left` : `about ${Math.round(s / 60)} min left`;

/** A live bar while jobs are scored, then a short "done" note. */
export function ScoringProgress() {
  const { data } = useAgent();
  const qc = useQueryClient();
  const p = data?.scoring ?? null;
  // A run that finished between two status checks still shows its result (rule-based scoring takes seconds).
  const last = data?.lastScoring ?? null;
  const shown = useRef<string | null>(null);
  const [finished, setFinished] = useState<NonNullable<typeof last> | null>(null);

  useEffect(() => {
    if (p) {
      setFinished(null);
      return;
    }
    if (!last || shown.current === last.at) return;
    shown.current = last.at;
    setFinished(last);
    // Fresh numbers everywhere once scoring ends.
    void qc.invalidateQueries();
    const t = setTimeout(() => setFinished(null), 8000);
    return () => clearTimeout(t);
  }, [p, last, qc]);

  if (!p && finished) {
    const parts = [
      finished.review && `${finished.review} to Review`,
      finished.queued && `${finished.queued} queued`,
      finished.skipped && `${finished.skipped} skipped`,
    ].filter(Boolean);
    return (
      <div className="mb-5 flex items-center gap-2 rounded-2xl border border-good/25 bg-good-soft/50 px-5 py-3 text-[13.5px]" role="status">
        <CheckCircle2 className="size-4 text-good" />
        Scored {finished.scored} job{finished.scored === 1 ? '' : 's'}
        {parts.length ? ` - ${parts.join(', ')}` : ''}. Review and the charts are up to date.
      </div>
    );
  }
  if (!p) return null;
  const share = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return (
    <section className="mb-5 rounded-2xl border border-accent/30 bg-accent-soft/35 px-5 py-4" role="status" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[14px] font-semibold">
          Scoring jobs{' '}
          <span className="font-normal text-ink-2 tabular">
            - {p.done} of {p.total}
          </span>
        </p>
        <p className="text-[12.5px] text-ink-3 tabular">
          {share}% · {eta(p.etaSeconds)}
        </p>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface/80">
        <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${Math.max(2, share)}%` }} />
      </div>
      <p className="mt-2 text-[12.5px] text-ink-2">
        {STAGE[p.stage]}
        {p.skipped > 0 && <span className="text-ink-3"> · {p.skipped} skipped by your rules so far</span>}
      </p>
    </section>
  );
}
