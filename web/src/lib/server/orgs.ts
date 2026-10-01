import { sql } from './db';

export const PAGE_SIZE = 25;

export interface OrgFilters {
  q: string;
  sectors: string[];
  town: string;
  routes: string[];
  ratings: string[];
  hasCareers: boolean;
  page: number;
}

type Skip = 'sector' | 'route' | 'rating';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

function where(f: OrgFilters, skip?: Skip) {
  const conds = [sql`status = 'active'`];
  if (f.q) conds.push(sql`name_key ilike ${'%' + escapeLike(f.q.toLowerCase()) + '%'}`);
  if (f.town) conds.push(sql`town_key like ${escapeLike(f.town.toLowerCase()) + '%'}`);
  if (skip !== 'sector' && f.sectors.length) conds.push(sql`all_sector_tags && ${sql.array(f.sectors, 1009)}::text[]`);
  if (skip !== 'route' && f.routes.length) conds.push(sql`routes && ${sql.array(f.routes, 1009)}::text[]`);
  if (skip !== 'rating' && f.ratings.length) conds.push(sql`rating = any(${sql.array(f.ratings, 1009)}::text[])`);
  if (f.hasCareers) conds.push(sql`careers_url is not null`);
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
  all_sector_tags: string[];
  resolve_status: string | null;
  website: string | null;
  website_confidence: number | null;
  careers_url: string | null;
  ats_type: string | null;
}

export interface Facet {
  value: string;
  count: number;
}

export async function searchOrgs(f: OrgFilters) {
  const w = where(f);
  const [orgs, [{ n }], sectorFacets, routeFacets, ratingFacets] = await Promise.all([
    sql<OrgRow[]>`
      select id, name, town, county, rating, routes, worker_types, all_sector_tags, resolve_status, website,
             website_confidence, careers_url, ats_type
      from orgs_enriched where ${w}
      order by name_key, id
      limit ${PAGE_SIZE} offset ${(f.page - 1) * PAGE_SIZE}`,
    sql<{ n: number }[]>`select count(*)::int as n from orgs_enriched where ${w}`,
    sql<Facet[]>`select t as value, count(*)::int as count from orgs_enriched, unnest(all_sector_tags) t
                 where ${where(f, 'sector')} group by t order by count desc`,
    sql<Facet[]>`select r as value, count(*)::int as count from orgs_enriched, unnest(routes) r
                 where ${where(f, 'route')} group by r order by count desc`,
    sql<Facet[]>`select rating as value, count(*)::int as count from orgs_enriched
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

export interface OrgDetail extends OrgRow {
  name_key: string;
  county: string;
  site_title: string | null;
  site_description: string | null;
  wikidata_id: string | null;
  companies_house_no: string | null;
  incorporated_on: string | null;
  sic_codes: string[];
  size_band: string | null;
  industry: string[];
  ats_slug: string | null;
  website_candidate: string | null;
  website_source: string | null;
  sector_basis: 'sic' | 'website' | 'jobs' | 'name' | null;
  sector_evidence: { tag: string; source: 'sic' | 'website' | 'jobs' | 'name'; detail?: string }[];
  provenance: Record<string, { status: string; source: string; confidence?: number; detail?: string; checked_at: string }>;
}

export async function getOrg(id: number) {
  const [org] = await sql<OrgDetail[]>`
    select o.id, o.name, o.name_key, o.town, o.county, o.rating, o.routes, o.worker_types,
           e.all_sector_tags, e.sector_basis, e.sector_evidence,
           p.resolve_status, p.website, p.website_confidence, p.website_source, p.website_candidate,
           p.careers_url, p.ats_type, p.ats_slug, p.site_title, p.site_description, p.wikidata_id,
           p.companies_house_no, p.incorporated_on::text, coalesce(p.sic_codes, '{}') as sic_codes,
           p.size_band, coalesce(p.industry, '{}') as industry, coalesce(p.provenance, '{}'::jsonb) as provenance
    from orgs o
    join orgs_enriched e on e.id = o.id
    left join org_profiles p on p.name_key = o.name_key
    where o.id = ${id}`;
  if (!org) return null;
  const branches = await sql<{ id: number; town: string; county: string; rating: string; routes: string[] }[]>`
    select id, town, county, rating, routes from orgs
    where name_key = ${org.name_key} and status = 'active' order by town limit 50`;
  return { org, branches };
}
