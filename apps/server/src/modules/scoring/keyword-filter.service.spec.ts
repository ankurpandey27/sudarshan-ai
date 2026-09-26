import { KeywordFilterService } from './keyword-filter.service';
import { ProfileSnapshot, JobSnapshot } from './interfaces/snapshots.interface';
import { SkipRule } from './enums/skip-rule.enum';

const profile: ProfileSnapshot = {
  yearsExperience: 3,
  skills: ['node', 'typescript', 'postgresql'],
  expectedSalary: 10_00_000,
  salaryCurrency: 'INR',
  location: 'India',
  remotePreferred: true,
};

const job = (over: Partial<JobSnapshot>): JobSnapshot => ({
  title: 'Backend Engineer',
  company: 'Acme',
  location: 'India',
  isRemote: false,
  requiredSkills: ['node'],
  description: '',
  ...over,
});

describe('KeywordFilterService', () => {
  it('rejects salaries under 70% of expectation', () => {
    const f = new KeywordFilterService();
    const verdict = f.filter(
      profile,
      job({ salaryMin: 5_00_000, salaryMax: 6_00_000 }),
    );
    expect(verdict.outcome).toBe('SKIP');
    if (verdict.outcome === 'SKIP') {
      expect(verdict.rule).toBe(SkipRule.SALARY);
    }
  });

  it('blocks a job whose required stack the profile has none of', () => {
    const f = new KeywordFilterService();
    const verdict = f.filter(profile, job({ requiredSkills: ['golang', 'rust'] }));
    expect(verdict.outcome).toBe('SKIP');
    if (verdict.outcome === 'SKIP') {
      expect(verdict.rule).toBe(SkipRule.MISSING_SKILLS);
    }
  });

  it('passes a matching remote job', () => {
    const f = new KeywordFilterService();
    expect(f.filter(profile, job({ isRemote: true })).outcome).toBe('PASS');
  });

  it('keeps a range whose TOP meets the floor (5-15L vs 10L expected)', () => {
    const f = new KeywordFilterService();
    expect(f.filter(profile, job({ isRemote: true, salaryMin: 5_00_000, salaryMax: 15_00_000 })).outcome).toBe('PASS');
  });

  it('keeps on-site jobs in bare Indian cities for an "India" profile (Naukri format)', () => {
    const f = new KeywordFilterService();
    expect(f.filter(profile, job({ location: 'Bengaluru' })).outcome).toBe('PASS');
    expect(f.filter(profile, job({ location: 'Hyderabad, Pune' })).outcome).toBe('PASS');
    const abroad = f.filter(profile, job({ location: 'Singapore' }));
    expect(abroad).toMatchObject({ outcome: 'SKIP', rule: SkipRule.LOCATION });
  });

  it('never skips on skills when the profile has none (unknown is not "no match")', () => {
    const f = new KeywordFilterService();
    expect(f.filter({ ...profile, skills: [] }, job({ requiredSkills: ['node.js', 'typescript'] })).outcome).toBe('PASS');
  });
});