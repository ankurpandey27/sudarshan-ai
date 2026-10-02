// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export type NotificationKind = 'summary' | 'needs_you' | 'test';

export interface DaySummary {
  day: string;
  found: number;
  applied: { platform: string; count: number }[];
  /** Applications waiting for you (captcha, by hand) and questions only you can answer. */
  needsYou: number;
  questions: number;
  failed: number;
  /** Employers' replies read from your mailbox today, by kind (when your mailbox is connected). */
  replies: Record<string, number>;
}

export interface TelegramStatus {
  /** A bot token is saved. */
  connected: boolean;
  /** The bot's name, e.g. "@my_sudarshan_bot". */
  bot: string | null;
  /** The chat messages go to; null until you message the bot and press Connect. */
  chatId: string | null;
  /** The last send failed with this, if it did. */
  error: string | null;
}

/** Stored in the settings table under TELEGRAM_KEY; the token is encrypted with secret.key. */
export interface TelegramConfig {
  token: string;
  bot: string | null;
  chatId: string | null;
}
