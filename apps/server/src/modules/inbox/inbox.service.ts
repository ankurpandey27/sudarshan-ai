// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { BadRequestException, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Optional } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { SecretBoxService } from '../../common/crypto/secret-box.service';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { StorageService } from '../../common/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IMAP_PRESETS, INBOX_CHECK_MS, INBOX_FIRST_DAYS, INBOX_KEY, INBOX_MAX_PER_CHECK, INBOX_TEXT_CHARS, REPLY_WINDOW_DAYS } from './constants/inbox.constants';
import { ConnectInboxDto } from './dto/connect-inbox.dto';
import { InboxConfig, InboxStatus, JobReply, MailMessage, ReplyKind } from './interfaces/inbox.interface';
import { classifyReply } from './utils/classify-reply.util';
import { AppliedJob, matchJob } from './utils/match-job.util';

const SAY: Record<ReplyKind, string> = {
  offer: 'an offer',
  interview: 'an interview invitation',
  assessment: 'a test to take',
  rejected: 'a "not this time"',
  received: 'confirmed it received your application',
};

/**
 * Reads what employers replied, from your own mailbox (IMAP, with an app password - Gmail, Yahoo, iCloud, Zoho,
 * Fastmail...). Only recent mail is read, only replies about applications are kept, and of them only the sender,
 * subject and what they mean (received, rejected, test, interview, offer) - matched to the job you applied for.
 * Nothing is sent anywhere; no AI reads your mail.
 */
