// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export enum LearnerName {
  /** Which of your details a form field asks for, in any wording or language. */
  FIELD = 'field',
  /** Whether two questions ask the same thing (current vs expected CTC are not). */
  QUESTION = 'question',
  /** Which button moves an application forward on a site not seen before. */
  BUTTON = 'button',
  /** How likely an application is to go through without you. */
  OUTCOME = 'outcome',
}
