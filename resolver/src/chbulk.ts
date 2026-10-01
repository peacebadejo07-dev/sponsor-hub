import { coreName, normaliseText } from './names.ts';

/**
 * Companies House publishes every company in one monthly file. We read it once, locally, instead of searching their
 * API per organisation. Matching is by company number when we already have one (exact), otherwise by name and town.
 */

export interface BulkRow {
  name: string;
  number: string;
  town: string;
  status: string;
  incorporated: string | null; // ISO date
  sic: string[]; // bare codes, e.g. "62012"
}

export interface OrgRef {
  nameKey: string;
  name: string;
  towns: string[]; // every town the organisation is licensed in
  number: string | null; // companies house number we already hold
}

export interface Match {
  nameKey: string;
  row: BulkRow;
  by: 'number' | 'name_and_town' | 'exact_name';
}

/** "62012 - Business and domestic software development" to "62012". Anything without a leading code is dropped. */
export function parseSic(texts: (string | undefined)[]): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    const m = (t ?? '').trim().match(/^(\d{4,5})\b/);
    if (m) out.add(m[1]);
  }
  return [...out];
}

/** "11/09/2012" to "2012-09-11". */
export function parseUkDate(s: string | undefined): string | null {
  const m = (s ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function rowFromRecord(r: Record<string, string>): BulkRow | null {
  const name = (r['CompanyName'] ?? '').trim();
  const number = (r['CompanyNumber'] ?? '').trim();
  if (!name || !number) return null;
  return {
    name,
    number,
    town: (r['RegAddress.PostTown'] ?? '').trim(),
    status: (r['CompanyStatus'] ?? '').trim(),
    incorporated: parseUkDate(r['IncorporationDate']),
    sic: parseSic([r['SICCode.SicText_1'], r['SICCode.SicText_2'], r['SICCode.SicText_3'], r['SICCode.SicText_4']])
  };
}

export class BulkMatcher {
  private byNumber = new Map<string, OrgRef>();
  private byPhrase = new Map<string, OrgRef[]>();
  private direct = new Map<string, Match>();
  private candidates = new Map<string, BulkRow[]>(); // nameKey -> rows whose core name matches
  rows = 0;

  constructor(orgs: OrgRef[]) {
    for (const o of orgs) {
      if (o.number) this.byNumber.set(o.number, o);
      else {
        const p = coreName(o.name).phrase;
        if (p) (this.byPhrase.get(p) ?? this.byPhrase.set(p, []).get(p)!).push(o);
      }
    }
  }

  offer(row: BulkRow): void {
    this.rows++;
    const known = this.byNumber.get(row.number);
    if (known) {
      this.direct.set(known.nameKey, { nameKey: known.nameKey, row, by: 'number' });
      return;
    }
    if (row.status !== 'Active') return; // dissolved companies are not sponsors
    const orgs = this.byPhrase.get(coreName(row.name).phrase);
    if (!orgs) return;
    for (const o of orgs) (this.candidates.get(o.nameKey) ?? this.candidates.set(o.nameKey, []).get(o.nameKey)!).push(row);
  }

  /** Decide the name-matched organisations. Number matches were already exact. */
  results(orgs: OrgRef[]): Match[] {
    const out = [...this.direct.values()];
    for (const o of orgs) {
      if (o.number) continue;
      const cands = this.candidates.get(o.nameKey);
      if (!cands?.length) continue;
      const towns = new Set(o.towns.map(normaliseText).filter(Boolean));
      const local = cands.filter((c) => towns.has(normaliseText(c.town)));
      if (local.length === 1) {
        out.push({ nameKey: o.nameKey, row: local[0], by: 'name_and_town' });
        continue;
      }
      if (local.length > 1) {
        // Several companies with the same name in the same town: only an exact full-name match is safe.
        const exact = local.filter((c) => normaliseText(c.name) === normaliseText(o.name));
        if (exact.length === 1) out.push({ nameKey: o.nameKey, row: exact[0], by: 'name_and_town' });
        continue;
      }
      // Registered office in another town (common: head office vs sponsoring site). Accept only a unique, exact name.
      const exact = cands.filter((c) => normaliseText(c.name) === normaliseText(o.name));
      if (exact.length === 1 && cands.length === 1) out.push({ nameKey: o.nameKey, row: exact[0], by: 'exact_name' });
    }
    return out;
  }
}

export function snapshotFromListing(html: string): string | null {
  return html.match(/BasicCompanyDataAsOneFile-(\d{4}-\d{2}-\d{2})\.zip/)?.[1] ?? null;
}
