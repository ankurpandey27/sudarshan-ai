import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JobLinkDto {
  @IsString()
  @MaxLength(2000)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
