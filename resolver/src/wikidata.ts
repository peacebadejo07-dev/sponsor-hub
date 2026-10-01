import { fetchPage } from '@sponsored/http';
import { coreName, normaliseText } from './names.ts';

const API = 'https://www.wikidata.org/w/api.php';

export interface WikidataInfo {
  id: string;
  label: string;
  website: string | null;
  employees: number | null;
  industry: string[];
}

async function api(params: Record<string, string>): Promise<any | null> {
  const qs = new URLSearchParams({ format: 'json', origin: '*', ...params });
  const page = await fetchPage(`${API}?${qs}`, { skipRobots: true, accept: 'application/json' });
  if (!page || page.status !== 200) return null;
  try {
    return JSON.parse(page.text);
  } catch {
    return null;
  }
}

export function sizeBand(n: number | null): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n < 10) return '1-9';
  if (n < 50) return '10-49';
  if (n < 250) return '50-249';
  if (n < 1000) return '250-999';
  if (n < 5000) return '1000-4999';
  return '5000+';
}

/** An entity can list several official websites (one per country). Prefer preferred-rank, then a UK domain. */
export function pickWebsite(claims: any[]): string | null {
  const live = claims.filter((c) => c.rank !== 'deprecated' && typeof c.mainsnak?.datavalue?.value === 'string');
  const urls = (cs: any[]) => cs.map((c) => c.mainsnak.datavalue.value as string);
  const preferred = urls(live.filter((c) => c.rank === 'preferred'));
  const all = preferred.length ? preferred : urls(live);
  return all.find((u) => /\.(co\.uk|uk)(\/|$)/i.test(u)) ?? all[0] ?? null;
}

/** Pure: pick the UK company entity out of wbgetentities output. */
export function pickEntity(entities: Record<string, any>, wanted: string): WikidataInfo | null {
  for (const [id, e] of Object.entries<any>(entities ?? {})) {
    const label: string = e.labels?.en?.value ?? '';
    const desc: string = e.descriptions?.en?.value ?? '';
    const website = pickWebsite(e.claims?.P856 ?? []);
    const countries: string[] = (e.claims?.P17 ?? []).map((c: any) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
    const ukish = countries.includes('Q145') || /british|\buk\b|united kingdom|english|scottish|welsh|england/i.test(desc) || /\.(uk|co\.uk)(\/|$)/i.test(website ?? '');
    if (!ukish) continue;
    if (normaliseText(label) !== wanted && !normaliseText(label).startsWith(wanted + ' ')) continue;
    const emp = e.claims?.P1128?.[0]?.mainsnak?.datavalue?.value?.amount;
    const industry: string[] = (e.claims?.P452 ?? []).map((c: any) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
    return { id, label, website, employees: emp ? Math.abs(Number(emp)) : null, industry };
  }
  return null;
}

export async function wikidataLookup(orgName: string): Promise<WikidataInfo | null> {
  const wanted = coreName(orgName).phrase;
  if (wanted.length < 3) return null;
  const search = await api({ action: 'wbsearchentities', search: wanted, language: 'en', type: 'item', limit: '5' });
  const ids: string[] = (search?.search ?? [])
    .filter((r: any) => normaliseText(r.label ?? '') === wanted)
    .map((r: any) => r.id);
  if (!ids.length) return null;
  const ents = await api({ action: 'wbgetentities', ids: ids.join('|'), props: 'claims|labels|descriptions', languages: 'en' });
  const info = pickEntity(ents?.entities, wanted);
  if (!info) return null;
  if (info.industry.length) {
    const labels = await api({ action: 'wbgetentities', ids: info.industry.slice(0, 5).join('|'), props: 'labels', languages: 'en' });
    info.industry = info.industry.map((q) => labels?.entities?.[q]?.labels?.en?.value).filter(Boolean) as string[];
  }
  return info;
}
