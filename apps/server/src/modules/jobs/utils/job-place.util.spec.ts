// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobRegion, WorkMode } from '../enums/job-place.enum';
import { countryNames, learnAbroadPlaces, learnHomePlaces, regionOf, workModeOf } from './job-place.util';

// Locations as the job sites really wrote them (2026-10-06).
const listings = [
  { platform: 'linkedin', url: 'https://www.linkedin.com/jobs/view/1/', location: 'Gurugram, Haryana, India' },
  { platform: 'linkedin', url: 'https://www.linkedin.com/jobs/view/2/', location: 'Pune Division, Maharashtra, India' },
  { platform: 'naukri', url: 'https://www.naukri.com/job-listings-1', location: 'Hybrid - Hyderabad, Chennai, Bengaluru' },
  { platform: 'instahyre', url: 'https://www.instahyre.com/job-1/', location: 'Delhi,Gurgaon,Noida' },
  { platform: 'linkedin', url: 'https://www.linkedin.com/jobs/view/3/', location: 'London, England, United Kingdom' },
];
const india = countryNames('India');
const home = { country: india, places: learnHomePlaces(india, ['Noida', 'Uttar Pradesh'], listings) };
const job = (location: string, more: Partial<{ platform: string; url: string; isRemote: boolean; title: string; description: string }> = {}) => ({
  platform: 'linkedin',
  url: 'https://www.linkedin.com/jobs/view/9/',
  title: 'Backend Engineer',
  location,
  isRemote: false,
  description: '',
  ...more,
});

describe('where a job is, from your country', () => {
  it('in your country: named, or a place seen in your country before', () => {
    for (const l of ['Noida, Uttar Pradesh, India', 'India', 'Remote (India)', 'Remote / Remote (India)', 'Greater Delhi Area', 'Pune', 'Bangalore,Noida', 'Mumbai Metropolitan Region'.replace('Mumbai', 'Gurugram')]) {
      expect([l, regionOf(job(l), home)]).toEqual([l, JobRegion.HOME]);
    }
  });

  it('abroad: another country, a wider area, or a US place written the US way', () => {
    for (const l of ['United States', 'New York, NY', 'London, England, United Kingdom', 'Toronto, Ontario, Canada', 'Ho Chi Minh City, Vietnam', 'Remote (Anywhere)', 'Remote - Europe', 'São Paulo, São Paulo, Brazil', 'Latin America']) {
      expect([l, regionOf(job(l), home)]).toEqual([l, JobRegion.ABROAD]);
    }
  });

  it('a site with one country\'s jobs only answers for a bare "Remote"; elsewhere it stays unknown', () => {
    expect(regionOf(job('Remote', { platform: 'naukri', url: 'https://www.naukri.com/x' }), home)).toBe(JobRegion.HOME);
    expect(regionOf(job('Remote', { platform: 'indeed', url: 'https://in.indeed.com/viewjob?jk=1' }), home)).toBe(JobRegion.HOME);
    expect(regionOf(job('Remote', { platform: 'indeed', url: 'https://www.indeed.com/viewjob?jk=1' }), home)).toBe(JobRegion.ABROAD);
    expect(regionOf(job('Remote'), home)).toBe(JobRegion.UNKNOWN);
  });

  it('with no country in the profile, nothing is guessed', () => {
    expect(regionOf(job('Noida, Uttar Pradesh, India'), { country: [], places: new Set() })).toBe(JobRegion.UNKNOWN);
  });

  it('works for someone in another country too', () => {
    const us = countryNames('USA');
    const usHome = { country: us, places: learnHomePlaces(us, [], []) };
    expect(regionOf(job('Austin, TX'), usHome)).toBe(JobRegion.HOME);
    expect(regionOf(job('Bengaluru, Karnataka, India'), usHome)).toBe(JobRegion.ABROAD);
  });
});

describe('how a job is worked', () => {
  it('hybrid when the location or title says so, even beside "remote"', () => {
    expect(workModeOf(job('Hybrid - Bengaluru'))).toBe(WorkMode.HYBRID);
    expect(workModeOf(job('Bengaluru (Hybrid)', { isRemote: true }))).toBe(WorkMode.HYBRID);
  });
  it('remote from the flag or the words', () => {
    expect(workModeOf(job('Noida', { isRemote: true }))).toBe(WorkMode.REMOTE);
    expect(workModeOf(job('Work From Home'))).toBe(WorkMode.REMOTE);
  });
  it('hybrid from a description that clearly says so; on-site otherwise', () => {
    expect(workModeOf(job('Pune', { description: 'We follow a hybrid work model.' }))).toBe(WorkMode.HYBRID);
    expect(workModeOf(job('Pune', { description: 'Expect 3 days a week in the office.' }))).toBe(WorkMode.HYBRID);
    expect(workModeOf(job('Pune', { description: 'Our product helps hybrid teams.' }))).toBe(WorkMode.ONSITE);
  });
});

describe('places learned abroad (2026-10-06)', () => {
  it('a metro area of a city seen in another country is abroad; countries with accents match', () => {
    const seen = [
      { platform: 'linkedin', url: 'https://www.linkedin.com/jobs/view/5/', location: 'Madrid, Community of Madrid, Spain' },
      { platform: 'linkedin', url: 'https://www.linkedin.com/jobs/view/6/', location: 'Gurugram, Haryana, India' },
    ];
    const places = learnHomePlaces(india, [], seen);
    const ctx = { country: india, places, abroad: learnAbroadPlaces(india, places, seen) };
    expect(regionOf(job('Greater Madrid Metropolitan Area'), ctx)).toBe(JobRegion.ABROAD);
    expect(regionOf(job('Istanbul, Türkiye'), ctx)).toBe(JobRegion.ABROAD);
    expect(regionOf(job('Yerevan, Yerevan, Armenia'), ctx)).toBe(JobRegion.ABROAD);
    expect(regionOf(job('Gurugram'), ctx)).toBe(JobRegion.HOME);
  });
});
