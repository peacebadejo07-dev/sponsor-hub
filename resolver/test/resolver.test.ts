import { describe, it, expect } from 'vitest';
import { coreName, domainCandidates, verifyHomepage } from '../src/names.ts';
import { detectAts, extractCareersLinks } from '../src/ats.ts';
import { pickEntity, pickWebsite, sizeBand } from '../src/wikidata.ts';
import { pickCompany, sicToTags } from '../src/companieshouse.ts';
import { isPrivateIp } from '@sponsored/http';
import { sectorsFromText } from '../src/resolve.ts';

describe('coreName', () => {
  it('strips legal and geographic suffixes', () => {
    expect(coreName('Bluecube Cyber Security Solutions Limited').phrase).toBe('bluecube cyber security solutions');
    expect(coreName('Acme Software (UK) Ltd').phrase).toBe('acme software');
    expect(coreName('Smith & Jones Holdings plc').phrase).toBe('smith jones');
  });
  it('uses the trading name', () => {
    expect(coreName('MRS A SMITH T/A Maidstone Food And Wine').phrase).toBe('maidstone food wine');
  });
});

describe('coreName: foreign legal forms and branch locations are not part of the name', () => {
  it.each([
    ['Renesas Electronics Europe GmbH', 'renesas electronics'],
    ['Covasant Technologies (UK) Private Limited', 'covasant technologies'],
    ['Christie Digital Systems Canada Inc.', 'christie digital systems'],
    ['Motherson Technology Services United Kingdom Limited', 'motherson technology services'],
    ['Acme B.V.', 'acme b v'],
    ['Foo Pty Ltd', 'foo pty'],
    // where the "suffix" word IS the name, it stays
    ['Software AG (UK) Limited', 'software ag'],
    ['AG Technologies LTD', 'ag technologies'],
    ['Kingdom Technologies Ltd', 'kingdom technologies'],
    ['Kingdom Advance Network', 'kingdom advance network'],
    ['Pacific Green Technologies (UK) Limited', 'pacific green technologies'],
    ['Quantum Pacific (UK) LLP', 'quantum pacific']
  ])('%s', (name, phrase) => {
    expect(coreName(name).phrase).toBe(phrase);
  });
});

describe('domainCandidates', () => {
  it('puts the full joined name before the brand alone', () => {
    const c = domainCandidates('Acme Software Ltd');
    expect(c[0]).toBe('acmesoftware.co.uk');
    expect(c).toContain('acme.com');
  });
  it('is bounded', () => {
    expect(domainCandidates('A Very Long Organisation Name Indeed Limited').length).toBeLessThanOrEqual(16);
  });
});

const page = (title: string, body: string, head = '') =>
  `<html><head><title>${title}</title>${head}</head><body><h1>${title}</h1><p>${body}</p></body></html>`;
const LONG = 'We build secure software for customers across the United Kingdom and beyond. '.repeat(3);

describe('verifyHomepage', () => {
  const org = { name: 'Acme Software Limited', town: 'Leeds' };
  it('accepts a page naming the organisation with a UK signal', () => {
    const v = verifyHomepage(page('Acme Software | Secure apps', LONG), 'https://acmesoftware.co.uk/', org);
    expect(v.confidence).toBeGreaterThanOrEqual(0.85);
  });
  it('rejects parked domains', () => {
    const v = verifyHomepage(page('acmesoftware.com', 'This domain is for sale. ' + LONG), 'https://acmesoftware.com/', org);
    expect(v.confidence).toBe(0);
  });
  it('gives no confidence to an unrelated company', () => {
    const v = verifyHomepage(page('Zeta Bakery', LONG), 'https://acme.com/', org);
    expect(v.confidence).toBe(0);
  });
  it('caps generic single-word names', () => {
    const v = verifyHomepage(page('Delta Air Lines', LONG), 'https://delta.com/', { name: 'Delta Limited', town: 'Leeds' });
    expect(v.confidence).toBeLessThan(0.7);
  });
  it('caps matches with no UK signal', () => {
    const body = 'We build secure software for customers worldwide. '.repeat(4);
    const v = verifyHomepage(page('Acme Software', body), 'https://acmesoftware.com/', org);
    expect(v.confidence).toBeLessThanOrEqual(0.7);
  });
});

