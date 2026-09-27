// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LlmProviderKind } from '../enums/llm-provider-kind.enum';

// Omitted fields fall back to the saved settings, so a model can be tested before saving.
export class LlmProbeDto {
  @IsOptional()
  @IsEnum(LlmProviderKind)
  provider?: LlmProviderKind;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsIn(['llm', 'fallbackLlm'])
  slot?: 'llm' | 'fallbackLlm';
}
