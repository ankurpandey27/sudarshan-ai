import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAnswerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  answer!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  question?: string;
}
