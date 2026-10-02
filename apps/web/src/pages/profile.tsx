// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileText, Plus, Search, X } from 'lucide-react';
import { Tabs, useTab, type TabDef } from '../components/tabs';
import { api } from '../lib/api';
import { useProfile } from '../lib/queries';
import type { Profile, ProfileState } from '../lib/types';
import { DropUpload } from '../components/drop-upload';
import { Button, Card, CardHeader, Field, Input, PageTitle, Select, Textarea, Toggle } from '../components/ui';
import { ProfileCheckPanel } from '../components/profile-check';
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

type ProfileTab = 'about' | 'work' | 'skills' | 'pay' | 'check';
const PROFILE_TABS: readonly TabDef<ProfileTab>[] = [
  { id: 'about', label: 'About you' },
  { id: 'work', label: 'Work' },
  { id: 'skills', label: 'Skills' },
  { id: 'pay', label: 'Pay & availability' },
  { id: 'check', label: 'Profile check' },
];

export function ProfilePage() {
  const { data } = useProfile();
  const [draft, setDraft] = useState<Profile | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [skillQuery, setSkillQuery] = useState('');
  const [noYearsOnly, setNoYearsOnly] = useState(false);
  const [tab, setTab] = useTab(PROFILE_TABS);
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

      <Tabs tabs={PROFILE_TABS} value={tab} onChange={setTab} />

      {tab === 'check' && (
        <ProfileCheckPanel
          profile={draft}
          onAdd={(name, years) => {
            if (draft.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
            save.mutate({ ...draft, skills: [...draft.skills, { name, years }] });
          }}
        />
      )}

      {tab === 'about' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader title="Basics" />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="First name">
                <Input {...text('firstName')} />
              </Field>
              <Field label="Last name">
                <Input {...text('lastName')} />
              </Field>
              <Field label="Email">
                <Input type="email" {...text('email')} />
              </Field>
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <Field label="Code">
                  <Input {...text('phoneCountryCode')} />
                </Field>
                <Field label="Phone">
                  <Input {...text('phone')} />
                </Field>
              </div>
              <Field label="City">
                <Input {...text('city')} />
              </Field>
              <Field label="State">
                <Input {...text('state')} />
              </Field>
              <Field label="Country">
                <Input {...text('country')} />
              </Field>
              <Field label="PIN / postal code">
                <Input {...text('postalCode')} />
              </Field>
            </div>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Resume" />
              <div className="p-4">
                {data.resume && (
                  <a
                    href="/api/profile/resume/file"
                    target="_blank"
                    rel="noreferrer"
                    className="mb-3 flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-surface-2"
                  >
                    <FileText className="size-4 text-ink-3" />
                    <span className="truncate">{data.resume.name}</span>
                  </a>
                )}
                <DropUpload
                  accept=".pdf,application/pdf"
                  busy={upload.isPending}
                  onFile={(f) => upload.mutate(f)}
                  title={data.resume ? 'Replace resume' : 'Upload resume'}
                  hint="PDF, attached to applications"
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Links" />
              <div className="space-y-3 p-4">
                <Field label="LinkedIn">
                  <Input {...text('linkedinUrl')} />
                </Field>
                <Field label="GitHub">
                  <Input {...text('githubUrl')} />
                </Field>
                <Field label="Portfolio / website">
                  <Input {...text('portfolioUrl')} />
                </Field>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'work' && (
        <Card className="max-w-3xl">
          <CardHeader title="Work" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Current title">
              <Input {...text('currentTitle')} />
            </Field>
            <Field label="Current company">
              <Input {...text('currentCompany')} />
            </Field>
            <Field label="Headline" className="sm:col-span-2">
              <Input {...text('headline')} />
            </Field>
            <Field label="Total experience (years)">
              <Input
                type="number"
                step="0.5"
                min={0}
                value={draft.totalYearsExperience}
                onChange={(e) => set('totalYearsExperience', Number(e.target.value))}
              />
            </Field>
            <Field label="Work authorization" hint="e.g. Indian citizen">
              <Input {...text('workAuthorization')} />
            </Field>
            <Field label="Summary" className="sm:col-span-2" hint="Used by the AI for 'tell us about yourself' questions">
              <Textarea value={draft.summary} onChange={(e) => set('summary', e.target.value)} rows={5} />
            </Field>
          </div>
        </Card>
      )}

      {tab === 'skills' && (
        <Card>
          <CardHeader
            title={`Skills (${draft.skills.length})`}
            hint="Years per skill answer 'How many years of X?' questions. Blank = your total experience."
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-line/70 px-4 py-3">
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSkill.trim()) return;
                set('skills', [...draft.skills, { name: newSkill.trim(), years: null }]);
                setNewSkill('');
              }}
            >
              <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add a skill" className="h-9 w-40" aria-label="New skill" />
              <Button type="submit" icon={<Plus className="size-4" />}>
                Add
              </Button>
            </form>
            <label className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-3">
              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={noYearsOnly} onChange={(e) => setNoYearsOnly(e.target.checked)} />
              Only skills without years ({draft.skills.filter((sk) => sk.years === null).length})
            </label>
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-ink-3" />
              <Input value={skillQuery} onChange={(e) => setSkillQuery(e.target.value)} placeholder="Find a skill" className="pl-8" aria-label="Find a skill" />
            </div>
          </div>
          <ul className="grid gap-x-6 px-4 py-2 sm:grid-cols-2 lg:grid-cols-3">
            {draft.skills.map((sk, i) =>
              (!skillQuery || sk.name.toLowerCase().includes(skillQuery.toLowerCase())) && (!noYearsOnly || sk.years === null) ? (
                <li key={`${sk.name}-${i}`} className="flex items-center gap-2 border-b border-line/50 py-1.5 text-[13px]">
                  <span className="min-w-0 flex-1 truncate" title={sk.name}>
                    {sk.name}
                  </span>
                  <input
                    aria-label={`Years of ${sk.name}`}
                    type="number"
                    min={0}
                    step="0.5"
                    placeholder="yrs"
                    value={sk.years ?? ''}
                    onChange={(e) => {
                      const skills = [...draft.skills];
                      skills[i] = { ...sk, years: e.target.value === '' ? null : Number(e.target.value) };
                      set('skills', skills);
                    }}
                    className="tabular h-7 w-16 rounded-md border border-line bg-surface px-1.5 text-center text-[12.5px]"
                  />
                  <button
                    aria-label={`Remove ${sk.name}`}
                    onClick={() =>
                      set(
                        'skills',
                        draft.skills.filter((_, j) => j !== i),
                      )
                    }
                    className="rounded p-1 text-ink-3 hover:bg-bad-soft hover:text-bad"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ) : null,
            )}
          </ul>
        </Card>
      )}

      {tab === 'pay' && (
        <Card className="max-w-xl">
          <CardHeader title="Availability & pay" />
          <div className="space-y-3 p-4">
            <Field label="Notice period (days)" hint="0 = can join immediately">
              <Input
                type="number"
                min={0}
                value={draft.noticePeriodDays ?? ''}
                onChange={(e) => set('noticePeriodDays', e.target.value === '' ? null : Number(e.target.value))}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Current CTC (lakhs per year)">
                <Input {...lakhs('currentCtc')} />
              </Field>
              <Field label="Expected CTC (lakhs per year)">
                <Input {...lakhs('expectedCtc')} />
              </Field>
            </div>
            <Field label="Currency">
              <Select value={draft.currency} onChange={(e) => set('currency', e.target.value)}>
                {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Toggle checked={draft.willingToRelocate} onChange={(v) => set('willingToRelocate', v)} label="Willing to relocate" />
            <Toggle checked={draft.needsSponsorship} onChange={(v) => set('needsSponsorship', v)} label="Need visa sponsorship" />
            <Toggle
              checked={draft.cleanRecord}
              onChange={(v) => set('cleanRecord', v)}
              label="My record is clean"
              hint="No criminal record, no pending legal action, never dismissed or blacklisted. Turn on only if true: forms asking about this - even optional ones - are then answered for you (No to 'any legal action against you?', Yes to 'consent to a background check')."
            />
          </div>
        </Card>
      )}
    </>
  );
}
