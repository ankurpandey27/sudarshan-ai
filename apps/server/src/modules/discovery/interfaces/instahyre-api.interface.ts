// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** The part of Instahyre's /api/v1/job_search response Sudarshan AI uses. */
export interface InstahyreJob {
  id: number;
  title: string;
  locations: string;
  keywords: string[];
  public_url: string;
  employer?: { company_name?: string };
}

export interface InstahyreSearchResponse {
  objects?: InstahyreJob[];
  meta?: { total_count?: number; next?: string | null };
}
