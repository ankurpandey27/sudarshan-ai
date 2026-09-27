// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { LlmSettings } from '../../settings/interfaces/app-settings.interface';
import { presetFor } from '../constants/llm-presets.constants';
import { LlmProviderKind } from '../enums/llm-provider-kind.enum';
import { LlmTransport } from '../interfaces/llm-transport.interface';
import { AnthropicTransport } from '../transports/anthropic.transport';
import { OpenAiCompatibleTransport } from '../transports/openai-compatible.transport';
import { OpencodeTransport } from '../transports/opencode.transport';

// null until the settings are usable; requireModel=false allows listing models first.
export function createTransport(s: LlmSettings, requireModel = true): LlmTransport | null {
  if (s.provider === LlmProviderKind.NONE) return null;
  const preset = presetFor(s.provider);
  if (!preset) return null;
  const baseUrl = (s.baseUrl || preset.baseUrl).replace(/\/+$/, '');
  if (!baseUrl) return null;
  if (preset.needsKey && !s.apiKey) return null;
  if (requireModel && !s.model) return null;

  switch (s.provider) {
    case LlmProviderKind.ANTHROPIC:
      return new AnthropicTransport(s.model, s.apiKey, s.baseUrl || undefined);
    case LlmProviderKind.OPENCODE:
      return new OpencodeTransport(s.model, baseUrl, s.apiKey);
    default:
      return new OpenAiCompatibleTransport(s.provider, s.model, baseUrl, s.apiKey, preset.local || isLoopback(baseUrl));
  }
}

function isLoopback(url: string): boolean {
  try {
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