describe('verifyHomepage: brand-only matches', () => {
  it('rejects a short brand shared with an unrelated company (Epic Games vs epic.com)', () => {
    const v = verifyHomepage(page('Epic | Healthcare software', LONG), 'https://www.epic.com/', { name: 'Epic Games UK ltd' });
    expect(v.confidence).toBeLessThan(0.6);
  });
  it('rejects a common word domain (smart.co.uk)', () => {
    const v = verifyHomepage(page('Smart | Cleaning supplies', LONG), 'https://smart.co.uk/', { name: 'Smart Manufacturing Technology Ltd' });
    expect(v.confidence).toBeLessThan(0.6);
  });
  it('accepts a long distinctive brand (worldline)', () => {
    const v = verifyHomepage(page('Worldline | Payments', LONG), 'https://worldline.com/', { name: 'Worldline IT Services UK Limited' });
    expect(v.confidence).toBeGreaterThanOrEqual(0.6);
  });
});

describe('brand-only corroboration', () => {
  it('rejects a same-brand company in a different field (Bluecube cyber vs Bluecube AI)', () => {
    const v = verifyHomepage(page('Bluecube | Artificial intelligence for retail', LONG), 'https://bluecube.ai/', { name: 'Bluecube Cyber Security Solutions Limited' });
    expect(v.confidence).toBeLessThan(0.6);
  });
  it('accepts when another word from the name appears on the page', () => {
    const v = verifyHomepage(page('Worldline | Payments', LONG + ' Our IT services power payments.'), 'https://worldline.com/', { name: 'Worldline IT Services UK Limited' });
    expect(v.confidence).toBeGreaterThanOrEqual(0.6);
  });
});

describe('short distinguishing words are not ignored (the Clarity AI / clarity.io failure)', () => {
  it('rejects an air-quality company for "Clarity AI"', () => {
    const v = verifyHomepage(page('Clarity: Low-Cost Air Quality Monitoring & Measurement Solutions', LONG + ' Air quality sensors for cities.'), 'https://www.clarity.io/', { name: 'Clarity AI Ltd', town: 'London' });
    expect(v.confidence).toBeLessThan(0.6);
  });
  it('accepts the right site, which does mention AI', () => {
    const v = verifyHomepage(page('Clarity | Sustainability technology', LONG + ' Our AI platform measures impact.'), 'https://clarity.ai/', { name: 'Clarity AI Ltd', town: 'London' });
    expect(v.confidence).toBeGreaterThanOrEqual(0.6);
  });
  it('everyday words like "it" prove nothing, so they are not required', () => {
    const v = verifyHomepage(page('Worldline | Payments', LONG + ' Payment services.'), 'https://worldline.com/', { name: 'Worldline IT Services UK Limited' });
    expect(v.confidence).toBeGreaterThanOrEqual(0.6);
  });
});

describe('generic words do not corroborate a distinctive name', () => {
  it('rejects elastic.io for "Elastic Path Software" even though the page says "software"', () => {
    const v = verifyHomepage(page('Elastic | The Search AI Company', LONG + ' Build search software.'), 'https://elastic.io/', { name: 'Elastic Path Software (UK) Ltd' });
    expect(v.confidence).toBeLessThan(0.6);
  });
  it('still accepts the right site, where the distinctive word is present', () => {
    const v = verifyHomepage(page('Elastic Path | Composable commerce', LONG), 'https://elasticpath.com/', { name: 'Elastic Path Software (UK) Ltd' });
    expect(v.confidence).toBeGreaterThanOrEqual(0.6);
  });
});

describe('generic brand words', () => {
  it('rejects technology.io for "Technology Expert International"', () => {
    const v = verifyHomepage(page('Technology | Domain portfolio', LONG), 'https://technology.io/', { name: 'Technology Expert International Limited' });
    expect(v.confidence).toBeLessThan(0.6);
  });
});

