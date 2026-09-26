import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SearchSettingsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  locations?: string[];

  @IsOptional()
  @IsBoolean()
  remoteOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  easyApplyOnly?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  postedWithinDays?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(100)
  maxPerSearch?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  excludeCompanies?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  excludeTitleWords?: string[];
}
