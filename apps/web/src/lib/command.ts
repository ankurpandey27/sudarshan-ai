// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { PLATFORMS } from './format';
import type { JobPlatform, JobRegion, WorkMode } from './types';

/** What a sentence in the command bar asks for, in the same terms as Review's filters. */
export interface CommandIntent {
  /** "apply to…", "queue…", "approve…": approve the matches. Otherwise just show them. */
  approve: boolean;
  workMode: WorkMode[];
  region: JobRegion | null;
  minScore: number | null;
  platform: JobPlatform | null;
  withinDays: number | null;
  exclude: string[];
  /** The parts that were understood, to show back as chips. */
  understood: string[];
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10, fourteen: 14, thirty: 30 };

/**
 * Reads a plain sentence - "apply to remote India jobs above 80, skip anything asking Java" - without any AI, so it
 * works the same with every model or none. Anything it does not recognise is simply not used; the chips show what was.
 */
export function parseCommand(sentence: string, country: string | null): CommandIntent {
  const text = ` ${sentence.toLowerCase().replace(/\s+/g, ' ')} `;
  const intent: CommandIntent = { approve: false, workMode: [], region: null, minScore: null, platform: null, withinDays: null, exclude: [], understood: [] };
  const home = (country ?? '').trim().toLowerCase();

  intent.approve = /\b(apply|approve|queue|send)\b/.test(text);

  // Words to leave out come first, so "skip anything asking remote" never turns into a remote filter.
  // "not in India", "outside my country": abroad, not a word to leave out.
  let rest = text;
  const homeName = home ? `${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|` : '';
  const notHome = new RegExp(`\\b(?:not in|outside(?: of)?)\\s+(?:${homeName}my country|home)\\b`).exec(rest);
  if (notHome) {
    intent.region = 'abroad';
    rest = rest.replace(notHome[0], ' ');
  }

  // The list runs to the end of its clause: "without php or angular", "except Java, Spring".
  const listed = rest;
  for (const match of listed.matchAll(/\b(?:skip|exclude|without|not|no|except|avoid)\s+(?:anything|any|jobs?|ones?|roles?)?\s*(?:asking(?: for)?|with|mentioning|needing|requiring|that (?:ask|need|mention)s?(?: for)?)?\s*(.+?)(?=[;.!?]|\b(?:above|over|score|from|found|on|in|within|last|apply|approve|queue|show|then)\b|\s*$)/g)) {
    const terms = match[1]
      .split(/\s*(?:,|\/|\bor\b|\band\b|&)\s*/)
      .map((term) => term.trim())
      .filter((term) => term && !/^(anything|any|jobs?|ones?|roles?)$/.test(term));
    for (const term of terms) if (!intent.exclude.includes(term)) intent.exclude.push(term);
    rest = rest.replace(match[0], ' ');
  }

  if (/\bremote\b|\bwfh\b|work from home/.test(rest)) intent.workMode.push('remote');
  if (/\bhybrid\b/.test(rest)) intent.workMode.push('hybrid');
  if (/\bon-?site\b|\boffice\b|in person/.test(rest)) intent.workMode.push('onsite');

  if (intent.region === 'abroad' || /\babroad\b|\boverseas\b|\bforeign\b|\binternational\b/.test(rest)) intent.region = 'abroad';
  else if ((home && new RegExp(`\\b${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(rest)) || /\b(my country|home country|local|domestic)\b/.test(rest)) intent.region = 'home';

  const score = /\b(?:above|over|more than|at least|min(?:imum)?|score)\s*(\d{2,3})\b|\b(\d{2,3})\s*\+|\b(\d{2,3})\s*(?:and|or) (?:above|up|more)\b/.exec(rest);
  if (score) intent.minScore = Math.min(100, Number(score[1] ?? score[2] ?? score[3]));

  for (const platform of PLATFORMS) {
    if (new RegExp(`\\b${platform.label.toLowerCase()}\\b`).test(rest)) {
      intent.platform = platform.key;
      break;
    }
  }

  if (/\btoday\b|\blast 24 ?h|\bpast day\b/.test(rest)) intent.withinDays = 1;
  else if (/\bthis week\b|\blast week\b|\bpast week\b/.test(rest)) intent.withinDays = 7;
  else {
    const days = /\b(?:last|past|within)\s+(\d+|[a-z]+)\s+days?\b/.exec(rest);
    const count = days ? (Number(days[1]) || NUMBER_WORDS[days[1]]) : null;
    if (count) intent.withinDays = Math.min(365, count);
  }

  if (intent.workMode.length) intent.understood.push(intent.workMode.map((mode) => (mode === 'onsite' ? 'On-site' : mode[0].toUpperCase() + mode.slice(1))).join(' or '));
  if (intent.region === 'home') intent.understood.push(country ? `In ${country}` : 'In my country');
  if (intent.region === 'abroad') intent.understood.push('Abroad');
  if (intent.platform) intent.understood.push(PLATFORMS.find((platform) => platform.key === intent.platform)!.label);
  if (intent.minScore !== null) intent.understood.push(`Score ${intent.minScore}+`);
  if (intent.withinDays) intent.understood.push(intent.withinDays === 1 ? 'Found today' : `Last ${intent.withinDays} days`);
  for (const term of intent.exclude) intent.understood.push(`Not "${term}"`);
  return intent;
}
