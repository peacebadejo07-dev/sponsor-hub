import { fetchPage } from './http.ts';
import { coreName, normaliseText } from './names.ts';
import type { SectorTag } from '@sponsored/core';

const BASE = 'https://api.company-information.service.gov.uk';

export interface CompanyInfo {
  number: string;
  status: string;
  incorporatedOn: string | null;
  sic: string[];
}

export function sicToTags(sic: string[]): SectorTag[] {
  const t = new Set<SectorTag>();
  for (const code of sic) {
    const c2 = code.slice(0, 2);
    const c4 = code.slice(0, 4);
    if (c2 === '62') ['software', 'it_services', 'tech'].forEach((x) => t.add(x as SectorTag));
    else if (c4 === '5821') ['games', 'tech'].forEach((x) => t.add(x as SectorTag));
    else if (c4 === '5829') ['software', 'tech'].forEach((x) => t.add(x as SectorTag));
    else if (c2 === '63') ['data', 'tech'].forEach((x) => t.add(x as SectorTag));
    else if (c2 === '61') ['telecoms', 'tech'].forEach((x) => t.add(x as SectorTag));
    else if (c2 === '26') ['electronics', 'tech'].forEach((x) => t.add(x as SectorTag));
    else if (c4 === '7410') t.add('design');
    else if (c4 === '7022') t.add('consulting');
    else if (c2 === '64' || c2 === '65' || c2 === '66') t.add('finance');
    else if (c2 === '86' || c2 === '21') t.add('healthcare');
    else if (c2 === '85' || c2 === '72') t.add('education');
    else if (c2 === '71') t.add('engineering');
  }
  return [...t];
}

/** Pure: choose the matching active company from search results. */
export function pickCompany(items: any[], orgName: string, town?: string): { number: string; title: string } | null {
  const wanted = coreName(orgName).phrase;
  const matches = (items ?? []).filter(
    (i) => i.company_status === 'active' && coreName(i.title ?? '').phrase === wanted
  );
  if (!matches.length) return null;
  const t = normaliseText(town ?? '');
  const local = matches.find((m) => t && normaliseText(m.address?.locality ?? '') === t);
  const pick = local ?? matches[0];
  return { number: pick.company_number, title: pick.title };
}

export async function companiesHouseLookup(orgName: string, town: string | undefined, key: string): Promise<CompanyInfo | null> {
  const auth = 'Basic ' + Buffer.from(`${key}:`).toString('base64');
  const get = async (path: string) => {
    const page = await fetchPage(`${BASE}${path}`, { skipRobots: true, accept: 'application/json' }, { authorization: auth });
    if (!page || page.status !== 200) return null;
    try {
      return JSON.parse(page.text);
    } catch {
      return null;
    }
  };
  const q = coreName(orgName).phrase;
  const search = await get(`/search/companies?q=${encodeURIComponent(q)}&items_per_page=8`);
  const pick = pickCompany(search?.items ?? [], orgName, town);
  if (!pick) return null;
  const c = await get(`/company/${pick.number}`);
  if (!c) return null;
  return { number: pick.number, status: c.company_status ?? 'unknown', incorporatedOn: c.date_of_creation ?? null, sic: c.sic_codes ?? [] };
}
