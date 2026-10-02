// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** One job in Foundit's search data (/middleware/jobsearch), the fields Sudarshan reads. Verified 2026-10-02. */
export interface FounditJob {
  jobId: number;
  title: string;
  companyName?: string;
  hideCompanyName?: number;
  locations?: string;
  skills?: string;
  exp?: string;
  minimumExperience?: { years?: number };
  /** Set when the listing only points elsewhere: a LinkedIn job, or a company's own career site. */
  redirectUrl?: string;
  seoJdUrl?: string;
  jdUrl?: string;
  createdAt?: number;
  minimumSalary?: { absoluteValue?: number };
  maximumSalary?: { absoluteValue?: number };
  hideSalary?: number;
}

export interface FounditSearchResponse {
  jobSearchResponse?: { data?: (FounditJob | null)[]; meta?: { paging?: { total?: number; cursors?: { next?: string } } } };
}

/** One job in Hirist's search API (gladiator.hirist.tech/job/search). Verified 2026-10-02. */
export interface HiristJob {
  id: number;
  title: string;
  min?: number;
  max?: number;
  jobDetailUrl?: string;
  applyUrl?: string;
  workFromHome?: number;
  createdTime?: number;
  tags?: { name: string }[];
  locations?: { name: string }[];
  companyData?: { companyName?: string };
}

export interface HiristSearchResponse {
  data?: HiristJob[];
}
