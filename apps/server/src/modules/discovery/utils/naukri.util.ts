import { JobSource } from '../../jobs/enums/job-source.enum';
import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import { NaukriJob } from '../interfaces/naukri-api.interface';
import { detectRemote } from './job-normalizer.util';

export const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function naukriJobToDiscovered(j: NaukriJob): DiscoveredJob | null {
  if (!j.jobId || !j.jdURL) return null;
  const ph = (type: string) => j.placeholders?.find((p) => p.type === type)?.label ?? '';
  const location = ph('location');
  const description = [
    stripHtml(j.jobDescription ?? ''),
    ph('experience') ? `Experience: ${ph('experience')}` : '',
    j.tagsAndSkills ? `Skills: ${j.tagsAndSkills}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const external = j.applyRedirectUrl || j.companyApplyUrl || null;
  return {
    source: JobSource.NAUKRI,
    externalId: j.jobId,
    url: j.jdURL.startsWith('http') ? j.jdURL : `https://www.naukri.com${j.jdURL}`,
    applyUrl: external,
    title: j.title ?? 'Untitled role',
    company: j.companyName ?? '',
    location,
    isRemote: detectRemote(location, description),
    easyApply: !external,
    salaryRaw: ph('salary') && !/not disclosed/i.test(ph('salary')) ? ph('salary') : null,
    description,
    skills: (j.tagsAndSkills ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    postedAt: j.createdDate ? new Date(j.createdDate).toISOString() : null,
  };
}

const stripHtml = (s: string): string => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
