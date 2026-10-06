// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import axios from 'axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SecretBoxService } from '../../common/crypto/secret-box.service';
import { StorageService } from '../../common/storage/storage.service';
import { TELEGRAM_API, TELEGRAM_KEY, TELEGRAM_MAX_CHARS, TELEGRAM_TIMEOUT_MS } from './constants/notifications.constants';
import { TelegramConfig, TelegramStatus } from './interfaces/notification.interface';

/**
 * Messages to your phone through your own Telegram bot: you make one with @BotFather (free, a minute), paste its
 * token, send it any message, and press Connect. Only you and your bot are in the chat; nothing goes elsewhere.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private error: string | null = null;

  constructor(
    private readonly storage: StorageService,
    private readonly secrets: SecretBoxService,
  ) {}

  status(): TelegramStatus {
    const config = this.config();
    return { connected: !!config, bot: config?.bot ?? null, chatId: config?.chatId ?? null, error: this.error };
  }

  /** Checks the token with Telegram and saves it (encrypted); the chat is found by connect(). */
  async saveToken(token: string): Promise<TelegramStatus> {
    const trimmed = token.trim();
    if (!/^\d+:[\w-]{20,}$/.test(trimmed)) throw new BadRequestException('That does not look like a bot token - it is like 123456789:AAH... from @BotFather.');
    const me = await this.call<{ username: string }>(trimmed, 'getMe').catch(() => null);
    if (!me) throw new BadRequestException('Telegram did not accept this token. Copy it again from @BotFather.');
    this.store({ token: trimmed, bot: `@${me.username}`, chatId: null });
    this.error = null;
    return this.status();
  }

  /** Finds the chat from the last message you sent the bot. */
  async connect(): Promise<TelegramStatus> {
    const config = this.config();
    if (!config) throw new BadRequestException('Save your bot token first.');
    const updates = await this.call<{ message?: { chat: { id: number } } }[]>(config.token, 'getUpdates');
    const chat = [...updates].reverse().find((u) => u.message?.chat)?.message?.chat.id;
    if (!chat) throw new BadRequestException(`Send any message (like "hi") to ${config.bot ?? 'your bot'} in Telegram, then press Connect again.`);
    this.store({ ...config, chatId: String(chat) });
    return this.status();
  }

  disconnect(): TelegramStatus {
    this.storage.run('DELETE FROM settings WHERE key = ?', [TELEGRAM_KEY]);
    this.error = null;
    return this.status();
  }

  /** Sends a message if Telegram is connected; never throws (a failed send is shown in Settings). */
  async send(title: string, body: string): Promise<boolean> {
    const config = this.config();
    if (!config?.chatId) return false;
    try {
      await this.call(config.token, 'sendMessage', { chat_id: config.chatId, text: `${title}\n\n${body}`.slice(0, TELEGRAM_MAX_CHARS) });
      this.error = null;
      return true;
    } catch (err) {
      this.error = (err as Error).message;
      this.logger.warn(`Telegram message not sent: ${this.error}`);
      return false;
    }
  }

  private async call<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
    try {
      const res = await axios.post<{ ok: boolean; result: T; description?: string }>(`${TELEGRAM_API}/bot${token}/${method}`, body ?? {}, {
        timeout: TELEGRAM_TIMEOUT_MS,
      });
      return res.data.result;
    } catch (err) {
      // Never let the token reach a log through the request address.
      const description = (err as { response?: { data?: { description?: string } } }).response?.data?.description;
      throw new Error(description ?? (err as Error).message.replace(token, '<token>'));
    }
  }

  private config(): TelegramConfig | null {
    const row = this.storage.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [TELEGRAM_KEY]);
    if (!row) return null;
    try {
      const config = JSON.parse(row.value) as TelegramConfig;
      return { ...config, token: this.secrets.decrypt(config.token) };
    } catch {
      // secret.key changed (a restored backup): the bot has to be connected again.
      return null;
    }
  }

  private store(c: TelegramConfig): void {
    this.storage.run(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [TELEGRAM_KEY, JSON.stringify({ ...c, token: this.secrets.encrypt(c.token) }), new Date().toISOString()],
    );
  }
}
