import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mapGreenhouse } from '../src/adapters/greenhouse.ts';
import { mapLever } from '../src/adapters/lever.ts';
import { mapAshby, ashbySalary } from '../src/adapters/ashby.ts';
import { mapWorkable } from '../src/adapters/workable.ts';
import { mapSmartRecruiters } from '../src/adapters/smartrecruiters.ts';
import { parseTeamtailorFeed } from '../src/adapters/teamtailor.ts';
import { mapBambooHr } from '../src/adapters/bamboohr.ts';
import { htmlToText } from '@sponsored/core';
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

import { parseSlug, ukLocationFacet, parsePostedOn, mapWorkday } from '../src/adapters/workday.ts';

describe('workday (real Arctic Wolf data)', () => {
  const list = fx('workday-list');
  it('parses slugs with and without the host number', () => {
    expect(parseSlug('arcticwolf.wd1/External')).toEqual({ tenant: 'arcticwolf', wd: 'wd1', site: 'External' });
    expect(parseSlug('alfa/Alfa')).toEqual({ tenant: 'alfa', wd: null, site: 'Alfa' });
    expect(parseSlug('broken')).toBeNull();
  });
  it('finds the UK locations in the real facet tree and ignores the rest', () => {
    const f = ukLocationFacet(list.facets)!;
    expect(f.param).toBe('locations');
    expect(f.any).toBe(true);
    expect(f.ids.length).toBeGreaterThan(0);
    const names = list.facets.flatMap((x: any) => x.values ?? []).flatMap((g: any) => g.values ?? []).filter((v: any) => f.ids.includes(v.id)).map((v: any) => v.descriptor);
    expect(names.some((n: string) => /GBR|United Kingdom|UK/i.test(n))).toBe(true);
    expect(names.some((n: string) => /Bengaluru|Cork|Frankfurt|USA|Canada/i.test(n))).toBe(false);
  });
  it('reports a board with no UK location, and one with no location facet', () => {
    const noUk = [{ facetParameter: 'locations', values: [{ descriptor: 'Cork, IRL', id: 'a' }, { descriptor: 'Austin, TX, USA', id: 'b' }] }];
    expect(ukLocationFacet(noUk as any)).toEqual({ param: 'locations', ids: [], any: false });
    expect(ukLocationFacet([{ facetParameter: 'timeType', values: [{ descriptor: 'Full time', id: 'x' }] }] as any)).toBeNull();
  });
  it('turns relative posting dates into approximate dates', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    expect(parsePostedOn('Posted Today', now)?.toISOString().slice(0, 10)).toBe('2026-10-10');
    expect(parsePostedOn('Posted Yesterday', now)?.toISOString().slice(0, 10)).toBe('2026-10-09');
    expect(parsePostedOn('Posted 3 Days Ago', now)?.toISOString().slice(0, 10)).toBe('2026-10-07');
    expect(parsePostedOn('Posted 30+ Days Ago', now)?.toISOString().slice(0, 10)).toBe('2026-09-10');
    expect(parsePostedOn('whenever', now)).toBeNull();
  });
  it('maps a posting, using the requisition id and treating UK-filtered jobs as UK even when it says "2 Locations"', () => {
    const j = mapWorkday({ ...list.jobPostings[0], locationsText: '2 Locations' }, 'https://x.wd1.myworkdayjobs.com/wday/cxs/x/External', 'https://x.wd1.myworkdayjobs.com/External', true);
    expect(j.externalId).toBe(list.jobPostings[0].bulletFields[0]);
    expect(j.applyUrl).toBe(`https://x.wd1.myworkdayjobs.com/External${list.jobPostings[0].externalPath}`);
    expect(j.countryCodes).toEqual(['GB']);
    expect(j.descriptionText).toBeNull();
    expect(JSON.parse(j.ref!).path).toBe(list.jobPostings[0].externalPath);
    const s = screen({ ...j, title: 'Senior Software Engineer' });
    expect('skip' in s).toBe(false);
  });
  it('without a location filter, a job is not assumed to be UK', () => {
    const j = mapWorkday(list.jobPostings[0], 'b', 's', false);
    expect(j.countryCodes).toEqual([]);
  });
  it('the real detail response carries description, location and a job URL', () => {
    const info = fx('workday-detail').jobPostingInfo;
    expect(info.jobDescription.length).toBeGreaterThan(100);
    expect(info.externalUrl).toMatch(/^https:\/\/arcticwolf\.wd1\.myworkdayjobs\.com\//);
    expect(info.timeType).toBe('Full time');
  });
});

