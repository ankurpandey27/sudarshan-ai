import { canonicalSkill, detectRemote, extractSkills, parseSalary } from './job-normalizer.util';

describe('parseSalary (real board formats)', () => {
  it.each([
    ['12-20 Lacs PA', 12e5, 20e5], // Naukri, no currency sign
    ['₹ 8-12 LPA', 8e5, 12e5],
    ['₹10,00,000/yr - ₹15,00,000/yr', 10e5, 15e5], // LinkedIn India
    ['$120K/yr - $150K/yr', 120e3, 150e3], // LinkedIn US
    ['$120,000 - $150,000', 120e3, 150e3],
    ['₹50,000/month - ₹80,000/month', 6e5, 9.6e5],
    ['INR 1.2 - 1.8 Cr', 1.2e7, 1.8e7],
  ])('%s', (raw, min, max) => {
    const r = parseSalary(raw);
    expect(r.min).toBeCloseTo(min);
    expect(r.max).toBeCloseTo(max);
  });

  it.each(['2-5 years', '3 - 6 Yrs', 'Not disclosed', '$40 - $60/hr', ''])('refuses to guess: %s', (raw) => {
    expect(parseSalary(raw)).toEqual({ min: null, max: null });
  });
});

describe('detectRemote', () => {
  it('hybrid is NOT remote; explicit remote is', () => {
    expect(detectRemote('Bengaluru (Hybrid)')).toBe(false);
    expect(detectRemote('Remote')).toBe(true);
    expect(detectRemote('India (Remote)')).toBe(true);
    expect(detectRemote('Pune', 'We are a fully remote company')).toBe(true);
    expect(detectRemote('Pune', 'This role is not remote; you will work with remote teams')).toBe(false);
  });
});

describe('extractSkills (title)', () => {
  it('finds the stack in a job title', () => {
    expect(extractSkills('Node.js Developer')).toContain('node.js');
  });
});

describe('extractSkills', () => {
  it('matches whole tokens only (no "go" in "good", "ai" in "email", "rest" in "interest")', () => {
    const skills = extractSkills(
      'Good communication, email etiquette and interest in learning are a must.',
    );
    expect(skills).not.toContain('go');
    expect(skills).not.toContain('ai');
    expect(skills).not.toContain('rest');
  });

  it('collapses spelling variants into one canonical skill', () => {
    const skills = extractSkills('Node / Node.js / NodeJS with Postgres and K8s');
    expect(skills.filter((s) => s === 'node.js')).toHaveLength(1);
    expect(skills).toContain('postgresql');
    expect(skills).toContain('kubernetes');
    expect(skills).not.toContain('node');
  });

  it('matches symbol-bearing skills like C# and .NET', () => {
    const skills = extractSkills('Backend in C# on .NET, REST APIs');
    expect(skills).toEqual(expect.arrayContaining(['c#', '.net', 'rest']));
  });
});

describe('canonicalSkill', () => {
  it('normalises case and aliases', () => {
    expect(canonicalSkill('Node')).toBe('node.js');
    expect(canonicalSkill(' PostgreSQL ')).toBe('postgresql');
    expect(canonicalSkill('TypeScript')).toBe('typescript');
  });
});
