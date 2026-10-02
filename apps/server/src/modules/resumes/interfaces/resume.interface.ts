// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** An extra resume for one kind of role; your main one is on the Profile. */
export interface Resume {
  id: number;
  /** Your name for it, e.g. "Frontend". */
  label: string;
  /** The file name recruiters see. */
  name: string;
  /** Words of the jobs it is for, e.g. ["frontend", "react", "ui"]. */
  forJobs: string[];
  /** Skills found in it. */
  skills: string[];
  createdAt: string;
}

export interface ResumeRow {
  id: number;
  label: string;
  path: string;
  name: string;
  for_jobs: string;
  skills: string;
  created_at: string;
}

/** The resume chosen for a job. */
export interface ChosenResume {
  path: string;
  label: string;
}
