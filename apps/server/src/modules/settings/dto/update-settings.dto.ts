import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { AgentSettingsDto } from './agent-settings.dto';
import { LlmSettingsDto } from './llm-settings.dto';
import { SearchSettingsDto } from './search-settings.dto';
import { SourcesSettingsDto } from './sources-settings.dto';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  onboarded?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => LlmSettingsDto)
  llm?: LlmSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LlmSettingsDto)
  fallbackLlm?: LlmSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SearchSettingsDto)
  search?: SearchSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SourcesSettingsDto)
  sources?: SourcesSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AgentSettingsDto)
  agent?: AgentSettingsDto;
}
