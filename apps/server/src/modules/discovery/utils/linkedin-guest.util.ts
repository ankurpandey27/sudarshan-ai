import { parse } from 'node-html-parser';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';

export function parseSearchCards(html: string, easyApply: boolean): DiscoveredJob[] {
  const root = parse(html);
  const out: DiscoveredJob[] = [];
  for (const card of root.querySelectorAll('li')) {
    const urn = card.querySelector('[data-entity-urn]')?.getAttribute('data-entity-urn') ?? '';
    const link = card.querySelector('a.base-card__full-link, a[href*="/jobs/view/"]')?.getAttribute('href') ?? '';
    const id = /jobPosting:(\d+)/.exec(urn)?.[1] ?? /(\d{8,})/.exec(link)?.[1];
    if (!id) continue;
    const text = (sel: string) => decodeEntities(card.querySelector(sel)?.innerText?.trim() ?? '');
    const location = text('.job-search-card__location');
    const salaryRaw = text('.job-search-card__salary-info') || null;
    out.push({
      source: JobSource.LINKEDIN,
      externalId: id,
      url: `https://www.linkedin.com/jobs/view/${id}/`,
      title: text('.base-search-card__title') || 'Untitled role',
      company: text('.base-search-card__subtitle'),
      location,
      isRemote: /remote/i.test(location),
      easyApply,
      salaryRaw,
      description: '',
      postedAt: card.querySelector('time')?.getAttribute('datetime') ?? null,
    });
  }
  return out;
}

export const decodeEntities = (s: string): string =>
  s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+\n/g, '\n');
