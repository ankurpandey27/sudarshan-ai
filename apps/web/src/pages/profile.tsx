// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileText, Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import { useProfile } from '../lib/queries';
import type { Profile, ProfileState } from '../lib/types';
import { DropUpload } from '../components/drop-upload';
import { Button, Card, CardHeader, Field, Input, PageTitle, Select, Textarea, Toggle } from '../components/ui';
import { useToast } from '../components/toast';

const FIELD_LABELS: Partial<Record<keyof Profile, string>> = {
  firstName: 'first name',
  lastName: 'last name',
  email: 'email',
  phone: 'phone',
  city: 'city',
  currentTitle: 'current title',
  totalYearsExperience: 'years of experience',
  noticePeriodDays: 'notice period',
  currentCtc: 'current CTC',
  expectedCtc: 'expected CTC',
};

export function ProfilePage() {
  const { data } = useProfile();
  const [draft, setDraft] = useState<Profile | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (data) setDraft(structuredClone(data.profile));
  }, [data]);

  const save = useMutation({
    mutationFn: (p: Profile) => api.patch<ProfileState>('/profile', p),
    onSuccess: (s) => {
      qc.setQueryData(['profile'], s);
      toast('ok', 'Profile saved');
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const upload = useMutation({
    mutationFn: (f: File) => api.upload<ProfileState>('/profile/resume', f),
    onSuccess: (s) => {
      qc.setQueryData(['profile'], s);
      toast('ok', 'Resume re-read - your salary and preference fields were kept');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  if (!draft || !data) return null;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft({ ...draft, [k]: v });
  const text = (k: keyof Profile) => ({ value: String(draft[k] ?? ''), onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never) });
  const lakhs = (k: 'currentCtc' | 'expectedCtc') => ({
    type: 'number',
    step: '0.1',
    min: 0,
    value: draft[k] ? String(+(draft[k]! / 1e5).toFixed(2)) : '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value === '' ? null : Math.round(Number(e.target.value) * 1e5)),
  });
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.profile);

  return (
    <>
      <PageTitle
        title="Profile"
        sub="What the agent knows about you. Forms are filled from here first."
        actions={
          <Button variant="primary" onClick={() => save.mutate(draft)} loading={save.isPending} disabled={!dirty}>
            {dirty ? 'Save changes' : 'Saved'}
          </Button>
        }
      />
      {data.missing.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-[13px] text-warn">
          <AlertTriangle className="size-4 shrink-0" />
          Most forms ask for your {data.missing.map((m) => FIELD_LABELS[m] ?? m).join(', ')}. Fill them to avoid questions later.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Basics" />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="First name"><Input {...text('firstName')} /></Field>
              <Field label="Last name"><Input {...text('lastName')} /></Field>
              <Field label="Email"><Input type="email" {...text('email')} /></Field>
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <Field label="Code"><Input {...text('phoneCountryCode')} /></Field>
                <Field label="Phone"><Input {...text('phone')} /></Field>
              </div>
              <Field label="City"><Input {...text('city')} /></Field>
              <Field label="State"><Input {...text('state')} /></Field>
              <Field label="Country"><Input {...text('country')} /></Field>
              <Field label="PIN / postal code"><Input {...text('postalCode')} /></Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Work" />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="Current title"><Input {...text('currentTitle')} /></Field>
              <Field label="Current company"><Input {...text('currentCompany')} /></Field>
              <Field label="Headline" className="sm:col-span-2"><Input {...text('headline')} /></Field>
              <Field label="Total experience (years)">
                <Input type="number" step="0.5" min={0} value={draft.totalYearsExperience} onChange={(e) => set('totalYearsExperience', Number(e.target.value))} />
              </Field>
              <Field label="Work authorization" hint="e.g. Indian citizen">
                <Input {...text('workAuthorization')} />
              </Field>
              <Field label="Summary" className="sm:col-span-2" hint="Used by the AI for 'tell us about yourself' questions">
                <Textarea value={draft.summary} onChange={(e) => set('summary', e.target.value)} rows={4} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Skills" hint="Years per skill answer 'How many years of X?' questions. Blank = your total experience." />
            <div className="flex flex-wrap gap-2 p-4">
              {draft.skills.map((s, i) => (
                <span key={`${s.name}-${i}`} className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 py-1 pr-1 pl-2.5 text-[13px]">
                  {s.name}
                  <input
                    aria-label={`Years of ${s.name}`}
                    type="number"
                    min={0}
                    step="0.5"
                    placeholder="yrs"
                    value={s.years ?? ''}
                    onChange={(e) => {
                      const skills = [...draft.skills];
                      skills[i] = { ...s, years: e.target.value === '' ? null : Number(e.target.value) };
                      set('skills', skills);
                    }}
                    className="tabular w-12 rounded border border-line bg-surface px-1 text-center text-[12px]"
                  />
                  <button aria-label={`Remove ${s.name}`} onClick={() => set('skills', draft.skills.filter((_, j) => j !== i))} className="rounded p-0.5 text-ink-3 hover:text-bad">
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              <form
                className="inline-flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSkill.trim()) return;
                  set('skills', [...draft.skills, { name: newSkill.trim(), years: null }]);
                  setNewSkill('');
                }}
              >
                <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add skill" className="h-8 w-32" />
                <Button size="sm" type="submit" icon={<Plus className="size-3.5" />} aria-label="Add skill" />
              </form>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Resume" />
            <div className="p-4">
              {data.resume && (
                <a href="/api/profile/resume/file" target="_blank" rel="noreferrer" className="mb-3 flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-surface-2">
                  <FileText className="size-4 text-ink-3" />
                  <span className="truncate">{data.resume.name}</span>
                </a>
              )}
              <DropUpload accept=".pdf,application/pdf" busy={upload.isPending} onFile={(f) => upload.mutate(f)} title={data.resume ? 'Replace resume' : 'Upload resume'} hint="PDF, attached to applications" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Availability & pay" />
            <div className="space-y-3 p-4">
              <Field label="Notice period (days)" hint="0 = can join immediately">
                <Input type="number" min={0} value={draft.noticePeriodDays ?? ''} onChange={(e) => set('noticePeriodDays', e.target.value === '' ? null : Number(e.target.value))} />
              </Field>
              <Field label="Current CTC (lakhs per year)"><Input {...lakhs('currentCtc')} /></Field>
              <Field label="Expected CTC (lakhs per year)"><Input {...lakhs('expectedCtc')} /></Field>
              <Field label="Currency">
                <Select value={draft.currency} onChange={(e) => set('currency', e.target.value)}>
                  {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Toggle checked={draft.willingToRelocate} onChange={(v) => set('willingToRelocate', v)} label="Willing to relocate" />
              <Toggle checked={draft.needsSponsorship} onChange={(v) => set('needsSponsorship', v)} label="Need visa sponsorship" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Links" />
            <div className="space-y-3 p-4">
              <Field label="LinkedIn"><Input {...text('linkedinUrl')} /></Field>
              <Field label="GitHub"><Input {...text('githubUrl')} /></Field>
              <Field label="Portfolio / website"><Input {...text('portfolioUrl')} /></Field>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
