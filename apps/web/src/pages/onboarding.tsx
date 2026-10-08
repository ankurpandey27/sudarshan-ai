// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/format';
import { useProfile, useSettings } from '../lib/queries';
import type { ProfileState, Settings, WorkbookImportResult } from '../lib/types';
import { LlmForm } from '../components/llm-form';
import { DropUpload } from '../components/drop-upload';
import { SiteConnections } from '../components/site-connections';
import { Badge, Button, Field, Input } from '../components/ui';
import { useToast } from '../components/toast';
import { SudarshanMark } from '../components/sudarshan-logo';

const STEPS = [
  { title: 'Choose a brain', sub: 'Any AI key, or a free local model' },
  { title: 'Your resume', sub: 'PDF - read on this computer' },
  { title: 'Your answers', sub: 'Optional Excel sheet' },
  { title: 'Where to look', sub: 'Searches and site logins' },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const finish = useMutation({
    mutationFn: () => api.patch<Settings>('/settings', { onboarded: true }),
    onSuccess: (s) => {
      qc.setQueryData(['settings'], s);
      navigate('/');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  return (
    <div className="min-h-full bg-bg">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:grid-cols-[300px_1fr] md:py-16">
        <aside>
          <div className="flex items-center gap-3">
            <SudarshanMark size={44} spinning />
            <div>
              <p className="font-display text-[26px] leading-none">Sudarshan AI</p>
              <p className="mt-1 text-[12px] font-semibold tracking-[0.12em] text-accent uppercase">Goes out. Finishes the task. Returns.</p>
            </div>
          </div>
          <h1 className="mt-6 font-display text-[44px] leading-[1.02] tracking-tight">
            Apply while you <em className="text-accent">live your life.</em>
          </h1>
          <p className="mt-4 text-[14px] text-ink-2">
            Everything runs on your laptop. Your resume, answers and logins never leave it. Four quick steps and Sudarshan AI takes over.
          </p>
          <details className="mt-4 rounded-lg border border-line bg-surface/60 px-3 py-2 text-[13px] text-ink-2">
            <summary className="cursor-pointer font-semibold text-ink">Why "Sudarshan AI"?</summary>
            <p className="mt-2">
              In the Dwapar Yug, Shri Krishna's Sudarshan Chakra was released once and did the rest on its own: it went out, completed its task
              with perfect precision, and returned to his finger.
            </p>
            <p className="mt-2">
              That is this agent. You set it off once - it goes out to LinkedIn, Naukri and career sites, finishes the applications, and comes
              back with results. <i>Sudarshan AI</i> also means "auspicious vision": it sees every job and applies only where you fit.
            </p>
          </details>
          <ol className="mt-8 space-y-1">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button
                  onClick={() => setStep(i)}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left', i === step && 'bg-surface shadow-card')}
                >
                  <span
                    className={cn(
                      'tabular grid size-6 place-items-center rounded-full border text-[12px] font-semibold',
                      i < step ? 'border-good bg-good text-white dark:text-black' : i === step ? 'border-accent text-ink' : 'border-line-strong text-ink-3',
                    )}
                  >
                    {i < step ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span>
                    <span className="block text-[13.5px] font-semibold">{s.title}</span>
                    <span className="block text-[12px] text-ink-3">{s.sub}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-8">
          {step === 0 && <StepModel onNext={() => setStep(1)} />}
          {step === 1 && <StepResume onNext={() => setStep(2)} />}
          {step === 2 && <StepSheet onNext={() => setStep(3)} />}
          {step === 3 && <StepSearch onFinish={() => finish.mutate()} finishing={finish.isPending} />}
        </section>
      </div>
    </div>
  );
}

function StepHead({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-[12px] font-semibold text-ink-3">STEP {n} OF 4</p>
      <h2 className="mt-1 font-display text-[30px] leading-tight">{title}</h2>
      <p className="mt-1.5 max-w-xl text-[13.5px] text-ink-2">{children}</p>
    </div>
  );
}

function StepModel({ onNext }: { onNext: () => void }) {
  const { data } = useSettings();
  const configured = data?.llm.provider && data.llm.provider !== 'none';
  return (
    <>
      <StepHead n={1} title="Choose the agent's brain">
        The AI is only asked what memory cannot answer - usually one short call per new form, and fewer every day. Gemini and Groq have free tiers; Ollama runs fully offline.
      </StepHead>
      <LlmForm />
      <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
        <button onClick={onNext} className="text-[13px] text-ink-3 underline-offset-2 hover:text-ink hover:underline">
          Skip - use without AI for now
        </button>
        <Button variant="primary" onClick={onNext} disabled={!configured} icon={<ArrowRight className="size-4" />}>
          Continue
        </Button>
      </div>
    </>
  );
}

function StepResume({ onNext }: { onNext: () => void }) {
  const { data } = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const upload = useMutation({
    mutationFn: (f: File) => api.upload<ProfileState>('/profile/resume', f),
    onSuccess: (s) => {
      qc.setQueryData(['profile'], s);
      toast('ok', `Read your resume: ${s.profile.skills.length} skills, ${s.profile.totalYearsExperience} years`);
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const profile = data?.profile;
  const set = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch<ProfileState>('/profile', patch),
    onSuccess: (s) => qc.setQueryData(['profile'], s),
  });

  return (
    <>
      <StepHead n={2} title="Drop in your resume">
        It becomes your profile: contact details, skills with years, experience, education. The same PDF is attached to your applications.
      </StepHead>
      <DropUpload
        accept="application/pdf,.pdf"
        busy={upload.isPending}
        onFile={(f) => upload.mutate(f)}
        title={data?.resume ? 'Replace resume' : 'Drop your resume PDF here'}
        hint="or click to choose - text PDFs, up to 10 MB"
        done={
          data?.resume && (
            <Badge tone="good">
              <FileText className="size-3" /> {data.resume.name} - read with {data.parsedWith === 'ai' ? 'AI' : 'basic parser'}
            </Badge>
          )
        }
      />
      {profile && data?.resume && (
        <div className="mt-6">
          <p className="mb-3 text-[13px] font-semibold">Forms ask these on almost every application - fill them once:</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Notice period (days)">
              <Input type="number" min={0} defaultValue={profile.noticePeriodDays ?? ''} onBlur={(e) => set.mutate({ noticePeriodDays: e.target.value === '' ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Current CTC (lakhs/yr)">
              <Input type="number" min={0} step="0.1" defaultValue={profile.currentCtc ? profile.currentCtc / 1e5 : ''} onBlur={(e) => set.mutate({ currentCtc: e.target.value === '' ? null : Math.round(Number(e.target.value) * 1e5) })} />
            </Field>
            <Field label="Expected CTC (lakhs/yr)">
              <Input type="number" min={0} step="0.1" defaultValue={profile.expectedCtc ? profile.expectedCtc / 1e5 : ''} onBlur={(e) => set.mutate({ expectedCtc: e.target.value === '' ? null : Math.round(Number(e.target.value) * 1e5) })} />
            </Field>
            <Field label="City">
              <Input defaultValue={profile.city} onBlur={(e) => set.mutate({ city: e.target.value })} />
            </Field>
            <Field label="Current title">
              <Input defaultValue={profile.currentTitle} onBlur={(e) => set.mutate({ currentTitle: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input defaultValue={profile.phone} onBlur={(e) => set.mutate({ phone: e.target.value })} />
            </Field>
          </div>
        </div>
      )}
      <div className="mt-8 flex justify-end border-t border-line pt-5">
        <Button variant="primary" onClick={onNext} disabled={!data?.resume} icon={<ArrowRight className="size-4" />}>
          Continue
        </Button>
      </div>
    </>
  );
}

function StepSheet({ onNext }: { onNext: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [result, setResult] = useState<WorkbookImportResult | null>(null);
  const upload = useMutation({
    mutationFn: (f: File) => api.upload<WorkbookImportResult>('/workbook/import', f),
    onSuccess: (r) => {
      setResult(r);
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <>
      <StepHead n={3} title="Teach it your answers">
        One spreadsheet, three optional sheets: <b>Answers</b> (screening questions you already know), <b>Job Links</b> (any site - LinkedIn, Naukri, company careers pages) and <b>Preferences</b>.
      </StepHead>
      <a
        href="/api/workbook/template/file"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-[13px] font-medium hover:bg-surface-2"
      >
        <Download className="size-3.5" /> Download the template
      </a>
      <DropUpload
        accept=".xlsx,.xlsm,.csv"
        busy={upload.isPending}
        onFile={(f) => upload.mutate(f)}
        title="Drop your spreadsheet here"
        hint=".xlsx or .csv"
        done={
          result && (
            <div className="flex flex-wrap justify-center gap-1.5">
              <Badge tone="good">
                <FileSpreadsheet className="size-3" /> {result.answers} answers learned
              </Badge>
              <Badge tone="accent">{result.links.added} job links queued</Badge>
              <Badge>{result.preferences.length} preferences</Badge>
            </div>
          )
        }
      />
      {result?.warnings.map((w) => (
        <p key={w} className="mt-2 text-[12.5px] text-warn">
          {w}
        </p>
      ))}
      <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
        <button onClick={onNext} className="text-[13px] text-ink-3 underline-offset-2 hover:text-ink hover:underline">
          Skip for now
        </button>
        <Button variant="primary" onClick={onNext} icon={<ArrowRight className="size-4" />}>
          Continue
        </Button>
      </div>
    </>
  );
}

function StepSearch({ onFinish, finishing }: { onFinish: () => void; finishing: boolean }) {
  const { data: settings } = useSettings();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch<Settings>('/settings', patch),
    onSuccess: (s) => qc.setQueryData(['settings'], s),
  });
  const csv = (v: string) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const kw = settings?.search.keywords.join(', ') ?? '';

  return (
    <>
      <StepHead n={4} title="Where should it look?">
        LinkedIn is searched through its public job listings - your account is only used to submit. Log in once below; the agent reuses that session.
      </StepHead>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Job titles / keywords" hint={!kw && profile?.profile.currentTitle ? `Empty = "${profile.profile.currentTitle}" from your resume` : 'Comma separated'}>
          <Input key={kw} defaultValue={kw} placeholder="Node.js Developer, Backend Engineer" onBlur={(e) => save.mutate({ search: { keywords: csv(e.target.value) } })} />
        </Field>
        <Field label="Locations" hint='Comma separated - add "Remote" for remote jobs'>
          <Input
            key={settings?.search.locations.join(',')}
            defaultValue={settings?.search.locations.join(', ')}
            onBlur={(e) => save.mutate({ search: { locations: csv(e.target.value) } })}
          />
        </Field>
      </div>
      <div className="mt-6">
        <p className="mb-2 text-[13px] font-semibold">Connect your job sites</p>
        <SiteConnections />
      </div>
      <div className="mt-8 flex justify-end border-t border-line pt-5">
        <Button variant="primary" onClick={onFinish} loading={finishing} icon={<Check className="size-4" />}>
          Open Lakshya
        </Button>
      </div>
    </>
  );
}
