import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnswerQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  answer!: string;
}
