// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { InsightsPanel } from '../components/insights-panel';
import { PageTitle } from '../components/ui';

/** Everything stopping Sudarshan right now, most serious first, each with how to fix it. */
export function AttentionPage() {
  return (
    <>
      <PageTitle title="Needs attention" sub="What is stopping Sudarshan right now, most serious first - and how to fix each one." />
      <InsightsPanel heading={false} />
    </>
  );
}
