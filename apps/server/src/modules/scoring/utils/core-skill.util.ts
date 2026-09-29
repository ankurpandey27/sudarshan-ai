// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { canonicalSkill, extractSkills } from '../../discovery/utils/job-normalizer.util';
import { containsTerm } from './whole-term.util';

interface JobText {
  title: string;
  description: string;
  skills: string[];
}

interface CoreSkillSource {
  /** Set in Settings; used as-is when not empty. */
  coreSkills: string[];
  keywords: string[];
  profileSkills: string[];
  currentTitle: string;
  headline: string;
}

/**
 * Your core skills: the ones you set, or else the skills you search for and put in your title and
 * headline (a "Node.js Developer" searching "Nodejs" has Node.js). Canonical names, e.g. "node.js".
 */
export function coreSkillsOf(src: CoreSkillSource): string[] {
  if (src.coreSkills.some((s) => s.trim())) return [...new Set(src.coreSkills.map(canonicalSkill).filter(Boolean))];
  const fromText = extractSkills(`${src.keywords.join(', ')}\n${src.currentTitle}\n${src.headline}`);
  const yours = new Set(src.profileSkills.map(canonicalSkill));
  // Keywords count as they are; skills named in the title or headline only if they are in your profile.
  const keywords = src.keywords.map(canonicalSkill).filter((k) => extractSkills(k).length > 0 || yours.has(k));
  return [...new Set([...keywords, ...fromText.map(canonicalSkill).filter((s) => yours.has(s) || keywords.includes(s))])];
}

/** A canonical skill name for display: "node.js" -> "Node.js". */
export function skillLabel(skill: string): string {
  return skill.charAt(0).toUpperCase() + skill.slice(1);
}

/** The first core skill this job asks for - in its title, its skill list or its description - or null. */
export function coreSkillIn(job: JobText, core: string[]): string | null {
  return coreSkillsIn(job, core)[0] ?? null;
}

/** Every core skill this job asks for, in your order. */
export function coreSkillsIn(job: JobText, core: string[]): string[] {
  if (!core.length) return [];
  const asked = new Set([...job.skills, ...extractSkills(`${job.title}\n${job.description}`)].map(canonicalSkill));
  return core.filter((c) => asked.has(c) || spelledIn(job.title, c) || spelledIn(job.description, c));
}

/** "Node.js and NestJS" / "Node.js, NestJS and Express.js". */
export function skillList(skills: string[]): string {
  const names = skills.map(skillLabel);
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Any spelling of a skill as a whole term: "node.js" also matches NodeJS, Node JS and Node-JS; "nestjs" matches Nest.js. */
function spelledIn(text: string, skill: string): boolean {
  if (containsTerm(text, skill)) return true;
  const parts = skill
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .flatMap((p) => (p.length > 2 && p.endsWith('js') ? [p.slice(0, -2), 'js'] : [p]))
    .filter(Boolean);
  if (!parts.length) return false;
  const body = parts.map((p) => p.replace(/[+#]/g, '\\$&')).join('[\\s.\\-]?');
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, 'i').test(text);
}
