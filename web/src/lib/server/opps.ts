import { sql } from './db';

export const OPP_PAGE_SIZE = 20;

export interface OppFilters {
  q: string;
  families: string[];
  city: string;
  modes: string[];
  employment: string[];
  sponsorship: string[];
  seniority: string[];
  since: number; // 0 = any, else days
  hasSalary: boolean;
  hideStale: boolean;
  page: number;
}

type Skip = 'family' | 'mode' | 'employment' | 'sponsorship' | 'seniority';
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

function where(f: OppFilters, skip?: Skip) {
  const c = [sql`status = 'live'`];
  if (f.q) {
    const like = '%' + escapeLike(f.q.toLowerCase()) + '%';
    c.push(sql`(lower(title) like ${like} or lower(org_name) like ${like})`);
  }
  if (f.city) c.push(sql`(city ilike ${escapeLike(f.city) + '%'} or location_raw ilike ${'%' + escapeLike(f.city) + '%'})`);
  if (skip !== 'family' && f.families.length) c.push(sql`role_family = any(${sql.array(f.families)}::text[])`);
  if (skip !== 'employment' && f.employment.length) c.push(sql`employment_type = any(${sql.array(f.employment)}::text[])`);
  if (skip !== 'sponsorship' && f.sponsorship.length) c.push(sql`sponsorship_signal = any(${sql.array(f.sponsorship)}::text[])`);
  if (skip !== 'seniority' && f.seniority.length) c.push(sql`seniority = any(${sql.array(f.seniority)}::text[])`);
  if (skip !== 'mode' && f.modes.length) {
    // "Remote or office" jobs satisfy both a remote and a hybrid/onsite search.
    const want = new Set<string>();
    for (const m of f.modes) {
      want.add(m);
      if (m === 'remote' || m === 'hybrid' || m === 'onsite') want.add('flexible');
    }
    c.push(sql`work_mode = any(${sql.array([...want])}::text[])`);
  }
  if (f.since > 0) c.push(sql`(first_seen_at > now() - make_interval(days => ${f.since}) or changed_at > now() - make_interval(days => ${f.since}))`);
  if (f.hasSalary) c.push(sql`salary_min is not null`);
  if (f.hideStale) c.push(sql`stale_reason is null`);
  return c.reduce((a, x) => sql`${a} and ${x}`);
}

export interface OppRow {
  id: number;
  org_id: number;
  org_name: string;
  title: string;
  role_family: string;
  seniority: string | null;
  location_raw: string;
  city: string | null;
  work_mode: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  skills: string[];
  apply_url: string;
  sponsorship_signal: string;
  sponsorship_snippet: string | null;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  changed_at: string | null;
  stale_reason: string | null;
  provenance: Record<string, { status: string; source: string; detail?: string }>;
}

export interface Facet {
  value: string;
  count: number;
}

export async function searchOpps(f: OppFilters) {
  const w = where(f);
  const col = (name: string, skip: Skip) =>
    sql<Facet[]>`select ${sql(name)} as value, count(*)::int as count from opportunities_view
                 where ${where(f, skip)} and ${sql(name)} is not null group by 1 order by 2 desc`;
  const [rows, [{ n }], family, mode, employment, sponsorship, seniority] = await Promise.all([
    sql<OppRow[]>`
      select id, org_id, org_name, title, role_family, seniority, location_raw, city, work_mode, employment_type,
             salary_min, salary_max, salary_currency, salary_period, skills, apply_url, sponsorship_signal, sponsorship_snippet,
             posted_at, first_seen_at, last_seen_at, changed_at, stale_reason, provenance
      from opportunities_view where ${w}
      order by coalesce(posted_at, first_seen_at) desc, id desc
      limit ${OPP_PAGE_SIZE} offset ${(f.page - 1) * OPP_PAGE_SIZE}`,
    sql<{ n: number }[]>`select count(*)::int as n from opportunities_view where ${w}`,
    col('role_family', 'family'),
    col('work_mode', 'mode'),
    col('employment_type', 'employment'),
    col('sponsorship_signal', 'sponsorship'),
    col('seniority', 'seniority')
  ]);
  return { rows, total: n, facets: { family, mode, employment, sponsorship, seniority } };
}

let cityCache: { at: number; cities: Facet[] } | null = null;
export async function topCities(): Promise<Facet[]> {
  if (cityCache && Date.now() - cityCache.at < 10 * 60_000) return cityCache.cities;
  const cities = await sql<Facet[]>`
    select city as value, count(*)::int as count from opportunities where status = 'live' and city is not null
    group by city order by count desc limit 40`;
  cityCache = { at: Date.now(), cities };
  return cities;
}

export async function oppSummary() {
  const [r] = await sql<{ live: number; orgs: number; last: string | null }[]>`
    select count(*)::int as live, count(distinct name_key)::int as orgs, max(last_seen_at)::text as last
    from opportunities where status = 'live'`;
  return r;
}