describe('detectAts', () => {
  it.each([
    ['<a href="https://boards.greenhouse.io/monzo">Jobs</a>', 'greenhouse', 'monzo'],
    ['<iframe src="https://job-boards.greenhouse.io/embed/job_board?for=acme"></iframe>', 'greenhouse', 'acme'],
    ['https://jobs.lever.co/palantir/abc-123', 'lever', 'palantir'],
    ['https://jobs.ashbyhq.com/ramp', 'ashby', 'ramp'],
    ['https://apply.workable.com/acme-ltd/', 'workable', 'acme-ltd'],
    ['https://careers.smartrecruiters.com/Visa', 'smartrecruiters', 'Visa'],
    ['https://acme.teamtailor.com/jobs', 'teamtailor', 'acme'],
    ['https://arcticwolf.wd1.myworkdayjobs.com/External', 'workday', 'arcticwolf.wd1/External'],
    ['https://alfa.wd3.myworkdayjobs.com/en-US/Alfa/job/UK-London/x_R1', 'workday', 'alfa.wd3/Alfa']
  ])('%s', (h, ats, slug) => {
    expect(detectAts(h)).toMatchObject({ ats, slug });
  });
  it('ignores reserved slugs and unrelated pages', () => {
    expect(detectAts('https://boards.greenhouse.io/embed/')).toBeNull();
    expect(detectAts('<a href="https://example.com/careers">x</a>')).toBeNull();
  });
});

describe('extractCareersLinks', () => {
  const html = `<nav><a href="/about">About</a><a href="/careers">Careers</a><a href="/blog/careers-advice">Blog</a>
    <a href="https://other.com/jobs">Elsewhere</a><a href="https://boards.greenhouse.io/acme">Open roles</a>
    <a href="/privacy">Privacy</a><a href="/team">Join the team</a></nav>`;
  it('returns same-site careers links and ATS links, best first, without noise', () => {
    const l = extractCareersLinks(html, 'https://www.acme.com/');
    expect(l[0]).toBe('https://boards.greenhouse.io/acme');
    expect(l).toContain('https://www.acme.com/careers');
    expect(l.some((u) => u.includes('other.com'))).toBe(false);
    expect(l.some((u) => u.includes('/blog'))).toBe(false);
    expect(l.some((u) => u.includes('privacy'))).toBe(false);
  });
});

describe('wikidata', () => {
  const ent = {
    Q1: {
      labels: { en: { value: 'Monzo' } },
      descriptions: { en: { value: 'British digital bank' } },
      claims: {
        P856: [{ mainsnak: { datavalue: { value: 'https://monzo.com' } } }],
        P17: [{ mainsnak: { datavalue: { value: { id: 'Q145' } } } }],
        P1128: [{ mainsnak: { datavalue: { value: { amount: '+3000' } } } }]
      }
    },
    Q2: { labels: { en: { value: 'Monzo' } }, descriptions: { en: { value: 'village in Italy' } }, claims: { P17: [{ mainsnak: { datavalue: { value: { id: 'Q38' } } } }] } }
  };
  it('picks the UK entity and reads the website and size', () => {
    const e = pickEntity(ent, 'monzo');
    expect(e).toMatchObject({ id: 'Q1', website: 'https://monzo.com', employees: 3000 });
  });
  it('prefers a UK site when several official websites exist', () => {
    const c = (v: string, rank = 'normal') => ({ rank, mainsnak: { datavalue: { value: v } } });
    expect(pickWebsite([c('https://deliveroo.it'), c('https://deliveroo.co.uk'), c('https://deliveroo.fr')])).toBe('https://deliveroo.co.uk');
    expect(pickWebsite([c('https://a.com'), c('https://b.com', 'preferred')])).toBe('https://b.com');
    expect(pickWebsite([c('https://old.uk', 'deprecated')])).toBeNull();
  });
  it('rejects non-UK entities', () => {
    expect(pickEntity({ Q2: ent.Q2 }, 'monzo')).toBeNull();
  });
  it('buckets headcount', () => {
    expect([sizeBand(5), sizeBand(60), sizeBand(300), sizeBand(2000), sizeBand(9000), sizeBand(null)]).toEqual(['1-9', '50-249', '250-999', '1000-4999', '5000+', null]);
  });
});

