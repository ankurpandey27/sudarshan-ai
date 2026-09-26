import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LlmProviderKind } from '../../llm/enums/llm-provider-kind.enum';

export class LlmSettingsDto {
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
}
