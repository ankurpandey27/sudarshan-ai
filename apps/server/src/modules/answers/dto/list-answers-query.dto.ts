import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListAnswersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
