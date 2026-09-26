import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { SourceSettingsDto } from './source-settings.dto';

export class SourcesSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => SourceSettingsDto)
  linkedin?: SourceSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SourceSettingsDto)
  naukri?: SourceSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SourceSettingsDto)
  links?: SourceSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SourceSettingsDto)
  externalSites?: SourceSettingsDto;
}
