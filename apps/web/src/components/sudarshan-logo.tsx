// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { CHAKRA_SPOKES as SPOKES, CHAKRA_TEETH as TEETH } from '../lib/chakra';
import { cn } from '../lib/format';

export function SudarshanMark({ size = 28, spinning = false, className }: { size?: number; spinning?: boolean; className?: string }) {
  return (
    <svg
      viewBox="-16 -16 32 32"
      width={size}
      height={size}
      role="img"
      aria-label="Sudarshan"
      className={cn('chakra-spin', spinning && 'fast', className)}
    >
      <polygon points={TEETH} fill="var(--accent)" />
      <circle r="10.6" fill="var(--chakra-core)" />
      <circle r="7.6" fill="none" stroke="var(--accent)" strokeWidth="1.3" />
      {SPOKES.map((a) => (
        <line
          key={a}
          x1={Math.cos(a) * 2.6}
          y1={Math.sin(a) * 2.6}
          x2={Math.cos(a) * 7.6}
          y2={Math.sin(a) * 7.6}
          stroke="var(--accent)"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      ))}
      <circle r="2.5" fill="var(--accent)" />
      <circle r="0.9" fill="var(--chakra-core)" />
    </svg>
  );
}
