// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { RESUME_PROMPT_CHARS } from '../constants/profile.constants';

export const RESUME_SYSTEM_PROMPT =
  'You extract structured data from resumes. Copy facts exactly as written; never invent values. Use "" or null when a field is absent.';

export function buildResumePrompt(resumeText: string, today: string): string {
  return `Today is ${today}. Extract this resume into JSON with exactly these keys:
{
  "firstName": string, "lastName": string, "email": string, "phone": string (digits only, no country code),
  "phoneCountryCode": string (like "+91", "" if absent),
  "city": string, "state": string, "country": string, "postalCode": string,
  "headline": string (one-line professional title),
  "currentTitle": string, "currentCompany": string,
  "totalYearsExperience": number (full-time work only, one decimal, exclude internships and education),
  "linkedinUrl": string, "githubUrl": string, "portfolioUrl": string,
  "skills": [{"name": string, "years": number|null}] (every technical skill, tool, language and framework; years only if derivable from the roles that used it),
  "education": [{"degree": string, "field": string, "institution": string, "startYear": number|null, "endYear": number|null, "grade": string}],
  "experience": [{"title": string, "company": string, "location": string, "start": "YYYY-MM", "end": "YYYY-MM" or "", "current": boolean, "summary": string (max 30 words)}],
  "languages": [string] (spoken languages),
  "summary": string (2-3 sentence professional summary in first person, built from the resume)
}

RESUME:
${resumeText.slice(0, RESUME_PROMPT_CHARS)}`;
}
