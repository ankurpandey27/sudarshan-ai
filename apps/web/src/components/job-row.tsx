// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ExternalLink, MapPin } from 'lucide-react';
import { api } from '../lib/api';
import { cn, timeAgo } from '../lib/format';
import { PlatformBadge } from './platform-badge';
import type { Attempt, Job, JobReply } from '../lib/types';
import { Badge, ScoreDial, StatusBadge } from './ui';

export function JobRow({
  job,
  selected,
  onSelect,
  actions,
  showStatus,
  reply,
}: {
  job: Job;
  /** The latest reply from the employer, read from your mailbox. */
  reply?: JobReply;
  selected?: boolean;
  onSelect?: (v: boolean) => void;
  actions?: ReactNode;
  showStatus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const d = job.scoreDetail;
  return (
    <li className={cn('border-b border-line last:border-b-0', selected && 'bg-accent-soft/35')}>
      <div className="flex flex-wrap items-start gap-3 px-4 py-3 sm:flex-nowrap">
        {onSelect && (
          <input
            type="checkbox"
            aria-label={`Select ${job.title}`}
            checked={!!selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="mt-3 size-4 accent-[var(--accent)]"
          />
        )}
        <ScoreDial score={job.score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button onClick={() => setOpen((o) => !o)} className="text-left text-[14.5px] font-semibold hover:underline underline-offset-2">
              {job.title}
            </button>
            {showStatus && <StatusBadge status={job.status} />}
            {reply && <ReplyBadge reply={reply} />}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-2">
            <span className="font-medium">{job.company || 'Unknown company'}</span>
            {job.location && (
              <span className="inline-flex items-center gap-0.5 text-ink-3">
                <MapPin className="size-3" />
                {job.location}
              </span>
            )}
            <span className="text-ink-3">{job.postedAt ? `posted ${timeAgo(job.postedAt)}` : `found ${timeAgo(job.discoveredAt)}`}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <PlatformBadge platform={job.platform} site={job.site} />
            {job.taste !== null && <TasteChip taste={job.taste} reasons={job.tasteReasons} />}
            {job.workMode === 'hybrid' ? (
              <Badge tone="info">Hybrid</Badge>
            ) : (job.workMode === 'remote' || (!job.workMode && job.isRemote)) && <Badge tone="info">Remote</Badge>}
            {job.region === 'abroad' && <Badge tone="warn">Abroad</Badge>}
            {job.easyApply && job.source !== 'web' && <Badge tone="good">Easy Apply</Badge>}
            {job.origin === 'link' && <Badge tone="accent">Your list</Badge>}
            {job.salaryRaw && <Badge>{job.salaryRaw}</Badge>}
            {d?.matchedSkills.slice(0, 3).map((s) => (
              <Badge key={s} tone="good">
                {s}
              </Badge>
            ))}
            {d && d.matchedSkills.length > 3 && (
              <button onClick={() => setOpen(true)} className="text-[11.5px] text-ink-3 hover:text-ink" title={d.matchedSkills.slice(3).join(', ')}>
                +{d.matchedSkills.length - 3} more
              </button>
            )}
          </div>
          {job.reason && (
            <p className="mt-1.5 line-clamp-1 text-[12.5px] text-ink-3" title={job.reason}>
              {job.reason}
            </p>
          )}
        </div>
        {/* Phones: actions drop to their own line so the title keeps the width. */}
        <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
          {actions}
          <a href={job.url} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink" title="Open posting">
            <ExternalLink className="size-4" />
          </a>
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink"
            aria-label="Details"
            aria-expanded={open}
          >
            <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>
      {open && <JobDetail job={job} />}
    </li>
  );
}

function JobDetail({ job }: { job: Job }) {
  const { data } = useQuery({ queryKey: ['jobs', 'detail', job.id], queryFn: () => api.get<{ job: Job; attempts: Attempt[] }>(`/jobs/${job.id}`) });
  const d = job.scoreDetail;
  return (
    <div className="grid gap-4 border-t border-line bg-surface-2/40 px-4 py-4 md:grid-cols-[1fr_280px]">
      <div>
        <p className="mb-1 text-[12.5px] font-semibold text-ink-3">Description</p>
        <p className="max-h-60 overflow-y-auto text-[13px] whitespace-pre-line text-ink-2">{job.description || 'No description captured.'}</p>
      </div>
      <div className="space-y-3 text-[12.5px]">
        {job.reason && <p className="text-ink-2">{job.reason}</p>}
        {d && d.matchedSkills.length > 0 && (
          <div>
            <p className="mb-1 font-semibold text-ink-3">You have</p>
            <p className="text-good">{d.matchedSkills.join(', ')}</p>
          </div>
        )}
        {d && d.missingSkills.length > 0 && (
          <div>
            <p className="mb-1 font-semibold text-ink-3">Asked for, not in your profile</p>
            <p className="text-ink-2">{d.missingSkills.join(', ')}</p>
          </div>
        )}
        {d && (
          <div>
            <p className="mb-1 font-semibold text-ink-3">Why this score</p>
            <ul className="space-y-0.5 text-ink-2">
              <li>Skills match: {d.technical}</li>
              <li>Salary fit: {d.salary}</li>
              <li>Location fit: {d.location}</li>
              {d.llm !== null && <li>AI opinion: {d.llm}</li>}
            </ul>
          </div>
        )}
        {!!data?.attempts.length && (
          <div>
            <p className="mb-1 font-semibold text-ink-3">Attempts</p>
            {data.attempts.map((a) => (
              <details key={a.id} className="mb-1">
                <summary className="cursor-pointer text-ink-2">
                  {a.outcome ?? 'running'} - {timeAgo(a.startedAt)} - {a.fields} fields, {a.llmCalls} AI
                </summary>
                {a.shots?.length > 0 && <Replay jobId={job.id} attemptId={a.id} shots={a.shots} />}
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-surface p-2 font-mono text-[11px] whitespace-pre-wrap">
                  {a.trace.join('\n') || a.detail}
                </pre>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** "87% your interest" - how likely you are to want it: your match, plus what you applied to and skipped. */
function TasteChip({ taste, reasons }: { taste: number; reasons: string[] }) {
  const pct = Math.round(taste * 100);
  const tone = pct >= 65 ? 'good' : pct <= 30 ? 'warn' : 'neutral';
  // "+ skill: node.js" -> shares "Node.js"; "- skill: java" -> rare in your applications; "- title: manager" -> you turn it down.
  const shares: string[] = [];
  const rare: string[] = [];
  const turnedDown: string[] = [];
  for (const r of reasons) {
    const [kind, value = ''] = r.slice(2).split(': ');
    const name = kind === 'platform' ? `${value.charAt(0).toUpperCase()}${value.slice(1)} jobs` : value.charAt(0).toUpperCase() + value.slice(1);
    if (r.startsWith('+ ')) shares.push(name);
    else if (kind === 'skill') rare.push(name);
    else turnedDown.push(name);
  }
  const why = [
    shares.length && `Shares ${shares.join(', ')} with the jobs you apply to.`,
    rare.length && `Rare in your applications: ${rare.join(', ')}.`,
    turnedDown.length && `You usually turn down: ${turnedDown.join(', ')}.`,
  ].filter(Boolean);
  return (
    <span title={why.length ? why.join(' ') : 'How much this job looks like the ones you apply to.'}>
      <Badge tone={tone}>{pct}% your interest</Badge>
    </span>
  );
}

/** The page at each step of an attempt: small pictures in order; click one to see it full size. */
function Replay({ jobId, attemptId, shots }: { jobId: number; attemptId: number; shots: { label: string; file: string }[] }) {
  return (
    <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1" aria-label="Step-by-step replay">
      {shots.map((s) => {
        const url = `/api/jobs/${jobId}/attempts/${attemptId}/shots/${encodeURIComponent(s.file)}`;
        return (
          <a key={s.file} href={url} target="_blank" rel="noreferrer" title={s.label} className="shrink-0 text-center">
            <img src={url} alt={s.label} loading="lazy" className="h-16 w-28 rounded border border-line object-cover object-top" />
            <span className="block w-28 truncate text-[10.5px] text-ink-3">{s.label}</span>
          </a>
        );
      })}
    </div>
  );
}

const REPLY: Record<JobReply['kind'], { label: string; tone: 'good' | 'info' | 'bad' | 'neutral' }> = {
  offer: { label: 'Offer', tone: 'good' },
  interview: { label: 'Interview', tone: 'good' },
  assessment: { label: 'Test to take', tone: 'info' },
  rejected: { label: 'Not selected', tone: 'bad' },
  received: { label: 'Received', tone: 'neutral' },
};

/** What the employer replied by email (hover for the email's subject). */
function ReplyBadge({ reply }: { reply: JobReply }) {
  const r = REPLY[reply.kind];
  return (
    <span title={`Email ${timeAgo(reply.at)}: "${reply.subject}" from ${reply.from}`}>
      <Badge tone={r.tone}>{r.label}</Badge>
    </span>
  );
}
