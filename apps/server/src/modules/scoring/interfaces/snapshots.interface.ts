// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface ProfileSnapshot {
  currentRole?: string;
  yearsExperience: number;
  skills: string[];
  expectedSalary: number;
  salaryCurrency: string;
  location: string;
  remotePreferred: boolean;
  willingToRelocate: boolean;
  /** Places the user searched; a job in any of them is never "too far". */
  searchLocations: string[];
  summary?: string;
}

export interface JobSnapshot {
  id?: number;
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryRaw?: string;
  requiredSkills: string[];
  description: string;
}
