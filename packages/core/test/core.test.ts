import { describe, it, expect } from 'vitest';
import { parseTypeAndRating, titleCase, key, classifyName, aggregateRegister } from '../src/index.ts';

describe('parseTypeAndRating', () => {
  it.each([
    ['Worker (A rating)', 'worker', 'A'],
    ['Temporary Worker (A rating)', 'temporary_worker', 'A'],
    ['Worker (B rating)', 'worker', 'B'],
    ['Worker (A (Premium))', 'worker', 'A_PREMIUM'],
    ['Temporary Worker (A (SME+))', 'temporary_worker', 'A_SME_PLUS'],
    ['Worker (UK Expansion Worker: Provisional )', 'worker', 'PROVISIONAL']
  ])('%s', (raw, workerType, rating) => {
    expect(parseTypeAndRating(raw)).toEqual({ workerType, rating });
  });
});

describe('normalisation', () => {
  it('title-cases towns', () => {
    expect(titleCase('  NEWCASTLE upon TYNE ')).toBe('Newcastle upon Tyne');
    expect(titleCase('stoke-on-trent')).toBe('Stoke-On-Trent');
    expect(titleCase('TYNE AND WEAR')).toBe('Tyne and Wear');
  });
  it('builds a whitespace/case/quote-insensitive key', () => {
    expect(key('  "K" Line   Energy ')).toBe(key('k line energy'));
  });
});

describe('classifyName', () => {
  it('tags tech orgs', () => {
    expect(classifyName('Acme Cyber Security Ltd')).toEqual(expect.arrayContaining(['cybersecurity', 'tech']));
    expect(classifyName('Northern Data Analytics Limited')).toEqual(expect.arrayContaining(['data', 'tech']));
    expect(classifyName('Foo AI Labs')).toEqual(expect.arrayContaining(['ai', 'tech']));
  });
  it('does not tag unrelated names as tech', () => {
    expect(classifyName('Maidstone Food and Wine')).not.toContain('tech');
    expect(classifyName('Gurdwara Trust')).toEqual([]);
  });
  it('does not treat "technical" or "maid" as AI/tech', () => {
    expect(classifyName('Maid Services Ltd')).not.toContain('ai');
  });
});

describe('aggregateRegister', () => {
  const row = (name: string, town: string, tr: string, route: string) => ({
    'Organisation Name': name,
    'Town/City': town,
    County: '',
    'Type & Rating': tr,
    Route: route
  });
  it('merges rows per org+town, unions routes, takes best rating', () => {
    const out = aggregateRegister([
      row(' Acme Software Ltd ', ' london ', 'Worker (A rating)', 'Skilled Worker'),
      row('Acme Software Ltd', 'London', 'Temporary Worker (A rating)', 'Creative Worker'),
      row('Acme Software Ltd', 'Leeds', 'Worker (B rating)', 'Skilled Worker')
    ]);
    expect(out).toHaveLength(2);
    const lon = out.find((o) => o.town === 'London')!;
    expect(lon.routes).toEqual(['Creative Worker', 'Skilled Worker']);
    expect(lon.workerTypes.sort()).toEqual(['temporary_worker', 'worker']);
    expect(lon.rating).toBe('A');
    expect(lon.sectorTags).toContain('software');
  });
  it('skips blank names', () => {
    expect(aggregateRegister([row('   ', 'x', 'Worker (A rating)', 'Skilled Worker')])).toHaveLength(0);
  });
});