import { extractJobPostings, mapJobPosting, jsonLdSalary, jobLinks } from '../src/adapters/jsonld.ts';

const ld = (...objs: unknown[]) => `<html><head>${objs.map((o) => `<script type="application/ld+json">${typeof o === 'string' ? o : JSON.stringify(o)}</script>`).join('')}</head><body>x</body></html>`;
const JP = (extra: Record<string, unknown> = {}) => ({ '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Data Engineer', description: '<p>Build pipelines. We offer visa sponsorship.</p>', ...extra });

describe('json-ld JobPosting (real pages)', () => {
  const real = fx('jsonld-postings') as any[];
  it('maps a real remote posting with structured pay', () => {
    const j = mapJobPosting(real[0], real[0].__page)!;
    expect(j.title).toBe('Pre-sales Solution Architect');
    expect(j.externalId).toBe('8019480');
    expect(j.workMode).toBe('remote'); // jobLocationType TELECOMMUTE
    expect(j.employmentTypeRaw).toBe('FULL_TIME');
    expect(j.postedAt?.toISOString().slice(0, 10)).toBe('2026-07-03');
    expect(j.applyUrl).toBe(real[0].__page);
    expect(j.locations.join(' ')).toMatch(/Remote/);
    expect(j.salary).toMatchObject({ currency: 'GBP', period: 'year' });
  });
  it('maps a real minimal posting where the address is just a string', () => {
    const j = mapJobPosting(real[1], real[1].__page)!;
    expect(j.title).toBe('Front-End Developer');
    expect(j.locations).toEqual(['Luton']);
    expect(j.workMode).toBeNull();
    expect(j.externalId).toBe('/jobs/front-end-developer/');
  });
});

describe('json-ld extraction', () => {
  it('finds postings in a @graph, an array, an ItemList and a list-typed @type', () => {
    expect(extractJobPostings(ld({ '@graph': [{ '@type': 'WebSite' }, JP()] }))).toHaveLength(1);
    expect(extractJobPostings(ld([JP(), JP({ title: 'Designer' })]))).toHaveLength(2);
    expect(extractJobPostings(ld({ '@type': 'ItemList', itemListElement: [{ '@type': 'ListItem', item: JP() }, { '@type': 'ListItem', item: JP({ title: 'PM' }) }] }))).toHaveLength(2);
    expect(extractJobPostings(ld({ ...JP(), '@type': ['JobPosting', 'Thing'] }))).toHaveLength(1);
  });
  it('survives a broken block and tolerates trailing commas', () => {
    expect(extractJobPostings(ld('{ not json', JP()))).toHaveLength(1);
    expect(extractJobPostings(ld('{"@type":"JobPosting","title":"X",}'))).toHaveLength(1);
    expect(extractJobPostings('<html><body>no data</body></html>')).toEqual([]);
  });
});

