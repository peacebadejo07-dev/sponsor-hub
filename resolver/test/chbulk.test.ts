import { describe, it, expect } from 'vitest';
import { BulkMatcher, snapshotFromListing, parseSic, parseUkDate, rowFromRecord, type BulkRow, type OrgRef } from '../src/chbulk.ts';

const row = (o: Partial<BulkRow> & { name: string; number: string }): BulkRow => ({ town: 'LONDON', status: 'Active', incorporated: null, sic: ['62012'], ...o });
const org = (o: Partial<OrgRef> & { nameKey: string; name: string }): OrgRef => ({ towns: ['London'], number: null, ...o });

describe('parsing', () => {
  it('reads SIC codes from the "code - description" text and ignores blanks', () => {
    expect(parseSic(['62012 - Business and domestic software development', '99999 - Dormant Company', '', undefined, 'None Supplied'])).toEqual(['62012', '99999']);
  });
  it('converts UK dates', () => {
    expect(parseUkDate('11/09/2012')).toBe('2012-09-11');
    expect(parseUkDate('')).toBeNull();
  });
  it('builds a row from a trimmed-header record', () => {
    const r = rowFromRecord({ CompanyName: 'ACME LTD', CompanyNumber: '01234567', 'RegAddress.PostTown': 'LEEDS', CompanyStatus: 'Active', IncorporationDate: '01/02/2003', 'SICCode.SicText_1': '62020 - IT consultancy' });
    expect(r).toEqual({ name: 'ACME LTD', number: '01234567', town: 'LEEDS', status: 'Active', incorporated: '2003-02-01', sic: ['62020'] });
    expect(rowFromRecord({ CompanyName: '', CompanyNumber: '1' })).toBeNull();
  });
  it('finds the snapshot date in the listing', () => {
    expect(snapshotFromListing('<a href="BasicCompanyDataAsOneFile-2026-10-01.zip">x</a>')).toBe('2026-10-01');
    expect(snapshotFromListing('nothing')).toBeNull();
  });
});

describe('BulkMatcher', () => {
  const run = (orgs: OrgRef[], rows: BulkRow[]) => {
    const m = new BulkMatcher(orgs);
    rows.forEach((r) => m.offer(r));
    return m.results(orgs);
  };

  it('matches by company number exactly, even when the name differs', () => {
    const r = run([org({ nameKey: 'a', name: 'Old Name Ltd', number: '111' })], [row({ name: 'NEW NAME LIMITED', number: '111', status: 'Dissolved' })]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ nameKey: 'a', by: 'number' });
  });
  it('matches by name and town', () => {
    const r = run([org({ nameKey: 'a', name: 'Acme Software Ltd', towns: ['Leeds'] })], [row({ name: 'ACME SOFTWARE LIMITED', number: '1', town: 'LEEDS' })]);
    expect(r[0]).toMatchObject({ by: 'name_and_town', row: { number: '1' } });
  });
  it('picks the one in the right town when several companies share a name', () => {
    const r = run(
      [org({ nameKey: 'a', name: 'Acme Ltd', towns: ['Leeds'] })],
      [row({ name: 'ACME LTD', number: '1', town: 'BRISTOL' }), row({ name: 'ACME LTD', number: '2', town: 'LEEDS' })]
    );
    expect(r.map((x) => x.row.number)).toEqual(['2']);
  });
  it('refuses to guess when several share the name and none is in the right town', () => {
    const r = run(
      [org({ nameKey: 'a', name: 'Acme Ltd', towns: ['Leeds'] })],
      [row({ name: 'ACME LTD', number: '1', town: 'BRISTOL' }), row({ name: 'ACME LIMITED', number: '2', town: 'YORK' })]
    );
    expect(r).toEqual([]);
  });
  it('accepts a unique exact name registered in another town, labelled as such', () => {
    const r = run([org({ nameKey: 'a', name: 'Acme Software Ltd', towns: ['Leeds'] })], [row({ name: 'ACME SOFTWARE LTD', number: '1', town: 'LONDON' })]);
    expect(r[0]).toMatchObject({ by: 'exact_name' });
  });
  it('does not match a similar but different name registered elsewhere', () => {
    const r = run([org({ nameKey: 'a', name: 'Acme Software Ltd', towns: ['Leeds'] })], [row({ name: 'ACME SOFTWARE LIMITED', number: '1', town: 'LONDON' })]);
    expect(r).toEqual([]); // "Ltd" vs "Limited" differ only in the legal word, but another town + not identical text is not safe
  });
  it('ignores dissolved companies when matching by name', () => {
    const r = run([org({ nameKey: 'a', name: 'Acme Ltd' })], [row({ name: 'ACME LTD', number: '1', status: 'Dissolved' })]);
    expect(r).toEqual([]);
  });
  it('gives each organisation its own match', () => {
    const r = run(
      [org({ nameKey: 'a', name: 'Alpha Ltd' }), org({ nameKey: 'b', name: 'Beta Ltd', towns: ['Leeds'] })],
      [row({ name: 'ALPHA LTD', number: '1' }), row({ name: 'BETA LTD', number: '2', town: 'LEEDS' })]
    );
    expect(r.map((x) => `${x.nameKey}:${x.row.number}`).sort()).toEqual(['a:1', 'b:2']);
  });
});
