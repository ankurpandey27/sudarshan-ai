// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { LearnerName } from '../enums/learner-name.enum';

export const LEARNER_LABELS: Record<LearnerName, string> = {
  [LearnerName.FIELD]: 'Which of your details a field asks for',
  [LearnerName.QUESTION]: 'Whether two questions ask the same thing',
  [LearnerName.BUTTON]: 'Which button moves an application forward',
  [LearnerName.OUTCOME]: 'Which applications will go through without you',
};

/** Examples a learner needs before it learns anything. */
export const MIN_EXAMPLES: Record<LearnerName, number> = {
  [LearnerName.FIELD]: 40,
  [LearnerName.QUESTION]: 40,
  [LearnerName.BUTTON]: 30,
  [LearnerName.OUTCOME]: 100,
};

/** Switched on only when right at least this often, on at least this many cases it had not seen... */
export const PROMOTE_ACCURACY = 0.95;
export const PROMOTE_MIN_CHECKS = 20;
/** ...and switched back to checking when live checks fall below this. */
export const DEMOTE_ACCURACY = 0.9;
/** Live checks that count: the most recent ones. */
export const RECENT_CHECKS = 50;

/** Retrained this often (and at start), from everything learned since. */
export const TRAIN_EVERY_MS = 6 * 60 * 60_000;
/** Neighbours asked, how similar the closest must be, and how many of them must agree. */
export const KNN_K = 5;
export const KNN_MIN_SIMILARITY = 0.75;
export const KNN_MIN_AGREEMENT = 0.8;

/** Plain gradient descent with a little L2: small data, fast, explainable. */
export const LOGISTIC = { steps: 400, rate: 0.5, l2: 0.01 };

/** Words that turn a question into a different one when only one side has them. */
export const MEANING_FLIPS: RegExp[] = [
  /\bcurrent|present|last drawn|existing\b/,
  /\bexpected|desired|expectation\b/,
  /\bminimum|\bmin\b/,
  /\bmaximum|\bmax\b/,
  /\bpermanent\b/,
  /\blocal\b/,
  /\bper month|monthly|in hand\b/,
  /\bannual|per annum|yearly|\blpa\b/,
  /\bdays?\b/,
  /\bweeks?\b/,
  /\b10th|tenth|ssc|matric/,
  /\b12th|twelfth|hsc|intermediate/,
  /\bprevious|former|last company\b/,
  /\bfather|mother|spouse|reference|referr/,
  /\bnot\b|\bnever\b/,
  /\bsecondary|alternate|alternative\b/,
];
/** Past answers the question learner is at least this sure are about something else are not shown to the AI. */
export const DIFFERENT_BELOW = 0.2;
/** The outcome learner reorders the queue only when it ranks success above failure this often on the newest attempts... */
export const OUTCOME_MIN_AUC = 0.75;
/** ...tested on at least this many of them. */
export const OUTCOME_MIN_TESTED = 50;
/** After something worth learning, retrain this soon (once, however much happened meanwhile). */
export const TRAIN_SOON_MS = 60_000;
