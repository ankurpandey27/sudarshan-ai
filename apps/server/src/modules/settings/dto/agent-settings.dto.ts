// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AgentMode } from '../enums/agent-mode.enum';

export class AgentSettingsDto {
  @IsOptional()
  @IsEnum(AgentMode)
  mode?: AgentMode;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minApplyScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minReviewScore?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(1440)
  intervalMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(3600)
  minDelaySeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(3600)
  maxDelaySeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  activeHoursStart?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  activeHoursEnd?: number;

  @IsOptional()
  @IsBoolean()
  headless?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  browserPath?: string;

  @IsOptional()
  @IsBoolean()
  llmScoring?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  tokenBudgetPerDay?: number;

  @IsOptional()
  @IsBoolean()
  pauseBeforeSubmit?: boolean;

  @IsOptional()
  @IsBoolean()
  pastAnswers?: boolean;

  @IsOptional()
  @IsBoolean()
  rescue?: boolean;

  @IsOptional()
  @IsBoolean()
  carefulAfterPause?: boolean;
}
