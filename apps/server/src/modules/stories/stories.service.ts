// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, NotFoundException } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { extractSkills } from '../discovery/utils/job-normalizer.util';
import { INTERVIEW_QUESTIONS, STORIES_PER_APPLICATION } from './constants/interview.constants';
import { InterviewQuestion } from './interfaces/interview-question.interface';
import { Story } from './interfaces/story.interface';
import { relevantStories, storyLine, titleOf } from './utils/story.util';

interface StoryRow {
  id: number;
  prompt_id: string | null;
  title: string;
  text: string;
  skills: string;
  created_at: string;
  updated_at: string;
}

/**
 * Your Story Bank: true, specific stories from your work, told once in the interview and used by every
 * job portal's written answers ("Why are you a fit?", "Describe a challenge") instead of generic resume lines.
 */
@Injectable()
export class StoriesService {
  constructor(private readonly storage: StorageService) {}

  list(): Story[] {
    return this.storage.all<StoryRow>('SELECT * FROM stories ORDER BY updated_at DESC').map(toStory);
  }

  /** The interview, with the questions you have not answered yet first. */
  interview(): (InterviewQuestion & { answered: boolean })[] {
    const done = new Set(this.list().map((s) => s.promptId));
    return INTERVIEW_QUESTIONS.map((q) => ({ ...q, answered: done.has(q.id) })).sort((a, b) => Number(a.answered) - Number(b.answered));
  }

  create(text: string, promptId?: string, title?: string): Story {
    const now = new Date().toISOString();
    const clean = text.trim();
    const id = this.storage.run('INSERT INTO stories (prompt_id, title, text, skills, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
      promptId ?? null,
      title?.trim() || titleOf(clean),
      clean,
      JSON.stringify(extractSkills(clean)),
      now,
      now,
    ]).lastInsertRowid;
    return this.get(Number(id));
  }

  update(id: number, changes: { title?: string; text?: string }): Story {
    const s = this.get(id);
    const text = changes.text?.trim() || s.text;
    this.storage.run('UPDATE stories SET title = ?, text = ?, skills = ?, updated_at = ? WHERE id = ?', [
      changes.title?.trim() || (changes.text ? titleOf(text) : s.title),
      text,
      JSON.stringify(extractSkills(text)),
      new Date().toISOString(),
      id,
    ]);
    return this.get(id);
  }

  remove(id: number): void {
    this.get(id);
    this.storage.run('DELETE FROM stories WHERE id = ?', [id]);
  }

  /** The stories that fit this job, as lines for the AI; empty when the bank is empty. */
  forJob(jobText: string): string[] {
    return relevantStories(this.list(), jobText, STORIES_PER_APPLICATION).map(storyLine);
  }

  private get(id: number): Story {
    const row = this.storage.get<StoryRow>('SELECT * FROM stories WHERE id = ?', [id]);
    if (!row) throw new NotFoundException('Story not found');
    return toStory(row);
  }
}

function toStory(r: StoryRow): Story {
  return {
    id: r.id,
    promptId: r.prompt_id,
    title: r.title,
    text: r.text,
    skills: JSON.parse(r.skills || '[]') as string[],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
