// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, Download, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { cn, timeAgo } from '../lib/format';
import { useDebounced } from '../lib/use-debounced';
import { useSaved } from '../lib/use-saved';
import { Pagination } from '../components/pagination';
import { useAnswers } from '../lib/queries';
import type { Answer } from '../lib/types';
import { Badge, Button, Card, Empty, Input, PageTitle, Textarea } from '../components/ui';
import { useToast } from '../components/toast';
import { useEnglish } from '../lib/english';

const sourceTone = { user: 'good', excel: 'info', llm: 'accent' } as const;
const sourceText = { user: 'you', excel: 'excel', llm: 'AI' } as const;

type SourceFilter = 'all' | Answer['source'];
type SortBy = 'used' | 'recent' | 'az';
const SORTS: { id: SortBy; label: string }[] = [
  { id: 'used', label: 'Most used' },
  { id: 'recent', label: 'Recently changed' },
  { id: 'az', label: 'A-Z' },
];

export function AnswersPage() {
  const [text, setText] = useState('');
  const search = useDebounced(text.trim());
  const [adding, setAdding] = useState(false);
  const [source, setSource] = useState<SourceFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('used');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useSaved('sudarshan.answers.pageSize', 20);
  const { data = [], isLoading } = useAnswers(search);
  useEffect(() => setPage(1), [search, source, sortBy, pageSize]);

  const counts = useMemo(() => {
    const counts: Record<string, number> = { all: data.length };
    for (const answer of data) counts[answer.source] = (counts[answer.source] ?? 0) + 1;
    return counts;
  }, [data]);
  const shown = useMemo(() => {
    const list = source === 'all' ? [...data] : data.filter((a) => a.source === source);
    if (sortBy === 'recent') list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    else if (sortBy === 'az') list.sort((a, b) => a.question.localeCompare(b.question));
    return list;
  }, [data, source, sortBy]);
  const pageItems = shown.slice((page - 1) * pageSize, page * pageSize);
  const chip = (id: SourceFilter, label: string) => (
    <button
      key={id}
      onClick={() => setSource(id)}
      aria-pressed={source === id}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors',
        source === id ? 'border-accent bg-accent-soft/60 font-semibold text-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong',
      )}
    >
      {label} <span className="text-ink-3 tabular">{counts[id] ?? 0}</span>
    </button>
  );
  return (
    <>
      <PageTitle
        title="Answer memory"
        sub="Every screening question the agent has learned. Similar questions reuse these answers - no AI call, no guessing."
        actions={
          <>
            <a
              href="/api/answers/export.csv"
              download
              title="Every saved question and answer, as a CSV file for Excel or Google Sheets"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-surface-2"
            >
              <Download className="size-4" /> Export CSV
            </a>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
              Add answer
            </Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Where the answer came from">
          {chip('all', 'All')}
          {chip('user', 'Yours')}
          {chip('excel', 'From Excel')}
          {chip('llm', 'From AI')}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            aria-label="Sort answers"
            className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px]"
          >
            {SORTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="relative flex-1 sm:w-72 sm:flex-none">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-ink-3" />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search questions or answers"
              className="pl-8"
              aria-label="Search answers"
            />
          </div>
        </div>
      </div>
      {adding && <NewAnswer onDone={() => setAdding(false)} />}
      <Card>
        {!isLoading && shown.length === 0 && (
          <Empty icon={<BookOpenCheck className="size-7" />} title={search || source !== 'all' ? 'Nothing matches' : 'Memory is empty'}>
            {search || source !== 'all'
              ? 'Try another search or source.'
              : 'It fills as you answer questions, import an Excel answer sheet, or let the AI answer reusable questions.'}
          </Empty>
        )}
        <ul>
          {pageItems.map((a) => (
            <AnswerRow key={a.id} a={a} />
          ))}
        </ul>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={shown.length}
          noun="answers"
          onPage={(p) => {
            setPage(p);
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onPageSize={setPageSize}
          className="border-t border-line"
        />
      </Card>
    </>
  );
}

function AnswerRow({ a }: { a: Answer }) {
  const [value, setValue] = useState(a.answer);
  const qc = useQueryClient();
  const toast = useToast();
  const save = useMutation({
    mutationFn: () => api.patch(`/answers/${a.id}`, { answer: value }),
    onSuccess: () => {
      toast('ok', 'Answer updated');
      void qc.invalidateQueries({ queryKey: ['answers'] });
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/answers/${a.id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['answers'] }),
  });
  const dirty = value !== a.answer;
  const english = useEnglish(a.question, a.questionEn, a.foreign);
  return (
    <li className="grid gap-2 border-b border-line px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start">
      <div>
        <p className="text-[13.5px] font-medium">{a.question}</p>
        {english && (
          <p className="text-[12.5px] text-ink-2">
            <span className="font-semibold text-ink-3">In English: </span>
            {english}
          </p>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
          <Badge tone={sourceTone[a.source]}>from {sourceText[a.source]}</Badge>
          used {a.uses}x - {timeAgo(a.updatedAt)}
        </p>
      </div>
      {/* One line for short answers ("Yes", "30 days"); a box only for longer ones. Decided by the saved answer, so it never jumps while typing. */}
      {a.answer.length > 60 || a.answer.includes('\n') ? (
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} aria-label={`Answer to: ${a.question}`} />
      ) : (
        <Input value={value} onChange={(e) => setValue(e.target.value)} aria-label={`Answer to: ${a.question}`} />
      )}
      <div className="flex gap-1">
        {dirty && (
          <Button size="sm" variant="primary" onClick={() => save.mutate()} loading={save.isPending}>
            Save
          </Button>
        )}
        <button aria-label="Delete answer" onClick={() => remove.mutate()} className="rounded-lg p-2 text-ink-3 hover:bg-bad-soft hover:text-bad">
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

function NewAnswer({ onDone }: { onDone: () => void }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const qc = useQueryClient();
  const toast = useToast();
  const add = useMutation({
    mutationFn: () => api.post('/answers', { question, answer }),
    onSuccess: () => {
      toast('ok', 'Learned');
      void qc.invalidateQueries({ queryKey: ['answers'] });
      onDone();
    },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <Card className="mb-3 grid gap-2 p-4 md:grid-cols-[1fr_1fr_auto]">
      <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder='Question, e.g. "Do you have a valid passport?"' autoFocus />
      <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer" />
      <div className="flex gap-1">
        <Button variant="primary" onClick={() => add.mutate()} loading={add.isPending} disabled={!question.trim() || !answer.trim()}>
          Add
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
