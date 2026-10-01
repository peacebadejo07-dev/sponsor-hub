import type { PageServerLoad } from './$types';
import { PAGE_SIZE, searchOrgs, topTowns, registerInfo, type OrgFilters } from '$lib/server/orgs';
import { SECTOR_LABELS, SECTOR_TAGS } from '@sponsored/core';

// Postgres rejects NUL bytes in text, so strip control characters from every input.
const clean = (s: string) => s.replace(/[\u0000-\u001f]/g, '');
const all = (u: URL, k: string) => u.searchParams.getAll(k).map(clean).filter(Boolean);
const one = (u: URL, k: string) => clean(u.searchParams.get(k) ?? '').trim();

export const load: PageServerLoad = async ({ url, setHeaders }) => {
  const filters: OrgFilters = {
    q: one(url, 'q').slice(0, 80),
    sectors: all(url, 'sector').filter((s) => (SECTOR_TAGS as readonly string[]).includes(s)),
    town: one(url, 'town').slice(0, 60),
    routes: all(url, 'route').slice(0, 20),
    ratings: all(url, 'rating').slice(0, 10),
    page: Math.max(1, Math.min(4000, Number(url.searchParams.get('page')) || 1))
  };
  setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=300' });
  const [result, towns, register] = await Promise.all([searchOrgs(filters), topTowns(), registerInfo()]);
  return {
    filters,
    ...result,
    towns,
    register,
    pageSize: PAGE_SIZE,
    pages: Math.max(1, Math.ceil(result.total / PAGE_SIZE)),
    sectorLabels: SECTOR_LABELS
  };
};
