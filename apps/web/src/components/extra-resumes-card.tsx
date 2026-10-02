// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Resume } from '../lib/types';
import { Button, Card, CardHeader, Field, Input } from './ui';
import { DropUpload } from './drop-upload';
import { TagInput } from './tag-input';
import { useToast } from './toast';

/** Extra resumes, one per kind of role; each application attaches the one whose words match the job. */
export function ExtraResumesCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data = [] } = useQuery({ queryKey: ['resumes'], queryFn: () => api.get<Resume[]>('/resumes') });
  const [label, setLabel] = useState('');
  const [forJobs, setForJobs] = useState<string[]>([]);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['resumes'] });
  const fail = (e: Error) => toast('error', e.message);

  const add = useMutation({
    mutationFn: (f: File) => api.upload<Resume>('/resumes', f, { label, forJobs: forJobs.join(',') }),
    onSuccess: (r) => {
      refresh();
      setLabel('');
      setForJobs([]);
      toast('ok', `"${r.label}" resume added - used for jobs about ${r.forJobs.join(', ')}`);
    },
    onError: fail,
  });
  const update = useMutation({ mutationFn: (r: { id: number; forJobs: string[] }) => api.patch<Resume>(`/resumes/${r.id}`, { forJobs: r.forJobs }), onSuccess: refresh, onError: fail });
  const remove = useMutation({ mutationFn: (id: number) => api.del(`/resumes/${id}`), onSuccess: refresh, onError: fail });

  return (
    <Card>
      <CardHeader title="Resumes for other roles" hint="Optional. Each job gets the one made for it; your main resume otherwise" />
      <div className="space-y-3 p-4">
        {data.map((r) => (
          <div key={r.id} className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-2">
              <a href={`/api/resumes/${r.id}/file`} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2 text-[13px] hover:underline">
                <FileText className="size-4 shrink-0 text-ink-3" />
                <b>{r.label}</b>
                <span className="truncate text-ink-3">{r.name}</span>
              </a>
              <Button size="sm" variant="ghost" aria-label={`Delete the ${r.label} resume`} onClick={() => remove.mutate(r.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <Field label="Used for jobs about" className="mt-2">
              <TagInput label="Used for jobs about" value={r.forJobs} onChange={(v) => update.mutate({ id: r.id, forJobs: v })} placeholder="e.g. frontend, react" />
            </Field>
          </div>
        ))}
        <div className="space-y-2 border-t border-line pt-3">
          <Field label="Name">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Frontend" />
          </Field>
          <Field label="Used for jobs about" hint="Words from those jobs' titles - blank uses the name">
            <TagInput label="Used for jobs about" value={forJobs} onChange={setForJobs} placeholder="e.g. frontend, react, ui" />
          </Field>
          {label.trim() ? (
            <DropUpload accept=".pdf,application/pdf" busy={add.isPending} onFile={(f) => add.mutate(f)} title={`Upload the "${label.trim()}" resume`} hint="PDF" />
          ) : (
            <p className="text-[12.5px] text-ink-3">Give it a name first, then upload the PDF.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