@Injectable()
export class InboxService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(InboxService.name);
  private timer: NodeJS.Timeout | null = null;
  private checking: Promise<number> | null = null;
  private lastCheck: string | null = null;
  private error: string | null = null;

  constructor(
    private readonly storage: StorageService,
    private readonly secrets: SecretBoxService,
    private readonly events: EventsService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.check().catch(() => undefined), INBOX_CHECK_MS);
    this.timer.unref();
    // The first check a minute after start, out of the way of everything else starting.
    setTimeout(() => void this.check().catch(() => undefined), 60_000).unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  status(): InboxStatus {
    const config = this.config();
    const replies: InboxStatus['replies'] = {};
    for (const row of this.storage.all<{ kind: ReplyKind; n: number }>('SELECT kind, COUNT(*) n FROM job_replies GROUP BY kind')) replies[row.kind] = Number(row.n);
    return { connected: !!config, user: config?.user ?? null, host: config?.host ?? null, lastCheck: this.lastCheck, error: this.error, replies };
  }

  /** Signs in once to check the details, saves them (the password encrypted), and reads the mailbox in the background. */
  async connect(dto: ConnectInboxDto): Promise<InboxStatus> {
    const user = dto.user.trim();
    const preset = IMAP_PRESETS[user.split('@')[1]?.toLowerCase() ?? ''];
    const host = dto.host?.trim() || preset?.host;
    if (!host) throw new BadRequestException('Enter your provider\'s IMAP server (like imap.example.com) - it is in your mail provider\'s help pages.');
    const config: InboxConfig = { user, password: dto.password.replace(/\s+/g, ''), host, port: dto.port ?? preset?.port ?? 993, lastUid: null };
    const client = this.client(config);
    try {
      await client.connect();
      await client.logout();
    } catch (err) {
      throw new BadRequestException(signInError(err as Error, preset?.help));
    }
    this.store(config);
    this.error = null;
    void this.check().catch(() => undefined);
    return this.status();
  }

  disconnect(): InboxStatus {
    this.storage.run('DELETE FROM settings WHERE key = ?', [INBOX_KEY]);
    this.error = null;
    return this.status();
  }

  replies(): JobReply[] {
    return this.storage
      .all<{ job_id: number; kind: ReplyKind; subject: string; sender: string; at: string }>('SELECT job_id, kind, subject, sender, at FROM job_replies ORDER BY at DESC LIMIT 500')
      .map((r) => ({ jobId: r.job_id, kind: r.kind, subject: r.subject, from: r.sender, at: r.at }));
  }

  /** Reads new mail and records the replies; returns how many new ones matched an application. One check at a time. */
  check(): Promise<number> {
    this.checking ??= this.read().finally(() => (this.checking = null));
    return this.checking;
  }

  /** Records replies among these messages; returns how many were new. Used by check(), and by tests. */
  record(messages: MailMessage[]): number {
    const since = new Date(Date.now() - REPLY_WINDOW_DAYS * 86_400_000).toISOString();
    const jobs = this.storage
      .all<{ id: number; title: string; company: string; applied_at: string }>(
        "SELECT id, title, company, applied_at FROM jobs WHERE applied_at IS NOT NULL AND applied_at >= ? AND trim(company) <> ''",
        [since],
      )
      .map<AppliedJob>((j) => ({ id: j.id, title: j.title, company: j.company, appliedAt: j.applied_at }));
    let added = 0;
    for (const message of messages) {
      const kind = classifyReply(message.subject, message.text);
      if (!kind) continue;
      const jobId = matchJob(message, jobs);
      if (!jobId) continue;
      const { changes } = this.storage.run('INSERT OR IGNORE INTO job_replies (message_id, job_id, kind, subject, sender, at) VALUES (?, ?, ?, ?, ?, ?)', [
        message.id,
        jobId,
        kind,
        message.subject.slice(0, 300),
        message.from,
        message.at,
      ]);
      if (!changes) continue;
      added++;
      const job = jobs.find((j) => j.id === jobId)!;
      const label = `${job.title} @ ${job.company}`;
      this.events.emit({ type: AgentEventType.LOG, level: kind === 'rejected' || kind === 'received' ? 'info' : 'success', jobId, message: `${label}: ${SAY[kind]} (email "${message.subject.slice(0, 80)}")` });
      if (kind === 'interview' || kind === 'assessment' || kind === 'offer') {
        void this.notifications?.notify('needs_you', `${job.company}: ${SAY[kind]}`, `${label}\nEmail: "${message.subject}" from ${message.from}`);
      }
    }
    return added;
  }

  private async read(): Promise<number> {
    const config = this.config();
    if (!config) return 0;
    const client = this.client(config);
    const messages: MailMessage[] = [];
    let lastUid = config.lastUid;
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const found = config.lastUid
          ? await client.search({ uid: `${config.lastUid + 1}:*` }, { uid: true })
          : await client.search({ since: new Date(Date.now() - INBOX_FIRST_DAYS * 86_400_000) }, { uid: true });
        const uids = (found || []).filter((u) => !config.lastUid || u > config.lastUid).slice(-INBOX_MAX_PER_CHECK);
        if (uids.length) {
          for await (const msg of client.fetch(uids, { uid: true, envelope: true, source: { maxLength: 300_000 } }, { uid: true })) {
            lastUid = Math.max(lastUid ?? 0, msg.uid);
            const parsed = msg.source ? await simpleParser(msg.source).catch(() => null) : null;
            const sender = parsed?.from?.value[0] ?? msg.envelope?.from?.[0];
            messages.push({
              id: parsed?.messageId ?? `${config.user}:${msg.uid}`,
              from: (sender?.address ?? '').toLowerCase(),
              fromName: sender?.name ?? '',
              subject: parsed?.subject ?? msg.envelope?.subject ?? '',
              text: (parsed?.text ?? '').slice(0, INBOX_TEXT_CHARS),
              at: new Date(parsed?.date ?? msg.envelope?.date ?? Date.now()).toISOString(),
            });
          }
        }
      } finally {
        lock.release();
      }
      await client.logout();
      this.error = null;
    } catch (err) {
      this.error = signInError(err as Error);
      this.logger.warn(`Could not read your mailbox: ${this.error}`);
      await client.logout().catch(() => undefined);
      return 0;
    }
    const added = this.record(messages);
    if (lastUid !== config.lastUid) this.store({ ...config, lastUid });
    this.lastCheck = new Date().toISOString();
    if (added) this.logger.log(`Read ${messages.length} new email(s): ${added} reply(ies) to your applications`);
    return added;
  }

  private client(c: InboxConfig): ImapFlow {
    return new ImapFlow({ host: c.host, port: c.port, secure: c.port === 993, auth: { user: c.user, pass: c.password }, logger: false });
  }

  private config(): InboxConfig | null {
    const row = this.storage.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [INBOX_KEY]);
    if (!row) return null;
    try {
      const config = JSON.parse(row.value) as InboxConfig;
      return { ...config, password: this.secrets.decrypt(config.password) };
    } catch {
      // secret.key changed (a restored backup): the mailbox has to be connected again.
      return null;
    }
  }

  private store(c: InboxConfig): void {
    this.storage.run(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [INBOX_KEY, JSON.stringify({ ...c, password: this.secrets.encrypt(c.password) }), new Date().toISOString()],
    );
  }
}

/** A sign-in failure in words a person can act on. */
function signInError(err: Error & { authenticationFailed?: boolean; responseText?: string; code?: string }, help?: string): string {
  if (err.authenticationFailed || /auth|credentials|login/i.test(err.responseText ?? err.message)) {
    return `The mailbox did not accept this address and password. Use an app password, not your normal one.${help ? ` ${help}` : ''}`;
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout/i.test(`${err.code ?? ''} ${err.message}`)) return 'Could not reach the mail server - check the server name, and your internet.';
  return err.responseText ?? err.message;
}
