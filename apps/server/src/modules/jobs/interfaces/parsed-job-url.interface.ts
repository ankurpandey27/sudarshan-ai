import { JobSource } from '../enums/job-source.enum';

export interface ParsedJobUrl {
  source: JobSource;
  externalId: string;
  url: string;
}
