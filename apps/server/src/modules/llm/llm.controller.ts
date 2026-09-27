// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { LlmSettings } from '../settings/interfaces/app-settings.interface';
import { LLM_PRESETS } from './constants/llm-presets.constants';
import { LlmProbeDto } from './dto/llm-probe.dto';
import { LlmProviderPreset } from './interfaces/llm-provider-preset.interface';
import { LlmUsageSummary } from './interfaces/llm-usage-summary.interface';
import { LlmService } from './llm.service';
import { describeLlmError } from './utils/llm-error.util';

@Controller('llm')
export class LlmController {
  constructor(
    private readonly llm: LlmService,
    private readonly settings: SettingsService,
  ) {}

  @Get('providers')
  providers(): LlmProviderPreset[] {
    return LLM_PRESETS;
  }

  @Get('usage')
  usage(): LlmUsageSummary {
    return this.llm.usage();
  }

  @Post('test')
  @HttpCode(200)
  test(@Body() dto: LlmProbeDto) {
    return this.llm.test(this.resolve(dto));
  }

  @Post('models')
  @HttpCode(200)
  async models(@Body() dto: LlmProbeDto): Promise<{ models: string[]; error?: string }> {
    try {
      return { models: await this.llm.listModels(this.resolve(dto)) };
    } catch (err) {
      return { models: [], error: describeLlmError(err) };
    }
  }

  private resolve(dto: LlmProbeDto): LlmSettings {
    const saved = this.settings.get()[dto.slot ?? 'llm'];
    const providerChanged = dto.provider !== undefined && dto.provider !== saved.provider;
    return {
      provider: dto.provider ?? saved.provider,
      model: dto.model ?? (providerChanged ? '' : saved.model),
      baseUrl: dto.baseUrl ?? (providerChanged ? '' : saved.baseUrl),
      apiKey: dto.apiKey ?? (providerChanged ? '' : saved.apiKey),
    };
  }
}
