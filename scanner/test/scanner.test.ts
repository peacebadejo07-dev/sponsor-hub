import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mapGreenhouse } from '../src/adapters/greenhouse.ts';
import { mapLever } from '../src/adapters/lever.ts';
import { mapAshby, ashbySalary } from '../src/adapters/ashby.ts';
import { mapWorkable } from '../src/adapters/workable.ts';
import { mapSmartRecruiters } from '../src/adapters/smartrecruiters.ts';
import { screen, normalise } from '../src/normalise.ts';
import type { RawJob } from '../src/types.ts';

const fx = (n: string) => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), 'utf8'));
const run = (raw: RawJob) => {
  const s = screen(raw);
  if ('skip' in s) return s;
  return normalise(raw, s.family);
};

describe('greenhouse (real Monzo data)', () => {
  const jobs = fx('greenhouse').jobs.map(mapGreenhouse);
  it('maps ids, titles, locations, URLs and plain-text descriptions', () => {
    const j = jobs.find((x: RawJob) => x.title === 'Android Engineer')!;
    expect(j.externalId).toMatch(/^\d+$/);
    expect(j.applyUrl).toMatch(/^https:\/\/job-boards\.greenhouse\.io\/monzo\/jobs\/\d+/);
    expect(j.locations.join(' ')).toMatch(/london|cardiff|remote/i);
    expect(j.descriptionText).toBeTruthy();
    expect(j.descriptionText).not.toContain('<div');
    expect(j.descriptionText).not.toContain('&lt;');
  });
  it('keeps UK tech jobs and labels inferred fields as inferred', () => {
    const o = run(jobs.find((x: RawJob) => x.title === 'Android Engineer')!) as any;
    expect(o.role_family).toBe('software');
    expect(o.provenance.role_family.status).toBe('inferred');
    // Greenhouse has no structured pay, so any salary comes from text and must be inferred.
    if (o.salary_min) expect(o.provenance.salary.status).toBe('inferred');
    expect(o.salary_currency === null || o.salary_currency === 'GBP').toBe(true);
    expect(['verified', 'unconfirmed', 'inferred']).toContain(o.provenance.sponsorship.status);
  });
  it('treats internships as entry level and as an internship', () => {
    const o = run(jobs.find((x: RawJob) => /Software Engineer - Intern/.test(x.title))!) as any;
    expect(o.seniority).toBe('entry');
    expect(o.employment_type).toBe('internship');
    expect(o.provenance.employment_type.status).toBe('inferred');
  });
  it('drops non-tech roles', () => {
    expect(run({ ...jobs[0], title: 'Marketing Manager', department: 'Marketing' })).toEqual({ skip: 'not_tech' });
  });
});

describe('lever (real Palantir data)', () => {
  const jobs = fx('lever').map(mapLever);
  it('uses allLocations, country and the apply link', () => {
    const j = jobs.find((x: RawJob) => /Backend Software Engineer - Infrastructure/.test(x.title))!;
    expect(j.locations.join(' ')).toContain('London');
    expect(j.countryCodes).toEqual(['GB']);
    expect(j.applyUrl).toMatch(/jobs\.lever\.co\/palantir\/.+\/apply$/);
    expect(j.postedAt).toBeInstanceOf(Date);
  });
  it('treats an API-stated workplace type and commitment as verified', () => {
    const o = run(jobs.find((x: RawJob) => /Backend Software Engineer - Infrastructure/.test(x.title))!) as any;
    expect(o.role_family).toBe('software');
    expect(o.provenance.work_mode.status).toBe('verified');
    expect(o.provenance.employment_type.status).toBe('verified');
    expect(o.employment_type).toBe('full_time');
  });
  it('excludes the non-UK job', () => {
    expect(run(jobs.find((x: RawJob) => x.countryCodes[0] === 'US')!)).toEqual({ skip: 'not_uk' });
  });
});

describe('ashby (real Ramp data)', () => {
  const raw = fx('ashby').jobs;
  it('maps structured salary as verified, with currency and period', () => {
    const j = mapAshby(raw.find((x: any) => x.compensation?.compensationTiers?.length));
    expect(j.salary).toMatchObject({ currency: 'USD', period: 'year' });
    expect(j.salary!.min).toBeGreaterThan(1000);
  });
  it('prefers GBP and ignores equity-only components', () => {
    expect(
      ashbySalary({
        compensationTiers: [
          { components: [{ compensationType: 'EquityPercentage', interval: 'NONE', currencyCode: null }, { compensationType: 'Salary', interval: '1 YEAR', currencyCode: 'USD', minValue: 100000, maxValue: 120000 }] },
          { components: [{ compensationType: 'Salary', interval: '1 YEAR', currencyCode: 'GBP', minValue: 70000, maxValue: 90000 }] }
        ]
      })
    ).toEqual({ min: 70000, max: 90000, currency: 'GBP', period: 'year' });
  });
  it('skips non-UK jobs', () => {
    const j = mapAshby(raw[0]);
    expect(run({ ...j, locations: ['New York, NY (HQ)', 'USA'] })).toEqual({ skip: 'not_uk' });
  });
});

