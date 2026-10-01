import { fetchPage } from '@sponsored/http';
import { coreName, normaliseText } from './names.ts';
import { sicEvidence, type SectorTag } from '@sponsored/core';

const BASE = 'https://api.company-information.service.gov.uk';

export interface CompanyInfo {
  number: string;
  status: string;
  incorporatedOn: string | null;
  sic: string[];
}

export const sicToTags = (sic: string[]): SectorTag[] => [...new Set(sicEvidence(sic).map((e) => e.tag))];

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
