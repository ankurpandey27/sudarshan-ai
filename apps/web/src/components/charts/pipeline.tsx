// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { pct } from '../../lib/chart';

export interface PipelineStage {
  id: string;
  label: string;
  value: number;
  hint: string;
}

/** How far jobs get: each stage as a share of the first, with the step-to-step rate between. */
export function Pipeline({ stages }: { stages: PipelineStage[] }) {
  const first = stages[0]?.value ?? 0;
  return (
    <ol className="space-y-3">
      {stages.map((s, i) => {
        const width = first > 0 ? Math.max(2, (s.value / first) * 100) : 0;
        return (
          <li key={s.id} title={s.hint}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span>{s.label}</span>
              <span className="tabular">
                <span className="font-semibold">{s.value}</span>
                {i > 0 && <span className="ml-1.5 text-[11.5px] text-ink-3">{pct(s.value, stages[i - 1].value)} of previous</span>}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                // Deepens stage by stage towards "applied".
                style={{
                  width: `${width}%`,
                  background: `color-mix(in oklab, var(--accent) ${35 + (i / Math.max(1, stages.length - 1)) * 65}%, var(--surface-2))`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