describe('json-ld mapping rules', () => {
  const page = 'https://acme.test/careers/data-engineer';
  it('drops a posting the employer says has closed, keeps one that has not', () => {
    const now = new Date('2026-10-10');
    expect(mapJobPosting(JP({ validThrough: '2026-09-01' }), page, now)).toBeNull();
    expect(mapJobPosting(JP({ validThrough: '2026-12-01' }), page, now)).not.toBeNull();
    expect(mapJobPosting(JP({ validThrough: 'not a date' }), page, now)).not.toBeNull();
  });
  it('requires a title', () => {
    expect(mapJobPosting(JP({ title: '  ' }), page)).toBeNull();
  });
  it('builds UK locations from structured addresses and country codes', () => {
    const j = mapJobPosting(JP({ jobLocation: { '@type': 'Place', address: { addressLocality: 'Leeds', addressRegion: 'West Yorkshire', addressCountry: 'GB' } } }), page)!;
    expect(j.locations).toEqual(['Leeds, West Yorkshire, GB']);
    expect(j.countryCodes).toEqual(['GB']);
    const o = mapJobPosting(JP({ jobLocation: [{ address: { addressLocality: 'Austin', addressCountry: { name: 'US' } } }] }), page)!;
    expect(o.countryCodes).toEqual(['US']);
  });
  it('treats TELECOMMUTE as remote and keeps the applicant countries', () => {
    const j = mapJobPosting(JP({ jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: [{ '@type': 'Country', name: 'United Kingdom' }] }), page)!;
    expect(j.workMode).toBe('remote');
    expect(j.locations).toEqual(['Remote', 'United Kingdom']);
  });
  it('resolves relative URLs and uses identifier or the URL as the id', () => {
    expect(mapJobPosting(JP({ url: '/careers/de-1', identifier: 'ABC-1' }), page)!).toMatchObject({ applyUrl: 'https://acme.test/careers/de-1', externalId: 'ABC-1' });
    expect(mapJobPosting(JP({ identifier: { value: 77 } }), page)!.externalId).toBe('77');
  });
  it('reads salary only when it is a proper range with a known unit and currency', () => {
    const base = (v: object, cur = 'GBP') => ({ currency: cur, value: { '@type': 'QuantitativeValue', ...v } });
    expect(jsonLdSalary(base({ minValue: 50000, maxValue: 60000, unitText: 'YEAR' }))).toEqual({ min: 50000, max: 60000, currency: 'GBP', period: 'year' });
    expect(jsonLdSalary(base({ minValue: 400, maxValue: 500, unitText: 'DAY' }))).toMatchObject({ period: 'day' });
    expect(jsonLdSalary(base({ value: 55000, unitText: 'YEAR' }))).toBeNull(); // a single figure
    expect(jsonLdSalary(base({ minValue: 50000, maxValue: 60000, unitText: 'WEEK' }))).toBeNull(); // unit we do not handle
    expect(jsonLdSalary(base({ minValue: 50000, maxValue: 60000, unitText: 'YEAR' }, 'JPY'))).toBeNull();
    expect(jsonLdSalary(undefined)).toBeNull();
  });
  it('flows through screen and normalise with verified pay and quoted sponsorship wording', () => {
    const j = mapJobPosting(JP({ baseSalary: { currency: 'GBP', value: { minValue: 60000, maxValue: 75000, unitText: 'YEAR' } }, jobLocation: { address: { addressLocality: 'London', addressCountry: 'GB' } } }), page)!;
    const s = screen(j);
    expect('skip' in s).toBe(false);
    const o = normalise(j, (s as any).family) as any;
    expect(o.role_family).toBe('data');
    expect(o.salary_min).toBe(60000);
    expect(o.provenance.salary.status).toBe('verified');
    expect(o.sponsorship_signal).toBe('offered');
  });
});

describe('json-ld job link discovery', () => {
  const html = `<a href="/jobs/senior-engineer">Senior Engineer</a><a href="/careers/data-analyst-london">Data Analyst</a>
    <a href="/careers/category/engineering">Engineering</a><a href="/blog/careers-advice">Careers advice</a>
    <a href="https://other.test/jobs/x">Elsewhere</a><a href="/careers/apply">Apply</a><a href="mailto:a@b.c">Mail</a>
    <a href="/careers">Careers</a><a href="/about">About</a>`;
  it('returns same-site job-like links and nothing else', () => {
    const l = jobLinks(html, 'https://acme.test/careers');
    expect(l).toEqual(expect.arrayContaining(['https://acme.test/jobs/senior-engineer', 'https://acme.test/careers/data-analyst-london']));
    for (const bad of ['category', 'blog', 'other.test', 'apply', 'mailto', 'about']) expect(l.some((u) => u.includes(bad))).toBe(false);
    expect(l.includes('https://acme.test/careers')).toBe(false);
  });
});