describe('companies house', () => {
  it('matches by exact core name, active, preferring the local town', () => {
    const items = [
      { title: 'ACME SOFTWARE LIMITED', company_number: '1', company_status: 'active', address: { locality: 'London' } },
      { title: 'ACME SOFTWARE LTD', company_number: '2', company_status: 'active', address: { locality: 'Leeds' } },
      { title: 'ACME SOFTWARE HOLDINGS', company_number: '3', company_status: 'dissolved', address: { locality: 'Leeds' } },
      { title: 'ACME SOFTWARE SOLUTIONS LTD', company_number: '4', company_status: 'active', address: { locality: 'Leeds' } }
    ];
    expect(pickCompany(items, 'Acme Software Limited', 'Leeds')?.number).toBe('2');
    expect(pickCompany(items, 'Nobody Limited')).toBeNull();
  });
  it('maps SIC codes to sector tags', () => {
    expect(sicToTags(['62012'])).toEqual(expect.arrayContaining(['software', 'tech']));
    expect(sicToTags(['64191'])).toEqual(['finance']);
  });
});

describe('safety and text sectors', () => {
  it('flags private addresses', () => {
    for (const ip of ['10.0.0.1', '127.0.0.1', '192.168.1.5', '172.16.0.1', '169.254.1.1', '::1']) expect(isPrivateIp(ip)).toBe(true);
    for (const ip of ['8.8.8.8', '141.101.90.96', '172.32.0.1']) expect(isPrivateIp(ip)).toBe(false);
  });
  it('derives sectors from site text, not noisy words', () => {
    expect(sectorsFromText('Cloud security platform for developers')).toEqual(expect.arrayContaining(['cloud', 'tech']));
    expect(sectorsFromText('Our online shop for flowers')).toEqual([]);
  });
});

import { slugCandidates, boardNameMatches, textMentionsOrg } from '../src/probe.ts';

describe('board probing: slug candidates', () => {
  it('puts the website label first, then name variants, without duplicates', () => {
    expect(slugCandidates({ name: 'Monzo Bank Ltd', website: 'https://monzo.com' })).toEqual(['monzo', 'monzobank', 'monzo-bank']);
  });
  it('works from the name alone and drops unusable slugs', () => {
    const c = slugCandidates({ name: 'Acme Software Limited' });
    expect(c[0]).toBe('acmesoftware');
    expect(c).toContain('acme');
    expect(slugCandidates({ name: '1 AB Ltd' }).every((s) => /^[a-z0-9][a-z0-9-]{2,40}$/.test(s))).toBe(true);
  });
});

