import { sql } from './db';

export const PAGE_SIZE = 25;

export interface OrgFilters {
  q: string;
  sectors: string[];
  town: string;
  routes: string[];
  ratings: string[];
  page: number;
}

type Skip = 'sector' | 'route' | 'rating';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

function where(f: OrgFilters, skip?: Skip) {
  const conds = [sql`status = 'active'`];
  if (f.q) conds.push(sql`name_key ilike ${'%' + escapeLike(f.q.toLowerCase()) + '%'}`);
  if (f.town) conds.push(sql`town_key like ${escapeLike(f.town.toLowerCase()) + '%'}`);
  if (skip !== 'sector' && f.sectors.length) conds.push(sql`sector_tags && ${sql.array(f.sectors)}::text[]`);
  if (skip !== 'route' && f.routes.length) conds.push(sql`routes && ${sql.array(f.routes)}::text[]`);
  if (skip !== 'rating' && f.ratings.length) conds.push(sql`rating = any(${sql.array(f.ratings)}::text[])`);
  return conds.reduce((a, c) => sql`${a} and ${c}`);
}

export interface OrgRow {
  id: number;
  name: string;
  town: string;
  county: string;
  rating: string;
  routes: string[];
  worker_types: string[];
  sector_tags: string[];
}

export interface Facet {
  value: string;
  count: number;
}

export async function searchOrgs(f: OrgFilters) {
  const w = where(f);
  const [orgs, [{ n }], sectorFacets, routeFacets, ratingFacets] = await Promise.all([
    sql<OrgRow[]>`
      select id, name, town, county, rating, routes, worker_types, sector_tags
      from orgs where ${w}
      order by name_key, id
      limit ${PAGE_SIZE} offset ${(f.page - 1) * PAGE_SIZE}`,
    sql<{ n: number }[]>`select count(*)::int as n from orgs where ${w}`,
    sql<Facet[]>`select t as value, count(*)::int as count from orgs, unnest(sector_tags) t
                 where ${where(f, 'sector')} group by t order by count desc`,
    sql<Facet[]>`select r as value, count(*)::int as count from orgs, unnest(routes) r
                 where ${where(f, 'route')} group by r order by count desc`,
    sql<Facet[]>`select rating as value, count(*)::int as count from orgs
                 where ${where(f, 'rating')} group by rating order by count desc`
  ]);
  return { orgs, total: n, sectorFacets, routeFacets, ratingFacets };
}

let townCache: { at: number; towns: Facet[] } | null = null;
export async function topTowns(): Promise<Facet[]> {
  if (townCache && Date.now() - townCache.at < 10 * 60_000) return townCache.towns;
  const towns = await sql<Facet[]>`
    select min(town) as value, count(*)::int as count from orgs
    where status = 'active' and town <> '' group by town_key
    having count(*) >= 40 order by min(town)`;
  townCache = { at: Date.now(), towns };
  return towns;
}

export async function registerInfo() {
  const [r] = await sql<{ published_on: string; org_count: number; finished_at: string }[]>`
    select published_on::text, org_count, finished_at::text from register_imports
    where finished_at is not null order by published_on desc limit 1`;
  return r ?? null;
}
