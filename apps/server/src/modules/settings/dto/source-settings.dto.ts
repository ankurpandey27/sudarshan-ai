import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SourceSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  dailyLimit?: number;
}
