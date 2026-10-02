// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { InterviewQuestion } from '../interfaces/interview-question.interface';

/**
 * The Story Bank interview: the true, specific material written answers are built from, asked once and
 * kept. Adapted from the linkedin-interviewer skill (github.com/sergebulaev/linkedin-skills, MIT): open
 * wide, press a soft answer once for a number, a date or a name, then move on.
 */
export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'proudest',
    question: 'What is the piece of work you are proudest of?',
    why: '"Tell us about a project you are proud of" and "Why are you a fit?"',
    example: 'I rebuilt the order service at Acme in NestJS; checkout errors fell from about 2% to 0.3% in two months.',
  },
  {
    id: 'improved',
    question: 'What did you make faster, cheaper or more reliable - and by how much?',
    why: '"Describe an impact you had" and achievement questions',
    example: 'Moved our reports from nightly cron jobs to a queue; they now finish in 4 minutes instead of 50.',
  },
  {
    id: 'hardest',
    question: 'What was the hardest technical problem you solved, and how?',
    why: '"Describe a challenging problem" questions',
    example: 'A memory leak that crashed our Node.js API every few days - found it with heap snapshots in a third-party SDK.',
  },
  {
    id: 'led',
    question: 'When did you lead people or a piece of work? How many, and what came of it?',
    why: 'Leadership, mentoring and ownership questions',
    example: 'Led 3 developers through the move to microservices over 6 months; I wrote the plan and did the reviews.',
  },
  {
    id: 'automated',
    question: 'What did you automate, and what did it save?',
    why: '"Describe a workflow you automated" questions',
    example: 'A GitHub Actions pipeline that tests and deploys on every merge; releases went from weekly to daily.',
  },
  {
    id: 'mistake',
    question: 'Tell me about a mistake or a failure, and what you changed after it.',
    why: '"Tell us about a failure" and growth questions',
    example: 'I shipped a migration without a rollback and we lost an hour of orders; now every migration has one, tested first.',
  },
  {
    id: 'why-next',
    question: 'What kind of work do you want next, and why?',
    why: '"Why do you want this role?" and motivation questions',
    example: 'More backend architecture and less firefighting - I want to design systems from the start, not patch them.',
  },
  {
    id: 'stance',
    question: 'What do you believe about building software that some colleagues would disagree with?',
    why: 'Culture and "how do you work" questions',
    example: 'Fewer services, not more: most teams split too early and pay for it in deploys.',
  },
];

/** Stories shown to the AI for one application, most relevant first. */
export const STORIES_PER_APPLICATION = 4;

/** Characters of each story shown to the AI. */
export const STORY_PROMPT_CHARS = 400;
