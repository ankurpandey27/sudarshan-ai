// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export const WORKBOOK_MAX_BYTES = 5 * 1024 * 1024;

export const SHEET_ANSWERS = 'Answers';
export const SHEET_LINKS = 'Job Links';
export const SHEET_PREFERENCES = 'Preferences';

export const TEMPLATE_ANSWERS: [string, string][] = [
  ['What is your notice period?', '30 days'],
  ['Current CTC (in lakhs per annum)', '12'],
  ['Expected CTC (in lakhs per annum)', '18'],
  ['Are you willing to relocate?', 'Yes'],
  ['How many years of experience do you have with Node.js?', '4'],
  ['Do you have a valid passport?', 'Yes'],
  ['Why are you looking for a change?', 'Looking for larger-scale backend problems and ownership of product features.'],
];

export const TEMPLATE_LINKS: [string, string, string, string][] = [
  ['https://www.linkedin.com/jobs/view/4472065469/', 'Senior Software Engineer', 'Upstack Data', 'Easy Apply'],
  ['https://www.naukri.com/job-listings-backend-developer-acme-bengaluru-3-to-6-years-250926000000', 'Backend Developer', 'Acme', ''],
  ['https://boards.greenhouse.io/example/jobs/1234567', 'Platform Engineer', 'Example Inc', 'Any career site works'],
];

// [setting, example value, help]
export const TEMPLATE_PREFERENCES: [string, string, string][] = [
  ['Keywords', 'Node.js Developer, Backend Engineer', 'Comma separated job titles / skills to search'],
  ['Locations', 'Bengaluru, Pune, Remote', 'Comma separated; "Remote" searches remote jobs'],
  ['Remote only', 'No', 'Yes / No'],
  ['Easy Apply only', 'Yes', 'Only jobs that apply inside LinkedIn / Naukri'],
  ['Posted within days', '7', '1-30'],
  ['Exclude companies', 'Company A, Company B', 'Never apply here'],
  ['Exclude title words', 'Intern, Lead, Principal', 'Skip titles containing these words'],
  ['Mode', 'review', 'review = you approve each batch; auto = agent applies on its own'],
  ['Min apply score', '70', '0-100'],
  ['LinkedIn daily limit', '25', 'Stay low to protect your account'],
  ['Naukri daily limit', '40', ''],
  ['Notice period days', '30', 'Used on every form'],
  ['Current CTC', '1200000', 'Yearly, full amount'],
  ['Expected CTC', '1800000', 'Yearly, full amount'],
  ['Willing to relocate', 'Yes', 'Yes / No'],
];
