import { Injectable } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { JobsService } from '../jobs/jobs.service';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { AnswersService } from './answers.service';
import { AnswerSource } from './enums/answer-source.enum';
import { PendingQuestionGroup, PendingQuestionInput, PendingQuestionRow } from './interfaces/pending-question.interface';
import { questionKey } from './utils/question-key.util';

@Injectable()
export class PendingQuestionsService {
  constructor(
    private readonly storage: StorageService,
    private readonly answers: AnswersService,
    private readonly jobs: JobsService,
    private readonly events: EventsService,
  ) {}

  add(input: PendingQuestionInput): void {
    const key = questionKey(input.question);
    if (!key) return;
    this.storage.run(
      `INSERT INTO pending_questions (key, job_id, question, field_type, options, suggestion, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
       ON CONFLICT(key, job_id) DO UPDATE SET status = 'open', options = excluded.options, suggestion = excluded.suggestion`,
      [key, input.jobId, input.question.slice(0, 500), input.fieldType, JSON.stringify(input.options.slice(0, 50)), input.suggestion, new Date().toISOString()],
    );
    this.events.emit({
      type: AgentEventType.QUESTION_PENDING,
      level: 'warn',
      jobId: input.jobId,
      message: `Needs your answer: "${input.question.slice(0, 120)}"`,
    });
  }

  open(): PendingQuestionGroup[] {
    const rows = this.storage.all<PendingQuestionRow>(
      `SELECT q.key, q.question, q.field_type, q.options, q.suggestion, q.job_id, j.title, j.company, q.created_at
       FROM pending_questions q JOIN jobs j ON j.id = q.job_id
       WHERE q.status = 'open' ORDER BY q.created_at`,
    );
    const groups = new Map<string, PendingQuestionGroup>();
    for (const r of rows) {
      let g = groups.get(r.key);
      if (!g) {
        g = {
          key: r.key,
          question: r.question,
          fieldType: r.field_type,
          options: JSON.parse(r.options) as string[],
          suggestion: r.suggestion,
          jobIds: [],
          jobs: [],
          firstAskedAt: r.created_at,
        };
        groups.set(r.key, g);
      }
      g.jobIds.push(r.job_id);
      g.jobs.push({ id: r.job_id, title: r.title, company: r.company });
    }
    return [...groups.values()].sort((a, b) => b.jobIds.length - a.jobIds.length);
  }

  openCount(): number {
    return Number(this.storage.get<{ n: number }>("SELECT COUNT(DISTINCT key) n FROM pending_questions WHERE status = 'open'")?.n ?? 0);
  }

  answer(key: string, answer: string): { requeued: number } {
    const row = this.storage.get<{ question: string; field_type: string }>(
      "SELECT question, field_type FROM pending_questions WHERE key = ? AND status = 'open' LIMIT 1",
      [key],
    );
    if (!row) return { requeued: 0 };
    this.answers.remember(row.question, answer, AnswerSource.USER, row.field_type);
    return { requeued: this.resolve(key) };
  }

  skip(key: string): { moved: number } {
    const jobIds = this.jobIdsFor(key);
    this.storage.run("UPDATE pending_questions SET status = 'skipped' WHERE key = ? AND status = 'open'", [key]);
    return { moved: this.jobs.setStatusMany(jobIds, JobStatus.MANUAL, 'You skipped a required question', [JobStatus.NEEDS_INPUT]) };
  }

  clearForJob(jobId: number): void {
    this.storage.run("UPDATE pending_questions SET status = 'resolved' WHERE job_id = ? AND status = 'open'", [jobId]);
  }

  private resolve(key: string): number {
    const jobIds = this.jobIdsFor(key);
    this.storage.run("UPDATE pending_questions SET status = 'resolved' WHERE key = ? AND status = 'open'", [key]);
    const ready = jobIds.filter(
      (id) => !this.storage.get("SELECT 1 FROM pending_questions WHERE job_id = ? AND status = 'open' LIMIT 1", [id]),
    );
    return this.jobs.setStatusMany(ready, JobStatus.APPROVED, 'Your answer unblocked it', [JobStatus.NEEDS_INPUT]);
  }

  private jobIdsFor(key: string): number[] {
    return this.storage
      .all<{ job_id: number }>("SELECT job_id FROM pending_questions WHERE key = ? AND status = 'open'", [key])
      .map((r) => r.job_id);
  }
}
