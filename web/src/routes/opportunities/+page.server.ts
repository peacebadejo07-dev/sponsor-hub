import type { PageServerLoad } from './$types';
import { OPP_PAGE_SIZE, searchOpps, topCities, oppSummary, type OppFilters } from '$lib/server/opps';
import { ROLE_FAMILIES } from '@sponsored/core';
import { marksFor } from '@sponsored/accounts';
import { sql } from '$lib/server/db';

const clean = (s: string) => s.replace(/[\u0000-\u001f]/g, '');
const all = (u: URL, k: string) => u.searchParams.getAll(k).map(clean).filter(Boolean).slice(0, 12);
const pick = (vals: string[], allowed: readonly string[]) => vals.filter((v) => allowed.includes(v));

export const load: PageServerLoad = async ({ url, setHeaders, locals }) => {
  const since = Number(url.searchParams.get('since'));
  const f: OppFilters = {
    q: clean(url.searchParams.get('q') ?? '').trim().slice(0, 80),
    families: pick(all(url, 'family'), ROLE_FAMILIES),
    city: clean(url.searchParams.get('city') ?? '').trim().slice(0, 60),
    modes: pick(all(url, 'mode'), ['remote', 'hybrid', 'onsite']),
    employment: pick(all(url, 'emp'), ['full_time', 'part_time', 'contract', 'internship', 'temporary']),
    sponsorship: pick(all(url, 'sponsor'), ['offered', 'not_offered', 'right_to_work', 'unclear', 'unmentioned']),
    seniority: pick(all(url, 'level'), ['entry', 'mid', 'senior', 'lead', 'principal', 'executive']),
    since: [7, 14, 30].includes(since) ? since : 0,
    hasSalary: url.searchParams.get('salary') === '1',
    hideStale: url.searchParams.get('fresh') === '1',
    page: Math.max(1, Math.min(2000, Number(url.searchParams.get('page')) || 1))
  };
  setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=300' });
  const [result, cities, summary] = await Promise.all([searchOpps(f), topCities(), oppSummary()]);
  // Signed-in responses are private (see hooks.server.ts), so per-user marks are safe to include here.
  const marks = locals.user ? Object.fromEntries(await marksFor(sql, locals.user.userId, result.rows.map((r) => r.id))) : {};
  return { filters: f, ...result, cities, summary, loggedIn: !!locals.user, marks, pageSize: OPP_PAGE_SIZE, pages: Math.max(1, Math.ceil(result.total / OPP_PAGE_SIZE)) };
};
