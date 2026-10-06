// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { isHostOf } from './host.util';
import { createHash } from 'node:crypto';
import { JobSource } from '../enums/job-source.enum';
import { ParsedJobUrl } from '../interfaces/parsed-job-url.interface';

export function parseJobUrl(raw: string): ParsedJobUrl | null {
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/^(?!https?:\/\/)/i, 'https://'));
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return null;
  const host = url.hostname.toLowerCase();

  if (isHostOf(host, 'linkedin.com')) {
    const id = /\/jobs\/view\/(?:[^/]*-)?(\d{6,})/.exec(url.pathname)?.[1] ?? url.searchParams.get('currentJobId') ?? undefined;
    if (id) return { source: JobSource.LINKEDIN, externalId: id, url: `https://www.linkedin.com/jobs/view/${id}/` };
  }
  if (isHostOf(host, 'naukri.com')) {
    const id = /-(\d{9,})(?:[/?#]|$)/.exec(url.pathname)?.[1] ?? /(\d{9,})/.exec(url.pathname)?.[1];
    if (id) return { source: JobSource.NAUKRI, externalId: id, url: `${url.origin}${url.pathname}` };
  }
  if (isHostOf(host, 'indeed.com')) {
    // /viewjob?jk=..., search links (?vjk=...) and redirect links (/rc/clk?jk=...) all carry the job key.
    const id = url.searchParams.get('jk') ?? url.searchParams.get('vjk');
    if (id && /^[0-9a-f]{16}$/i.test(id)) return { source: JobSource.INDEED, externalId: id, url: `https://${host}/viewjob?jk=${id}` };
  }
  // Other sites: the URL minus tracking params is the id.
  for (const param of [...url.searchParams.keys()]) {
    if (/^(utm_|ref|source|src|trk|gh_src|lever-source)/i.test(param)) url.searchParams.delete(param);
  }
  url.hash = '';
  const clean = url.toString();
  return { source: JobSource.WEB, externalId: createHash('sha1').update(clean).digest('hex').slice(0, 16), url: clean };
}
