// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** What a reply from an employer says, most decisive first. */
export type ReplyKind = 'offer' | 'rejected' | 'interview' | 'assessment' | 'received';

/** A message as read from the mailbox. */
export interface MailMessage {
  /** The Message-ID header (or the server's id): a message is recorded once. */
  id: string;
  from: string;
  fromName: string;
  subject: string;
  text: string;
  at: string;
}

/** A reply matched to one of your applications. */
export interface JobReply {
  jobId: number;
  kind: ReplyKind;
  subject: string;
  from: string;
  at: string;
}

/** Stored in the settings table under INBOX_KEY; the password is encrypted with secret.key. */
export interface InboxConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  /** The highest message id read in INBOX, so each check reads only what is new. */
  lastUid: number | null;
}

export interface InboxStatus {
  connected: boolean;
  user: string | null;
  host: string | null;
  lastCheck: string | null;
  error: string | null;
  /** Replies matched so far, by kind. */
  replies: Partial<Record<ReplyKind, number>>;
}
