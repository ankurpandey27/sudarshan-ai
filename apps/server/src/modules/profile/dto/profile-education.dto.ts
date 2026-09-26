import { IsInt, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class ProfileEducationDto {
  @IsString()
  @MaxLength(120)
  degree!: string;

  @IsString()
  @MaxLength(120)
  field!: string;

  @IsString()
  @MaxLength(200)
  institution!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  startYear!: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  endYear!: number | null;

  @IsString()
  @MaxLength(40)
  grade!: string;
}