describe('board probing: does a board belong to the organisation?', () => {
  it('matches the company name on the board', () => {
    expect(boardNameMatches('Monzo', { name: 'Monzo Bank Ltd', website: 'https://monzo.com', websiteConfidence: 0.9 })).toBe(true);
    expect(boardNameMatches('Monzo', { name: 'Monzo Bank Ltd' })).toBe(false); // prefix match, nothing corroborates it
    expect(boardNameMatches('Wise', { name: 'Wise Payments Limited', website: 'https://wise.com', websiteConfidence: 0.9 })).toBe(true);
    expect(boardNameMatches('Acme Software', { name: 'Acme Software Limited' })).toBe(true);
  });
  it('needs corroboration when the board name is only the start of the organisation name', () => {
    // "Abacus" is shared by many unrelated companies.
    expect(boardNameMatches('ABACUS', { name: 'Abacus Information Technology UK Limited' })).toBe(false);
    expect(boardNameMatches('ABACUS', { name: 'Abacus Information Technology UK Limited', website: 'https://www.abacusit.co.uk', websiteConfidence: 0.9 })).toBe(false);
    expect(boardNameMatches('ABACUS', { name: 'Abacus Information Technology UK Limited', website: 'https://abacus.com', websiteConfidence: 0.9 })).toBe(true);
    // Even a long word is not enough on its own: "Atlantis" and "Blueprint" are ordinary words.
    expect(boardNameMatches('Atlantis', { name: 'Atlantis Technology Solutions Limited' })).toBe(false);
    expect(boardNameMatches('Blueprint', { name: 'Blueprint Technologies Limited' })).toBe(false);
    expect(boardNameMatches('Darktrace', { name: 'Darktrace Holdings Limited', website: 'https://www.darktrace.com', websiteConfidence: 0.9 })).toBe(true);
    expect(boardNameMatches('accesso', { name: 'accesso Technology Group', website: 'https://accesso.com', websiteConfidence: 0.9 })).toBe(true);
  });
  it('rejects different companies, including look-alikes', () => {
    expect(boardNameMatches('Monzo Foods', { name: 'Monzo Bank Ltd' })).toBe(false); // same first word, different company
    expect(boardNameMatches('Zeta Bakery', { name: 'Monzo Bank Ltd' })).toBe(false);
    expect(boardNameMatches('Monz', { name: 'Monzo Bank Ltd' })).toBe(false);
    expect(boardNameMatches(null, { name: 'Monzo Bank Ltd' })).toBe(false);
  });
  it('does not accept a name made only of generic words without a matching website', () => {
    expect(boardNameMatches('AI TECH', { name: 'AI Tech Ltd' })).toBe(false);
    expect(boardNameMatches('AI TECH', { name: 'AI Tech Ltd', website: 'https://aitech.co.uk', websiteConfidence: 0.9 })).toBe(true);
  });
  it('does not accept a bare generic word without a matching website', () => {
    expect(boardNameMatches('Delta', { name: 'Delta Limited' })).toBe(false);
    expect(boardNameMatches('Delta', { name: 'Delta Limited', website: 'https://delta.co.uk', websiteConfidence: 0.9 })).toBe(true);
    expect(boardNameMatches('Delta', { name: 'Delta Limited', website: 'https://deltaairlines.com', websiteConfidence: 0.9 })).toBe(false);
  });
});

describe('a weak website cannot vouch for a board (the Elastic Path / elastic.io failure)', () => {
  it('rejects a board that shares only the first word when the website match was a weak guess', () => {
    const weak = { name: 'Elastic Path Software (UK) Ltd', website: 'https://elastic.io', websiteConfidence: 0.65 };
    expect(boardNameMatches('Elastic', weak)).toBe(false);
    expect(boardNameMatches('Elastic', { ...weak, websiteConfidence: undefined })).toBe(false);
    expect(textMentionsOrg(['Join Genesis today'], { name: 'Genesis Technology Services Limited', website: 'https://genesis.com', websiteConfidence: 0.7 })).toBe(false);
  });
  it('still accepts when the website itself is well verified', () => {
    expect(boardNameMatches('Neo4j', { name: 'Neo4j Technology Limited', website: 'https://neo4j.com', websiteConfidence: 0.85 })).toBe(true);
  });
  it('an exact board-name match does not need the website at all', () => {
    expect(boardNameMatches('Monzo', { name: 'Monzo' })).toBe(true);
  });
});

describe('board probing: job text must name the organisation (Lever / Ashby)', () => {
  it('accepts text that names the organisation', () => {
    expect(textMentionsOrg(['About Acme Software: we build tools'], { name: 'Acme Software Ltd' })).toBe(true);
  });
  it('rejects text about someone else', () => {
    expect(textMentionsOrg(['About Zeta Bakery: we bake bread'], { name: 'Acme Software Ltd' })).toBe(false);
  });
  it('accepts a distinctive brand only when the domain agrees', () => {
    const t = ['Join Worldline today'];
    expect(textMentionsOrg(t, { name: 'Worldline IT Services UK Limited', website: 'https://worldline.com', websiteConfidence: 0.9 })).toBe(true);
    expect(textMentionsOrg(t, { name: 'Worldline IT Services UK Limited' })).toBe(false);
  });
});

describe('detectAts platform hosts', () => {
  it('does not treat the vendor\'s own subdomains as an employer board', () => {
    expect(detectAts('https://app.teamtailor.com/login')).toBeNull();
    expect(detectAts('https://career.teamtailor.com/jobs')).toBeNull();
    expect(detectAts('https://acme.teamtailor.com/jobs')).toMatchObject({ ats: 'teamtailor', slug: 'acme' });
  });
});
