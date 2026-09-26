import { IsIn } from 'class-validator';
import { SiteId } from '../interfaces/site-session.interface';

export class OpenLoginDto {
  @IsIn(['linkedin', 'naukri', 'instahyre'])
  site!: SiteId;
}
