// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { ABOUT_APPLICATION, NOT_A_REPLY } from '../constants/inbox.constants';
import { ReplyKind } from '../interfaces/inbox.interface';

// Most decisive first: a rejection that mentions "interview" ("we will not be moving forward to an interview")
// is a rejection; an invitation to a test before the interview is the test.
const KINDS: [ReplyKind, RegExp][] = [
  ['offer', /\b(offer letter|pleased to (extend|offer)|(extend|extending) (you )?an offer|job offer|offer of employment|congratulations[^.]{0,60}\boffer)\b/i],
  [
    'rejected',
    /\b(unfortunately|regret to inform|not (be )?moving forward|won't be moving forward|will not be (moving|proceeding)|decided (not )?to (move forward|proceed|pursue) with (other|another)|other candidates (whose|who)|not (been )?selected|position has (been|now been) filled|no longer (being )?considered|not a (good )?(fit|match) (for|at)|we (have )?decided to go (ahead|forward) with|not shortlisted|unable to (move forward|offer you|progress))/i,
  ],
  ['assessment', /\b(assessment|coding (test|challenge|round)|online test|take[- ]home|hackerrank|hackerearth|codility|codesignal|testgorilla|mettl|imocha|assignment)\b/i],
  [
    'interview',
    /\b(interview|schedule (a|an|the) (call|chat|conversation|meeting)|phone screen|screening call|your availability|available (for|to) (a )?(call|chat|talk)|calendly\.com|next round|shortlisted|speak with you|meet with (you|our)|discuss (the|this) (role|position|opportunity) (further|with you))\b/i,
  ],
  [
    'received',
    /\b(thank(s| you) for (applying|your (application|interest))|(we('ve| have)|has been) received your application|application (has been |was )?(received|submitted|sent)|your application (to|for) .{1,80} (was|has been) (sent|received|submitted)|successfully applied|you applied (to|for))\b/i,
  ],
];

/**
 * What an employer's reply says, from its subject and first lines - or null when the message is not a reply about
 * an application (a job alert, a newsletter, anything else).
 */
export function classifyReply(subject: string, text: string): ReplyKind | null {
  const head = `${subject}\n${text.slice(0, 2500)}`;
  if (NOT_A_REPLY.test(subject) || (!ABOUT_APPLICATION.test(head) && !/\boffer\b/i.test(head))) return null;
  // Alerts often hide their nature below the subject: one that lists several "Apply" links is not a reply.
  if ((head.match(/\bapply now\b|\beasy apply\b|\bview job\b/gi) ?? []).length >= 3) return null;
  for (const [kind, re] of KINDS) if (re.test(head)) return kind;
  return null;
}
