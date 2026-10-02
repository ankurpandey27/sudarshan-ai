// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface Story {
  id: number;
  /** The interview question it answers, or null for one you added yourself. */
  promptId: string | null;
  title: string;
  text: string;
  /** Skills it mentions, found in its words - used to pick the stories that fit a job. */
  skills: string[];
  createdAt: string;
  updatedAt: string;
}
