// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { platformLabel } from '../lib/format';
import type { JobPlatform } from '../lib/types';
import { Badge } from './ui';

// Each platform's own colour, as a small dot so it reads in light and dark.
export const PLATFORM_COLOR: Record<JobPlatform, string> = {
  linkedin: 'var(--p-linkedin)',
  naukri: 'var(--p-naukri)',
  indeed: 'var(--p-indeed)',
  instahyre: 'var(--p-instahyre)',
  other: 'var(--p-other)',
};
const DOT = PLATFORM_COLOR;

export function PlatformBadge({ platform, site }: { platform: JobPlatform; site?: string }) {
  return (
    <Badge>
      <span className="size-1.5 rounded-full" style={{ background: DOT[platform] }} aria-hidden />
      {platform === 'other' && site ? site : platformLabel(platform)}
    </Badge>
  );
}

export function PlatformDot({ platform }: { platform: JobPlatform }) {
  return <span className="inline-block size-2 rounded-full" style={{ background: DOT[platform] }} aria-hidden />;
}
