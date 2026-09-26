import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class ProfileSkillDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  @Max(50)
  years!: number | null;
}
