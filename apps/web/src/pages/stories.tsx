// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, NotebookPen, Pencil, Plus, SkipForward, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useInterview, useStories } from '../lib/queries';
import type { InterviewQuestion, Story } from '../lib/types';
import { Badge, Button, Card, CardHeader, Empty, Input, PageTitle, Textarea } from '../components/ui';
import { useToast } from '../components/toast';

export function StoriesPage() {
  const { data: stories = [], isLoading } = useStories();
  const { data: interview = [] } = useInterview();
  const [adding, setAdding] = useState(false);
  const answered = interview.filter((q) => q.answered).length;
  return (
    <>
      <PageTitle
        title="Story Bank"
        sub='True stories from your work. On every job site, Sudarshan builds written answers - "Why are you a fit?", "Describe a challenge" - from these instead of generic resume lines.'
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            Add a story
          </Button>
        }
      />
      <Interview questions={interview} answered={answered} />
      {adding && <StoryEditor onDone={() => setAdding(false)} />}
      <Card>
        <CardHeader
          title={`Your stories (${stories.length})`}
          hint="Only you write these. The AI may shorten or reword one for a form, but never changes its facts or numbers."
        />
        {!isLoading && stories.length === 0 && (
          <Empty icon={<NotebookPen className="size-7" />} title="No stories yet">
            Answer a few interview questions above. Even three good stories make written answers sound like you.
          </Empty>
        )}
        <ul>
          {stories.map((s) => (
            <StoryRow key={s.id} story={s} />
          ))}
        </ul>
      </Card>
    </>
  );
}

/** One question at a time; a soft answer is asked once more for a specific, then saved as it is. */
function Interview({ questions, answered }: { questions: InterviewQuestion[]; answered: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [nudged, setNudged] = useState(false);
  const current = questions.find((q) => !q.answered && !skipped.includes(q.id));

  const save = useMutation({
    mutationFn: async () => {
      if (!nudged) {
        const { specific } = await api.post<{ specific: boolean }>('/stories/check', { text });
        if (!specific) {
          setNudged(true);
          return false;
        }
      }
      await api.post<Story>('/stories', { text, promptId: current?.id });
      return true;
    },
    onSuccess: (saved) => {
      if (!saved) return;
      setText('');
      setNudged(false);
      toast('ok', 'Story saved');
      void qc.invalidateQueries({ queryKey: ['stories'] });
      void qc.invalidateQueries({ queryKey: ['stories-interview'] });
    },
    onError: (e: Error) => toast('error', e.message),
  });

  if (!questions.length) return null;
  return (
    <Card className="mb-4">
      <CardHeader
        title="Interview"
        hint={`${answered} of ${questions.length} answered. A few minutes, once - answer in your own words, with real numbers where you have them.`}
      />
      {current ? (
        <div className="grid gap-3 px-5 py-4">
          <div>
            <p className="text-[16px] font-semibold text-ink">{current.question}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-3">Used for: {current.why}</p>
          </div>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setNudged(false);
            }}
            rows={4}
            placeholder={`For example: ${current.example}`}
            aria-label={current.question}
          />
          {nudged && (
            <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink-2" role="status">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />
              Can you add one specific - a number (by how much, how many, how long), a date, or the name of a tool or company? Specifics are what make an answer
              believable. Or save it as it is.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => save.mutate()} loading={save.isPending} disabled={text.trim().length < 10}>
              {nudged ? 'Save as it is' : 'Save story'}
            </Button>
            <Button
              variant="ghost"
              icon={<SkipForward className="size-4" />}
              onClick={() => {
                setSkipped((s) => [...s, current.id]);
                setText('');
                setNudged(false);
              }}
            >
              Skip this one
            </Button>
          </div>
        </div>
      ) : (
        <p className="px-5 py-4 text-[13.5px] text-ink-2">
          {answered === questions.length
            ? 'Every question is answered. Add more stories any time, or edit the ones below as your work changes.'
            : 'That is all for now. The questions you skipped come back next time you open this page.'}
        </p>
      )}
    </Card>
  );
}

function StoryEditor({ story, onDone }: { story?: Story; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState(story?.title ?? '');
  const [text, setText] = useState(story?.text ?? '');
  const save = useMutation({
    mutationFn: () => (story ? api.patch<Story>(`/stories/${story.id}`, { title, text }) : api.post<Story>('/stories', { title: title || undefined, text })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stories'] });
      void qc.invalidateQueries({ queryKey: ['stories-interview'] });
      onDone();
    },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <Card className="mb-3 grid gap-2 p-4">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional), e.g. Order service rebuild" aria-label="Story title" />
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        autoFocus
        placeholder="What happened, what you did, and what came of it - with a number if you have one."
        aria-label="Story"
      />
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => save.mutate()} loading={save.isPending} disabled={text.trim().length < 10}>
          Save
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function StoryRow({ story }: { story: Story }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const remove = useMutation({
    mutationFn: () => api.del(`/stories/${story.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stories'] });
      void qc.invalidateQueries({ queryKey: ['stories-interview'] });
    },
    onError: (e: Error) => toast('error', e.message),
  });
  if (editing) {
    return (
      <li className="border-t border-line/60 px-4 pt-3 first:border-t-0">
        <StoryEditor story={story} onDone={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li className="flex items-start gap-3 border-t border-line/60 px-5 py-3.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{story.title}</p>
        <p className="mt-0.5 text-[13.5px] whitespace-pre-line text-ink-2">{story.text}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {story.skills.slice(0, 8).map((k) => (
            <Badge key={k} tone="info">
              {k}
            </Badge>
          ))}
          <span className="text-[11.5px] text-ink-3">updated {timeAgo(story.updatedAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)} aria-label={`Edit ${story.title}`}>
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 className="size-3.5" />}
          onClick={() => remove.mutate()}
          loading={remove.isPending}
          aria-label={`Delete ${story.title}`}
        />
      </div>
    </li>
  );
}
