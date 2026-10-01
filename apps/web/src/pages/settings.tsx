// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAgent, useSettings } from '../lib/queries';
import type { AgentStatus, Settings, WorkbookImportResult } from '../lib/types';
import { LlmForm } from '../components/llm-form';
import { SiteConnections } from '../components/site-connections';
import { DropUpload } from '../components/drop-upload';
import { Button, Card, CardHeader, Field, Input, PageTitle, Select, Toggle } from '../components/ui';
import { useToast } from '../components/toast';
import { InfoTip } from '../components/info-tip';
import { useLocation } from 'react-router';
import { Tabs, useTab, type TabDef } from '../components/tabs';
import { TagInput } from '../components/tag-input';
import { LearnersCard } from '../components/learners-card';

type SettingsTab = 'ai' | 'search' | 'platforms' | 'agent' | 'accounts' | 'data';
const SETTINGS_TABS: readonly TabDef<SettingsTab>[] = [
  { id: 'ai', label: 'AI model' },
  { id: 'search', label: 'What to search' },
  { id: 'platforms', label: 'Platforms & limits' },
  { id: 'agent', label: 'Agent' },
  { id: 'accounts', label: 'Site logins' },
  { id: 'data', label: 'Spreadsheet' },
];

export function SettingsPage() {
  const { data } = useSettings();
  const { data: agentStatus } = useAgent();
  const [tab, setTab] = useTab(SETTINGS_TABS);
  const { hash } = useLocation();
  // Older links (and "Log in" buttons) point at #sites.
  useEffect(() => {
    if (hash === '#sites') setTab('accounts');
  }, [hash]);
  const [draft, setDraft] = useState<Settings | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  useEffect(() => {
    if (data) setDraft(structuredClone(data));
  }, [data]);

  const save = useMutation({
    mutationFn: (s: Settings) =>
      api.patch<Settings>('/settings', {
        search: s.search,
        sources: s.sources,
        agent: s.agent,
      }),
    onSuccess: (s) => {
      qc.setQueryData(['settings'], s);
      toast('ok', 'Settings saved');
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const rescore = useMutation({
    mutationFn: () => api.post<{ rescored: number }>('/agent/rescore'),
    onSuccess: (r) => {
      toast('ok', `Scoring ${r.rescored} jobs again with the new settings`);
      // Show the bar (or the result, if it already finished) right away.
      void qc.invalidateQueries({ queryKey: ['agent'] });
    },
  });
  const importSheet = useMutation({
    mutationFn: (f: File) => api.upload<WorkbookImportResult>('/workbook/import', f),
    onSuccess: (r) => {
      void qc.invalidateQueries();
      toast('ok', `${r.answers} answers, ${r.links.added} links, ${r.preferences.length} preferences imported`);
    },
    onError: (e: Error) => toast('error', e.message),
  });

  if (!draft || !data) return null;
  const search = <K extends keyof Settings['search']>(k: K, v: Settings['search'][K]) => setDraft({ ...draft, search: { ...draft.search, [k]: v } });
  const agent = <K extends keyof Settings['agent']>(k: K, v: Settings['agent'][K]) => setDraft({ ...draft, agent: { ...draft.agent, [k]: v } });
  const source = (k: keyof Settings['sources'], patch: Partial<Settings['sources'][typeof k]>) =>
    setDraft({
      ...draft,
      sources: { ...draft.sources, [k]: { ...draft.sources[k], ...patch } },
    });
  const dirty = JSON.stringify([draft.search, draft.sources, draft.agent]) !== JSON.stringify([data.search, data.sources, data.agent]);
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <>
      <PageTitle
        title="Settings"
        sub={
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-good" /> Everything is stored on this computer. Keys are encrypted.
          </span>
        }
        actions={
          <>
            <Button onClick={() => rescore.mutate()} loading={rescore.isPending}>
              Re-score jobs
            </Button>
            <InfoTip title="Re-score jobs">
              Checks every job waiting in Review, and every skipped job, again against your current profile and settings - so a job skipped before can come back
              if it now fits. Use it after changing your skills, salary, city or score thresholds. Approved and applied jobs are not touched. With an AI model
              set, this uses a few AI calls.
            </InfoTip>
            <Button variant="primary" onClick={() => save.mutate(draft)} loading={save.isPending} disabled={!dirty}>
              {dirty ? 'Save changes' : 'Saved'}
            </Button>
          </>
        }
      />

      <Tabs tabs={SETTINGS_TABS} value={tab} onChange={setTab} />

      <div className="max-w-3xl space-y-4">
        {tab === 'ai' && (
          <Card>
            <CardHeader title="AI model" hint="Used to read your resume, score jobs and answer new questions." />
            <div className="p-4">
              <LlmForm />
              <details className="mt-5 border-t border-line pt-4">
                <summary className="cursor-pointer text-[13px] font-semibold">Fallback model (optional)</summary>
                <p className="mt-1 mb-3 text-[12.5px] text-ink-3">Used automatically if the main model fails - a local Ollama model makes a good safety net.</p>
                <LlmForm slot="fallbackLlm" />
              </details>
            </div>
          </Card>
        )}

        {tab === 'search' && (
          <Card>
            <CardHeader title="What to search" />
            <div className="space-y-3 p-4">
              <Field label="Job titles / keywords" hint="Press Enter or a comma after each one">
                <TagInput
                  label="Job titles / keywords"
                  value={draft.search.keywords}
                  onChange={(v) => search('keywords', v)}
                  placeholder="e.g. Node.js Developer, Backend Engineer"
                />
              </Field>
              <Field label="Locations" hint='Add "Remote" for remote roles'>
                <TagInput
                  label="Locations"
                  value={draft.search.locations}
                  onChange={(v) => search('locations', v)}
                  placeholder="e.g. Noida, Bengaluru, Remote"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Posted within (days)">
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={draft.search.postedWithinDays}
                    onChange={(e) => search('postedWithinDays', num(e.target.value))}
                  />
                </Field>
                <Field label="Results per search">
                  <Input type="number" min={5} max={100} value={draft.search.maxPerSearch} onChange={(e) => search('maxPerSearch', num(e.target.value))} />
                </Field>
              </div>
              <Field
                label="Your experience level (years)"
                hint="Internships, trainee, fresher and junior roles, and jobs asking at most fewer years than this (like 0-2 years), are skipped. Blank = automatic: your experience minus a year, at most 3. 0 = skip none."
              >
                <Input
                  type="number"
                  min={0}
                  max={30}
                  placeholder="Automatic"
                  value={draft.search.minExperience ?? ''}
                  onChange={(e) => search('minExperience', e.target.value === '' ? null : num(e.target.value))}
                />
              </Field>
              <Field label="Never apply to these companies">
                <TagInput
                  label="Never apply to these companies"
                  value={draft.search.excludeCompanies}
                  onChange={(v) => search('excludeCompanies', v)}
                  placeholder="Company name"
                />
              </Field>
              <Field label="Skip titles containing" hint="e.g. Intern, Principal, Manager">
                <TagInput
                  label="Skip titles containing"
                  value={draft.search.excludeTitleWords}
                  onChange={(v) => search('excludeTitleWords', v)}
                  placeholder="e.g. Intern"
                />
              </Field>
              <Field
                label="Core skills"
                hint={`A job asking for one of these - in its title, skills or description - is never skipped for a low score; it waits in Review. Blank = your search keywords${draft.search.keywords.length ? ` (${draft.search.keywords.join(', ')})` : ''} and the skills in your title.`}
              >
                <TagInput label="Core skills" value={draft.search.coreSkills} onChange={(v) => search('coreSkills', v)} placeholder="e.g. Node.js, NestJS" />
              </Field>
              <Toggle
                checked={draft.search.easyApplyOnly}
                onChange={(v) => search('easyApplyOnly', v)}
                label="Easy Apply only"
                hint="Jobs that apply inside LinkedIn - fastest and most reliable"
              />
              <Toggle checked={draft.search.remoteOnly} onChange={(v) => search('remoteOnly', v)} label="Remote only" />
            </div>
          </Card>
        )}

        {tab === 'platforms' && (
          <Card>
            <CardHeader title="Job sites & daily limits" hint="Low limits protect your accounts. LinkedIn restricts accounts that apply too fast." />
            <div className="divide-y divide-line px-4">
              {(
                [
                  ['linkedin', 'LinkedIn', 'Easy Apply inside LinkedIn'],
                  ['naukri', 'Naukri', 'Apply + Naukri chat questions'],
                  ['indeed', 'Indeed', 'Search and "Easily apply" on Indeed - keep this low, Indeed restricts automation'],
                  ['instahyre', 'Instahyre', 'Search and one-click apply on Instahyre'],
                  ['links', 'Other career sites', 'Any other job link from Excel or pasted'],
                  ['externalSites', 'Company career sites', 'Follow "Apply on company site" into Greenhouse, Lever, Workday...'],
                ] as const
              ).map(([k, label, hint]) => (
                <div key={k} className="flex items-center gap-3 py-2">
                  <div className="flex-1">
                    <Toggle checked={draft.sources[k].enabled} onChange={(v) => source(k, { enabled: v })} label={label} hint={hint} />
                  </div>
                  <Field label="Per day" className="w-20">
                    <Input
                      type="number"
                      min={0}
                      max={200}
                      value={draft.sources[k].dailyLimit}
                      onChange={(e) => source(k, { dailyLimit: num(e.target.value) })}
                    />
                  </Field>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'agent' && (
          <Card>
            <CardHeader title="Agent behaviour" />
            <div className="space-y-3 p-4">
              <Field label="Mode">
                <Select value={draft.agent.mode} onChange={(e) => agent('mode', e.target.value as Settings['agent']['mode'])}>
                  <option value="review">Review - I approve batches before it applies</option>
                  <option value="auto">Auto - apply to strong matches on its own</option>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Auto-apply score" hint="Queue at or above">
                  <Input type="number" min={0} max={100} value={draft.agent.minApplyScore} onChange={(e) => agent('minApplyScore', num(e.target.value))} />
                </Field>
                <Field label="Review score" hint="Show at or above">
                  <Input type="number" min={0} max={100} value={draft.agent.minReviewScore} onChange={(e) => agent('minReviewScore', num(e.target.value))} />
                </Field>
                <Field label="Gap between applications (s)" hint="Random between min and max">
                  <div className="flex gap-1">
                    <Input type="number" min={5} value={draft.agent.minDelaySeconds} onChange={(e) => agent('minDelaySeconds', num(e.target.value))} />
                    <Input type="number" min={5} value={draft.agent.maxDelaySeconds} onChange={(e) => agent('maxDelaySeconds', num(e.target.value))} />
                  </div>
                </Field>
                <Field label="Search every (minutes)">
                  <Input type="number" min={10} value={draft.agent.intervalMinutes} onChange={(e) => agent('intervalMinutes', num(e.target.value))} />
                </Field>
                <Field label="Active from (hour)">
                  <Input type="number" min={0} max={23} value={draft.agent.activeHoursStart} onChange={(e) => agent('activeHoursStart', num(e.target.value))} />
                </Field>
                <Field label="Active until (hour)">
                  <Input type="number" min={1} max={24} value={draft.agent.activeHoursEnd} onChange={(e) => agent('activeHoursEnd', num(e.target.value))} />
                </Field>
              </div>
              <Toggle
                checked={draft.agent.pauseBeforeSubmit}
                onChange={(v) => agent('pauseBeforeSubmit', v)}
                label="Stop before the final Submit"
                hint="Dry run: fills everything, you press Submit in the agent browser"
              />
              <Toggle
                checked={draft.agent.pastAnswers}
                onChange={(v) => agent('pastAnswers', v)}
                label="Use my past answers for similar questions"
                hint={pastAnswersHint(agentStatus?.meaningModel)}
              />
              <Toggle
                checked={draft.agent.carefulAfterPause}
                onChange={(v) => agent('carefulAfterPause', v)}
                label="Careful mode after a pause"
                hint="When a platform was paused (its pages seemed to change) and is tried again: stop before every Submit on that job board's own forms until one application goes through. Off: it resumes normally. Company sites are never affected."
              />
              <Toggle
                checked={draft.agent.rescue}
                onChange={(v) => agent('rescue', v)}
                label="Rescue stuck applications with AI"
                hint={rescueHint(agentStatus?.rescue)}
              />
              <Toggle
                checked={draft.agent.llmScoring}
                onChange={(v) => agent('llmScoring', v)}
                label="AI job scoring"
                hint="Off = free rule-based scoring only"
              />
              <Toggle
                checked={draft.agent.headless}
                onChange={(v) => agent('headless', v)}
                label="Hide the browser window"
                hint="Visible is recommended: you can watch and solve captchas"
              />
              <Field label="Daily AI token budget" hint="Paid models stop at this; local models are unlimited">
                <Input
                  type="number"
                  min={0}
                  step={10000}
                  value={draft.agent.tokenBudgetPerDay}
                  onChange={(e) => agent('tokenBudgetPerDay', num(e.target.value))}
                />
              </Field>
              <Field label="Browser path (optional)" hint="Leave blank to use Chrome / Edge automatically">
                <Input value={draft.agent.browserPath} onChange={(e) => agent('browserPath', e.target.value)} />
              </Field>
            </div>
          </Card>
        )}
        {tab === 'agent' && <LearnersCard />}

        {tab === 'accounts' && (
          <Card>
            <div id="sites" />
            <CardHeader title="Site logins" />
            <div className="p-4">
              <SiteConnections />
            </div>
          </Card>
        )}
        {tab === 'data' && (
          <Card>
            <CardHeader title="Spreadsheet" hint="Answers, job links and preferences in one file" />
            <div className="space-y-3 p-4">
              <DropUpload
                accept=".xlsx,.xlsm,.csv"
                busy={importSheet.isPending}
                onFile={(f) => importSheet.mutate(f)}
                title="Import spreadsheet"
                hint=".xlsx or .csv"
              />
              <div className="flex flex-wrap gap-2">
                <a
                  href="/api/workbook/template/file"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-[13px] hover:bg-surface-2"
                >
                  <Download className="size-3.5" /> Template
                </a>
                <a
                  href="/api/workbook/export/file"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-[13px] hover:bg-surface-2"
                >
                  <Download className="size-3.5" /> Export applications
                </a>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

/** What the local meaning model is doing, in one line under its switch. */
function pastAnswersHint(m: AgentStatus['meaningModel'] | undefined): string {
  const what = 'A small model on this computer finds your answers to questions that mean the same, in any language; the AI decides if they fit';
  if (!m || m.state === 'off') return what;
  if (m.state === 'loading') return `${what}. Starting - the first time it downloads about 120 MB, once.`;
  if (m.state === 'unavailable') return `Not available on this computer (${m.reason ?? 'could not start'}) - everything else works as before.`;
  return `${what}. Ready.`;
}

/** How the rescue agent does with the AI model in use, in one line under its switch. */
function rescueHint(r: AgentStatus['rescue'] | undefined): string {
  const what =
    'When the usual way gets stuck on a site, the AI takes several steps to move the application on (never solving captchas, never typing your details). What gets an application through is learned for that site.';
  if (!r?.model || r.tries === 0) return what;
  if (r.paused) return `Paused: failed ${r.failedInARow} times in a row with ${r.model} - those jobs come to you. See Needs attention.`;
  return `${what} So far with ${r.model}: helped ${r.helped} of ${r.tries}.`;
}
