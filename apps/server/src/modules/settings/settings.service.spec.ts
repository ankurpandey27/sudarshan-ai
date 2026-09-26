import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../common/storage/storage.service';
import { SecretBoxService } from '../../common/crypto/secret-box.service';
import { LlmProviderKind } from '../llm/enums/llm-provider-kind.enum';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let dir: string;
  let storage: StorageService;
  let settings: SettingsService;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'jaa-settings-'));
    storage = new StorageService(':memory:');
    const config = { getOrThrow: () => join(dir, 'secret.key') } as unknown as ConfigService;
    settings = new SettingsService(storage, new SecretBoxService(config));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('encrypts keys at rest and masks them over the API', () => {
    const pub = settings.update({ llm: { provider: LlmProviderKind.ANTHROPIC, model: 'claude-opus-5', apiKey: 'sk-ant-secret-123456' } });
    expect(pub.llm).toMatchObject({ hasApiKey: true, apiKeyHint: 'sk-...3456' });
    expect(JSON.stringify(pub)).not.toContain('secret');
    const raw = storage.get<{ value: string }>("SELECT value FROM settings WHERE key = 'llm'")!.value;
    expect(raw).not.toContain('sk-ant-secret');
    expect(settings.get().llm.apiKey).toBe('sk-ant-secret-123456');
  });

  it('keeps the stored key when a patch omits it, and clears it on provider change', () => {
    settings.update({ llm: { provider: LlmProviderKind.OPENAI, model: 'gpt-5-mini', apiKey: 'sk-openai-abcdef' } });
    settings.update({ llm: { model: 'gpt-5' } });
    expect(settings.get().llm).toMatchObject({ model: 'gpt-5', apiKey: 'sk-openai-abcdef' });
    settings.update({ llm: { provider: LlmProviderKind.OLLAMA } });
    expect(settings.get().llm).toMatchObject({ provider: 'ollama', apiKey: '', model: '' });
  });

  it('merges partial section updates over defaults', () => {
    settings.update({ sources: { naukri: { dailyLimit: 10 } } });
    expect(settings.get().sources.naukri).toEqual({ enabled: true, dailyLimit: 10 });
    expect(settings.get().sources.linkedin.dailyLimit).toBe(25);
  });
});
