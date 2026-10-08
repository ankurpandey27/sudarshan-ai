// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { SecretBoxService } from '../../common/crypto/secret-box.service';
import { DEFAULT_SETTINGS, SETTINGS_SECTIONS } from './constants/default-settings.constants';
import { AppSettings, LlmSettings, PublicAppSettings, PublicLlmSettings } from './interfaces/app-settings.interface';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { deepMerge, isPlainObject } from '../../common/utils/object.util';
import { settingsConflict } from './utils/settings-conflict.util';

type Section = (typeof SETTINGS_SECTIONS)[number];

// One JSON row per section, merged over defaults so new settings get sane values after an upgrade.
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private keyUnreadableWarned = false;
  private cache: AppSettings | null = null;
  private readonly listeners: ((s: AppSettings) => void)[] = [];

  constructor(
    private readonly storage: StorageService,
    private readonly secrets: SecretBoxService,
  ) {}

  get(): AppSettings {
    if (this.cache) return this.cache;
    const rows = this.storage.all<{ key: string; value: string }>('SELECT key, value FROM settings');
    const stored = new Map(rows.map((r) => [r.key, JSON.parse(r.value) as unknown]));
    const merged = structuredClone(DEFAULT_SETTINGS) as unknown as Record<Section, unknown>;
    for (const key of SETTINGS_SECTIONS) {
      if (!stored.has(key)) continue;
      const value = stored.get(key);
      const base = merged[key];
      merged[key] = isPlainObject(base) && isPlainObject(value) ? deepMerge(base, value) : value;
    }
    const settings = merged as unknown as AppSettings;
    settings.llm = this.decryptLlm(settings.llm);
    settings.fallbackLlm = this.decryptLlm(settings.fallbackLlm);
    this.cache = settings;
    return settings;
  }

  getPublic(): PublicAppSettings {
    const settings = this.get();
    return { ...settings, llm: this.maskLlm(settings.llm), fallbackLlm: this.maskLlm(settings.fallbackLlm) };
  }

  update(patch: UpdateSettingsDto): PublicAppSettings {
    const current = this.get();
    // Check the combined result, not just the change: each value can be valid while the pair is not.
    if (patch.agent) {
      const conflict = settingsConflict({
        ...current,
        agent: deepMerge(
          current.agent as unknown as Record<string, unknown>,
          patch.agent as unknown as Record<string, unknown>,
        ) as unknown as AppSettings['agent'],
      });
      if (conflict) throw new BadRequestException(conflict);
    }
    const now = new Date().toISOString();
    this.storage.transaction(() => {
      for (const key of SETTINGS_SECTIONS) {
        const incoming = (patch as Record<string, unknown>)[key];
        if (incoming === undefined) continue;
        let next: unknown = incoming;
        if (key === 'llm' || key === 'fallbackLlm') {
          next = this.encryptLlm(this.applyLlmPatch(current[key], incoming as Partial<LlmSettings>));
        } else if (isPlainObject(current[key]) && isPlainObject(incoming)) {
          next = deepMerge(current[key] as Record<string, unknown>, incoming);
        }
        this.storage.run(
          'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
          [key, JSON.stringify(next), now],
        );
      }
    });
    this.cache = null;
    const fresh = this.get();
    this.listeners.forEach((fn) => fn(fresh));
    return this.getPublic();
  }

  onChange(fn: (s: AppSettings) => void): void {
    this.listeners.push(fn);
  }

  // apiKey: undefined keeps the stored key, '' clears it.
  private applyLlmPatch(current: LlmSettings, patch: Partial<LlmSettings>): LlmSettings {
    const providerChanged = patch.provider !== undefined && patch.provider !== current.provider;
    return {
      provider: patch.provider ?? current.provider,
      model: patch.model ?? (providerChanged ? '' : current.model),
      baseUrl: patch.baseUrl ?? (providerChanged ? '' : current.baseUrl),
      apiKey: patch.apiKey !== undefined ? patch.apiKey.trim() : providerChanged ? '' : current.apiKey,
    };
  }

  private encryptLlm(llm: LlmSettings): LlmSettings {
    return { ...llm, apiKey: llm.apiKey ? this.secrets.encrypt(llm.apiKey) : '' };
  }

  private decryptLlm(llm: LlmSettings): LlmSettings {
    if (!llm.apiKey) return { ...llm, apiKey: '' };
    try {
      return { ...llm, apiKey: this.secrets.decrypt(llm.apiKey) };
    } catch {
      // secret.key was deleted or replaced, or agent.db was moved without it: start anyway, without the key.
      if (!this.keyUnreadableWarned) {
        this.keyUnreadableWarned = true;
        this.logger.warn(
          'Your saved AI API key could not be unlocked (secret.key is missing or was replaced). Sudarshan AI runs without AI until you enter the key again in Settings -> AI model.',
        );
      }
      return { ...llm, apiKey: '' };
    }
  }

  private maskLlm(llm: LlmSettings): PublicLlmSettings {
    const { apiKey, ...rest } = llm;
    return {
      ...rest,
      hasApiKey: apiKey.length > 0,
      apiKeyHint: apiKey.length > 8 ? `${apiKey.slice(0, 3)}...${apiKey.slice(-4)}` : apiKey ? 'set' : '',
    };
  }
}