describe('untrusted URLs never become links', () => {
  const base: RawJob = { externalId: '1', title: 'Data Engineer', locations: ['London, UK'], countryCodes: [], applyUrl: 'https://x.test/apply', postedAt: null, department: null, employmentTypeRaw: null, workMode: null, descriptionText: 'x', salary: null };
  it('rejects javascript:, data: and other schemes as an apply link', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:fetch("/profile/export")', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', 'file:///etc/passwd', '//evil.test/x', '', 'not a url']) {
      expect(run({ ...base, applyUrl: bad }), bad).toEqual({ skip: 'no_apply_url' });
    }
  });
  it('keeps normal http and https links, normalised', () => {
    expect((run(base) as any).apply_url).toBe('https://x.test/apply');
    expect((run({ ...base, applyUrl: ' http://x.test/a b ' }) as any).apply_url).toBe('http://x.test/a%20b');
  });
  it('a JobPosting whose url is javascript: cannot get through', () => {
    const j = mapJobPosting({ '@type': 'JobPosting', title: 'Data Engineer', description: 'x', url: 'javascript:alert(document.cookie)', jobLocation: { address: { addressCountry: 'GB' } } }, 'https://acme.test/careers/1')!;
    expect(run(j)).toEqual({ skip: 'no_apply_url' });
  });
});

describe('teamtailor (real Teamtailor RSS feed)', () => {
  const jobs = parseTeamtailorFeed(readFileSync(new URL('./fixtures/teamtailor.rss', import.meta.url), 'utf8'));
  it('reads every item with id, title, link, date and plain-text description', () => {
    expect(jobs.length).toBe(16);
    for (const j of jobs) {
      expect(j.externalId).toBeTruthy();
      expect(j.title).toBeTruthy();
      expect(j.applyUrl).toMatch(/^https:\/\/career\.teamtailor\.com\/jobs\//);
      expect(j.postedAt).toBeInstanceOf(Date);
      expect(j.descriptionText).not.toMatch(/<(p|div|li|strong)\b|&lt;/);
    }
  });
  it('reads locations, countries and work mode; "none" means not stated', () => {
    const uk = jobs.find((j) => j.countryCodes.includes('GB'))!;
    expect(uk.locations[0]).toMatch(/United Kingdom/);
    expect(uk.workMode).toBe('hybrid');
    expect(jobs.some((j) => j.workMode === null)).toBe(true);
    expect(jobs.every((j) => j.workMode !== ('none' as any))).toBe(true);
  });
  it('survives an empty or malformed feed', () => {
    expect(parseTeamtailorFeed('<rss><channel></channel></rss>')).toEqual([]);
    expect(parseTeamtailorFeed('not xml at all')).toEqual([]);
  });
});

describe('bamboohr (real BambooHR data)', () => {
  const list = fx('bamboohr-list').result.map((j: any) => mapBambooHr(j, 'jadeworld'));
  it('maps the list response', () => {
    expect(list.length).toBe(3);
    const j = list.find((x: RawJob) => x.title.startsWith('Full Stack'))!;
    expect(j.externalId).toBe('379');
    expect(j.applyUrl).toBe('https://jadeworld.bamboohr.com/careers/379');
    expect(j.workMode).toBe('hybrid');
    expect(j.locations[0]).toMatch(/Christchurch/);
    expect(j.descriptionText).toBeNull();
  });
  it('does not guess a country it was not told', () => {
    expect(list[0].countryCodes).toEqual([]);
    expect(mapBambooHr({ id: 1, jobOpeningName: 'X', atsLocation: { country: 'United Kingdom', city: 'Leeds' } }, 's').countryCodes).toEqual(['GB']);
  });
  it('detail response carries a description and date', () => {
    const o = fx('bamboohr-detail').result.jobOpening;
    expect(htmlToText(o.description).length).toBeGreaterThan(50);
    expect(o.datePosted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
