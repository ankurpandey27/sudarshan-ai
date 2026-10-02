// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Extra resumes live here, inside uploads - never cleared by the daily clean-up. */
export const RESUMES_DIR = 'resumes';

/** At most this many extra resumes. */
export const MAX_RESUMES = 8;

/** A word for the kind of job a resume is for counts this much in the job's title, 1 in its description. */
export const TITLE_WEIGHT = 3;

/** Each skill a job asks for that the resume shows adds this much (only breaks ties between resumes). */
export const SKILL_WEIGHT = 0.2;
