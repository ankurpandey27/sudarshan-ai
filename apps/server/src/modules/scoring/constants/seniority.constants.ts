// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Titles of roles for people starting out: internships, trainee and fresher roles, junior posts. */
export const JUNIOR_TITLE =
  /\b(intern|interns|internship|trainee|trainees|fresher|freshers|apprentice|apprenticeship|graduate (trainee|program|programme|scheme)|entry[- ]level|campus (hire|hiring)|junior|jr\.?(?![-\s]?\d)|praktikant|praktikum|werkstudent|stagiaire|becario|pasante|estagi[aá]rio)\b/i;

/** The most experience asked for is capped here: anything bigger is a salary or a date, not years. */
export const MAX_YEARS_ASKED = 30;

/** Automatic level: your experience minus a year, at most this. */
export const AUTO_LEVEL_CAP = 3;

/** Senior roles: never skipped as junior, whatever a line in their description says. */
export const SENIOR_TITLE = /\b(senior|sr\.?|lead|principal|staff|head|manager|architect|director)\b/i;
