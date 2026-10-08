// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** The part of an Indeed search result (mosaic-provider-jobcards) Sudarshan AI uses. */
export interface IndeedCard {
  jobkey: string;
  title?: string;
  displayTitle?: string;
  company?: string;
  formattedLocation?: string;
  remoteLocation?: boolean;
  salarySnippet?: { text?: string };
  snippet?: string;
  pubDate?: number;
  indeedApplyEnabled?: boolean;
  expired?: boolean;
}
