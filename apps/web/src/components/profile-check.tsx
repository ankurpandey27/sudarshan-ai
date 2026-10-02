// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Lightbulb, Plus, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import type { Profile, ProfileCheck, SkillGap } from '../lib/types';
import { Button, Card, CardHeader } from './ui';

const UPPER = new Set(['sql', 'aws', 'gcp', 'css', 'html', 'api', 'ci/cd', 'llm', 'rdbms', 'sre', 'php', 'jwt']);
const SPELLED: Record<string, string> = {
  nosql: 'NoSQL',
  rabbitmq: 'RabbitMQ',
  graphql: 'GraphQL',
  mongodb: 'MongoDB',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  'node.js': 'Node.js',
  nestjs: 'NestJS',
  devops: 'DevOps',
  github: 'GitHub',
  oauth: 'OAuth',
  '.net': '.NET',
};
/** "sql" -> "SQL", "nosql" -> "NoSQL", "kubernetes" -> "Kubernetes", "system design" -> "System design". */
const display = (s: string) => SPELLED[s] ?? (UPPER.has(s) ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1));

/** What would make the profile match more of the jobs found; `onAdd` puts a skill into the profile (and saves it). */
export function ProfileCheckPanel({ profile, onAdd }: { profile: Profile; onAdd: (name: string, years: number | null) => void }) {
  const { data } = useQuery({ queryKey: ['profile-check', profile.skills.length], queryFn: () => api.get<ProfileCheck>('/profile/check') });
  if (!data) return null;
  const yearsOf = (g: SkillGap) => {
    const ys = profile.skills.filter((s) => g.coveredBy?.includes(s.name)).map((s) => s.years ?? 0);
    return ys.length ? Math.max(...ys) : null;
  };
  const nothing = !data.quickAdds.length && !data.missing.length && !data.noYears.length && !data.tips.length;

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink-3">Based on {data.jobs} jobs Sudarshan found in the last 60 days. Matching uses your skills list, not your resume text.</p>
      {nothing && (
        <Card>
          <p className="p-4 text-[13.5px] text-ink-2">Your profile covers what these jobs ask for. Nothing to add.</p>
        </Card>
      )}
      {data.quickAdds.length > 0 && (
        <Card>
          <CardHeader title="Add in one click" hint="You have these, but your skills list does not name them - add them so forms and recruiters see the word" />
          <ul className="divide-y divide-line px-4">
            {data.quickAdds.map((g) => (
              <li key={g.skill} className="flex items-center gap-3 py-2.5">
                <Sparkles className="size-4 shrink-0 text-good" />
                <div className="min-w-0 flex-1 text-[13.5px]">
                  <b>{display(g.skill)}</b> <span className="text-ink-3">- {g.jobs} jobs asked for it</span>
                  <div className="text-[12.5px] text-ink-3">
                    {g.why === 'covered' ? `You list ${g.coveredBy!.join(', ')}` : 'It is on your resume, not in your skills'}
                  </div>
                </div>
                <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => onAdd(display(g.skill), g.why === 'covered' ? yearsOf(g) : null)}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {data.missing.length > 0 && (
        <Card>
          <CardHeader title="Asked for often, not in your profile" hint="Add one only if you really have it - Sudarshan answers forms from these" />
          <div className="flex flex-wrap gap-2 p-4">
            {data.missing.map((g) => (
              <button
                key={g.skill}
                onClick={() => onAdd(display(g.skill), null)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 text-[13px] hover:bg-surface-2"
                title={`Add ${display(g.skill)} to your skills`}
              >
                {display(g.skill)} <span className="text-ink-3">{g.jobs}</span> <Plus className="size-3 text-ink-3" />
              </button>
            ))}
          </div>
        </Card>
      )}
      {(data.noYears.length > 0 || data.tips.length > 0) && (
        <Card>
          <CardHeader title="Tips" />
          <ul className="space-y-2 p-4 text-[13.5px]">
            {data.noYears.length > 0 && (
              <li className="flex gap-2">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-warn" />
                <span>
                  Add years to {data.noYears.length} skill{data.noYears.length === 1 ? '' : 's'} ({data.noYears.slice(0, 5).join(', ')}
                  {data.noYears.length > 5 ? '...' : ''}) on the Skills tab - "How many years of X?" uses your total experience until you do.
                </span>
              </li>
            )}
            {data.tips.map((t) => (
              <li key={t.id} className="flex gap-2">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-warn" />
                <span>
                  {t.text}{' '}
                  {t.to && t.to !== '/profile' && (
                    <Link to={t.to} className="text-info hover:underline">
                      Open
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
