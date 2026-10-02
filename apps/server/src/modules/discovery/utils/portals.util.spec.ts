// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobSource } from '../../jobs/enums/job-source.enum';
import { platformOf } from '../../jobs/utils/platform.util';
import { JobPlatform } from '../../jobs/enums/job-platform.enum';
import { founditJobToDiscovered, founditSearchPath, himalayasJobToDiscovered, himalayasSearchUrl, hiristJobToDiscovered, hiristQuery, inPlace } from './portals.util';

// Shapes as Foundit and Hirist returned them on 2026-10-02.
const foundit = {
  jobId: 69169567,
  title: 'Full stack Development (Python/Node JS, React, Cloud) | 7+ Yrs| Gurugram',
  companyName: 'Neerinfo Solutions',
  locations: 'Gurugram, India, Gurugram',
  skills: 'CI/CD,Databases, Node.js, Rest Apis, react.js , Python',
  exp: '7-9 Years',
  redirectUrl: '',
  seoJdUrl: '/job/full-stack-development-python-node-js-react-cloud-7-yrs-gurugram-neerinfo-solutions-gurgaon-gurugram-india-gurugram-69169567',
  createdAt: 1790620489000,
  minimumSalary: { absoluteValue: 0 },
  maximumSalary: { absoluteValue: 0 },
};
const hirist = {
  id: 1676327,
  title: 'EXL - Full Stack Technical Lead - React.js/Node.js',
  min: 10,
  max: 15,
  jobDetailUrl: 'https://www.hirist.tech/j/exl-full-stack-technical-lead-react-jsnode-js-1676327',
  applyUrl: '',
  workFromHome: 0,
  createdTime: 1790793000000,
  tags: [{ name: 'React.js' }, { name: 'Node.js' }, { name: 'Kafka' }],
  locations: [{ name: 'Pune' }],
  companyData: { companyName: 'EXL Services' },
};

describe('Foundit and Hirist listings', () => {
  it("reads a Foundit job of Foundit's own", () => {
    const j = founditJobToDiscovered(foundit)!;
    expect(j).toMatchObject({ source: JobSource.WEB, company: 'Neerinfo Solutions', location: 'Gurugram, India, Gurugram', salaryMin: null, salaryMax: null });
    expect(j.url).toBe(`https://www.foundit.in${foundit.seoJdUrl}`);
    expect(j.skills).toEqual(['CI/CD', 'Databases', 'Node.js', 'Rest Apis', 'react.js', 'Python']);
    expect(j.description).toContain('Experience: 7-9 Years');
    expect(platformOf(j.source, j.url)).toBe(JobPlatform.FOUNDIT);
  });

  it('leaves Foundit copies of LinkedIn jobs to the LinkedIn search, and treats company-site ones as that site', () => {
    expect(founditJobToDiscovered({ ...foundit, redirectUrl: 'https://www.linkedin.com/jobs/view/4465732762/' })).toBeNull();
    const workday = founditJobToDiscovered({ ...foundit, redirectUrl: 'https://pwc.wd3.myworkdayjobs.com/Global_Experienced_Careers/job/Delhi/X_736625WD-1' })!;
    expect(workday.url).toContain('myworkdayjobs.com');
    expect(platformOf(workday.source, workday.url)).toBe(JobPlatform.OTHER);
    expect(founditJobToDiscovered(null)).toBeNull();
  });

  it('reads a Hirist job, with its skills and experience', () => {
    const j = hiristJobToDiscovered(hirist)!;
    expect(j).toMatchObject({ company: 'EXL Services', location: 'Pune', isRemote: false, url: hirist.jobDetailUrl });
    expect(j.skills).toEqual(['React.js', 'Node.js', 'Kafka']);
    expect(j.description).toContain('Experience: 10-15 years');
    expect(platformOf(j.source, j.url)).toBe(JobPlatform.HIRIST);
  });

  it('keeps only jobs in the places you search', () => {
    expect(inPlace('Noida', 'Noida, Uttar Pradesh', false)).toBe(true);
    expect(inPlace('Gurgaon', 'Gurugram, India', false)).toBe(true);
    expect(inPlace('Bengaluru', 'Bangalore', false)).toBe(true);
    expect(inPlace('Noida', 'Pune', false)).toBe(false);
    expect(inPlace('India', 'Pune', false)).toBe(true);
    expect(inPlace('Remote', 'Pune', true)).toBe(true);
    expect(inPlace('Remote', 'Work From Home', false)).toBe(true);
    expect(inPlace('Remote', 'Pune', false)).toBe(false);
    expect(inPlace('Noida', 'Delhi NCR', false)).toBe(true);
    expect(inPlace('Pune', 'Delhi NCR', false)).toBe(false);
  });

  it('reads a Himalayas job as remote, with plain-text description, and skips an expired one', () => {
    const himalayas = {
      title: 'Senior Node.js Developer',
      companyName: 'ITHR Technologies Consulting LLC',
      description: '<h3>Title: Senior Node.js Developer</h3><p>Remote WFH, <b>Node.js</b> and AWS.</p>',
      minSalary: null,
      maxSalary: null,
      currency: null,
      locationRestrictions: ['India'],
      pubDate: 1788899534,
      expiryDate: 1791433247,
      applicationLink: 'https://himalayas.app/companies/ithr-technologies-consulting-llc/jobs/senior-node-js-developer',
    };
    const j = himalayasJobToDiscovered(himalayas, 1790000000000)!;
    expect(j).toMatchObject({ location: 'Remote (India)', isRemote: true, salaryRaw: null, company: 'ITHR Technologies Consulting LLC' });
    expect(j.description).toContain('Node.js and AWS');
    expect(j.description).not.toContain('<');
    expect(platformOf(j.source, j.url)).toBe(JobPlatform.HIMALAYAS);
    expect(himalayasJobToDiscovered(himalayas, 1792000000000)).toBeNull();
    expect(himalayasJobToDiscovered({ ...himalayas, minSalary: 45000, maxSalary: 50000, currency: 'USD', salaryPeriod: 'annual' }, 1790000000000)!.salaryRaw).toBe('USD 45000-50000 annual');
    expect(himalayasSearchUrl('node.js', 'India', 2)).toBe('https://himalayas.app/jobs/api/search?q=node.js&country=India&page=2');
  });

  it('searches Hirist by the skill name its tags use', () => {
    expect(hiristQuery('Nodejs')).toBe('node.js');
    expect(hiristQuery('nestjs')).toBe('nestjs');
    expect(hiristQuery('Backend Developer')).toBe('Backend Developer');
  });

  it("asks Foundit for the place, and for working from home when you search Remote", () => {
    expect(founditSearchPath('node.js', 'Noida', 1)).toBe('/middleware/jobsearch?sort=1&limit=15&start=15&query=node.js&locations=Noida');
    expect(founditSearchPath('node.js', 'Remote', 0)).toContain('locations=Work+From+Home');
    expect(founditSearchPath('node.js', 'India', 0)).not.toContain('locations');
  });
});
