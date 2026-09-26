import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SkipQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  key!: string;
}
