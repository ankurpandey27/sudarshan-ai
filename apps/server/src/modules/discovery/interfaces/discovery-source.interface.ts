import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { SearchSettings } from '../../settings/interfaces/app-settings.interface';

export interface SearchQuery {
  keyword: string;
  location: string;
  prefs: SearchSettings;
  onProgress: (message: string) => void;
}

export interface DiscoverySource {
  readonly source: JobSource;
  search(query: SearchQuery): Promise<DiscoveredJob[]>;
  enrich?(job: DiscoveredJob): Promise<DiscoveredJob>;
}

export interface DiscoveryRunResult {
  source: JobSource;
  found: number;
  added: number;
  error?: string;
}
