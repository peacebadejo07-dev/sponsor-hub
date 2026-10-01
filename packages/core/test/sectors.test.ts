import { describe, it, expect } from 'vitest';
import { deriveSectors, sicEvidence, jobEvidence, sectorsFromText, hasSpecificSic } from '../src/sectors.ts';

const tags = (r: { tags: string[] }) => [...r.tags].sort();

describe('sicEvidence', () => {
  it('maps tech codes and records the code as evidence', () => {
    const e = sicEvidence(['62012']);
    expect(e.map((x) => x.tag)).toEqual(['software', 'tech']);
    expect(e[0].detail).toBe('SIC 62012');
  });
  it('maps the wider set: IT services, hosting, telecoms, electronics, games', () => {
    expect(tags({ tags: sicEvidence(['62020']).map((x) => x.tag) })).toContain('it_services');
    expect(sicEvidence(['63110']).map((x) => x.tag)).toEqual(expect.arrayContaining(['data', 'cloud', 'tech']));
    expect(sicEvidence(['61100']).map((x) => x.tag)).toContain('telecoms');
    expect(sicEvidence(['26110']).map((x) => x.tag)).toContain('electronics');
    expect(sicEvidence(['58210']).map((x) => x.tag)).toContain('games');
  });
  it('treats generic codes as no information', () => {
    for (const c of ['70229', '82990', '64209', '68209', '99999', '74909']) expect(sicEvidence([c])).toEqual([]);
  });
  it('no longer calls R&D "education" and keeps management consultancy out of sectors', () => {
    expect(sicEvidence(['72190']).map((x) => x.tag)).toEqual(['engineering']);
    expect(sicEvidence(['70229'])).toEqual([]);
  });
  it('ignores junk', () => {
    expect(sicEvidence(['', 'abc', '1'])).toEqual([]);
  });
});

describe('deriveSectors order of evidence', () => {
  it('official code beats everything, and website adds specifics', () => {
    const r = deriveSectors({ name: 'Plain Ltd', sic: ['62012'], websiteText: 'We build cybersecurity tools' });
    expect(r.basis).toBe('sic');
    expect(r.tags).toEqual(expect.arrayContaining(['software', 'tech', 'cybersecurity']));
    expect(r.evidence.find((e) => e.tag === 'cybersecurity')!.source).toBe('website');
    expect(r.evidence.find((e) => e.tag === 'software')!.source).toBe('sic');
  });
  it('website text is used when the code is generic', () => {
    const r = deriveSectors({ name: 'Plain Ltd', sic: ['70229'], websiteText: 'AI and machine learning platform' });
    expect(r.basis).toBe('website');
    expect(r.tags).toContain('ai');
  });
  it('live jobs count only with enough roles and only when nothing stronger exists', () => {
    expect(deriveSectors({ name: 'Plain Ltd', jobFamilies: { software: 2 } }).tags).toEqual([]);
    const r = deriveSectors({ name: 'Plain Ltd', jobFamilies: { software: 5, data: 3 } });
    expect(r.basis).toBe('jobs');
    expect(r.tags).toEqual(expect.arrayContaining(['software', 'data', 'tech']));
    expect(r.evidence.find((e) => e.tag === 'software')!.detail).toBe('5 live software roles');
    // a bank that hires engineers stays a bank
    expect(deriveSectors({ name: 'Big Bank plc', sic: ['64191'], jobFamilies: { software: 40 } }).tags).toEqual(['finance']);
  });
  it('the name is the last resort and is labelled as such', () => {
    const r = deriveSectors({ name: 'Acme Software Ltd', sic: ['70229'] });
    expect(r.basis).toBe('name');
    expect(r.evidence.every((e) => e.source === 'name')).toBe(true);
    expect(r.tags).toContain('software');
  });
  it('the name never overrides a specific official code', () => {
    const r = deriveSectors({ name: 'Digital Eats Software Ltd', sic: ['56101'] });
    expect(r.tags).toEqual([]);
    expect(r.basis).toBeNull();
  });
  it('nothing at all means no sector, not a guess', () => {
    expect(deriveSectors({ name: 'J Smith & Sons' })).toEqual({ tags: [], basis: null, evidence: [] });
  });
});

describe('helpers', () => {
  it('hasSpecificSic', () => {
    expect(hasSpecificSic(['56101'])).toBe(true);
    expect(hasSpecificSic(['70229', '99999'])).toBe(false);
    expect(hasSpecificSic([])).toBe(false);
  });
  it('sectorsFromText still needs real tech words', () => {
    expect(sectorsFromText('We sell shoes')).toEqual([]);
    expect(jobEvidence({})).toEqual([]);
  });
});

describe('name fallback ambiguity', () => {
  it('"network" in a care, TV or community name is not telecoms', async () => {
    const { classifyName } = await import('../src/classify.ts');
    expect(classifyName('Leyland Primary Care Network Limited')).not.toContain('telecoms');
    expect(classifyName('Britasia TV Networks Ltd')).not.toContain('telecoms');
    expect(classifyName('Acme Networks Ltd')).toContain('telecoms');
    expect(classifyName('Acme Wireless Care Ltd')).toContain('telecoms');
  });
});