describe('workable (real data)', () => {
  const jobs = fx('workable').jobs.map(mapWorkable);
  it('builds locations from the locations array and uses the apply link', () => {
    expect(jobs[0].externalId).toBeTruthy();
    expect(jobs[0].applyUrl).toMatch(/apply\.workable\.com\/j\/.+\/apply/);
    expect(jobs[0].locations[0]).toMatch(/,/);
    expect(jobs[0].countryCodes[0]).toMatch(/^[A-Z]{2}$/);
  });
  it('only treats telecommuting=true as remote; false is not "onsite"', () => {
    expect(mapWorkable({ ...fx('workable').jobs[0], telecommuting: false }).workMode).toBeNull();
    expect(mapWorkable({ ...fx('workable').jobs[0], telecommuting: true }).workMode).toBe('remote');
  });
});

describe('smartrecruiters (real Bosch data)', () => {
  const list = fx('smartrecruiters-list').content.map(mapSmartRecruiters);
  it('maps UK list items; description and apply link come from the detail call', () => {
    expect(list[0].countryCodes).toEqual(['gb']);
    expect(list[0].descriptionText).toBeNull();
    expect(list[0].applyUrl).toBeNull();
  });
  it('never invents sponsorship info when the description is missing', () => {
    const j = { ...list[0], title: 'Software Engineer', applyUrl: 'https://example.com/a' };
    const o = run(j) as any;
    expect(o.sponsorship_signal).toBe('unmentioned');
    expect(o.provenance.sponsorship.status).toBe('unconfirmed');
    expect(o.provenance.sponsorship.detail).toMatch(/not available/);
  });
  it('detail response has the pieces the scanner needs', () => {
    const d = fx('smartrecruiters-detail');
    expect(d.postingUrl).toMatch(/^https:\/\/jobs\.smartrecruiters\.com\//);
    expect(Object.keys(d.jobAd.sections).length).toBeGreaterThan(0);
  });
});

describe('normalise: honesty about unknowns', () => {
  const base: RawJob = {
    externalId: '1', title: 'Data Engineer', locations: ['London, UK'], countryCodes: [], applyUrl: 'https://x.test/apply',
    postedAt: null, department: null, employmentTypeRaw: null, workMode: null, descriptionText: 'Join our team. Build pipelines.', salary: null
  };
  it('marks anything not stated as unconfirmed rather than guessing', () => {
    const o = run(base) as any;
    expect(o.work_mode).toBeNull();
    expect(o.provenance.work_mode.status).toBe('unconfirmed');
    expect(o.employment_type).toBeNull();
    expect(o.provenance.employment_type.status).toBe('unconfirmed');
    expect(o.salary_min).toBeNull();
    expect(o.provenance.salary.status).toBe('unconfirmed');
    expect(o.sponsorship_signal).toBe('unmentioned');
    expect(o.provenance.sponsorship.status).toBe('unconfirmed');
  });
  it('quotes the posting when it refuses sponsorship, and never calls that an offer', () => {
    const o = run({ ...base, descriptionText: 'We are unable to offer visa sponsorship for this role.' }) as any;
    expect(o.sponsorship_signal).toBe('not_offered');
    expect(o.provenance.sponsorship.status).toBe('verified');
    expect(o.sponsorship_snippet).toContain('unable to offer visa sponsorship');
  });
  it('parses a text salary as inferred, and a changed description changes the hash', () => {
    const a = run({ ...base, descriptionText: 'Salary £60,000 - £75,000' }) as any;
    expect(a.salary_min).toBe(60000);
    expect(a.provenance.salary.status).toBe('inferred');
    const b = run({ ...base, descriptionText: 'Salary £60,000 - £80,000' }) as any;
    expect(a.content_hash).not.toBe(b.content_hash);
    expect((run(base) as any).content_hash).toBe((run({ ...base }) as any).content_hash);
  });
  it('requires an apply link', () => {
    expect(run({ ...base, applyUrl: null })).toEqual({ skip: 'no_apply_url' });
  });
});
