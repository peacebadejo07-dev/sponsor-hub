import postgres from 'postgres';
import { resolveOrg, type ProfileResult } from './resolve.ts';
import { sizeBand } from './wikidata.ts';

const args = process.argv.slice(2);
const opt = (n: string, d?: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const flag = (n: string) => args.includes(`--${n}`);

const limit = Number(opt('limit', '50'));
const tag = opt('tag', 'tech')!;
const concurrency = Number(opt('concurrency', '6'));
const nameLike = opt('name');
const retry = flag('retry');
const dryRun = flag('dry-run');
const chKey = process.env.COMPANIES_HOUSE_API_KEY;

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/sponsored', { max: 4, onnotice: () => {} });

interface Target { name_key: string; name: string; town: string; county: string; branches: number }

async function pickTargets(): Promise<Target[]> {
  return sql<Target[]>`
    select o.name_key, (array_agg(o.name order by o.id))[1] as name, (array_agg(o.town order by o.id))[1] as town,
           (array_agg(o.county order by o.id))[1] as county, count(*)::int as branches
    from orgs o left join org_profiles p on p.name_key = o.name_key
    where o.status = 'active'
      and ${nameLike ? sql`o.name_key like ${'%' + nameLike.toLowerCase() + '%'}` : sql`${tag} = any(o.sector_tags)`}
      and (p.name_key is null
           or (${retry} and p.resolve_status in ('not_found', 'error') and p.updated_at < now() - interval '30 days'))
    group by o.name_key
    order by count(*) desc, o.name_key
    limit ${limit}`;
}

async function save(t: Target, r: ProfileResult | null, error?: string) {
  if (dryRun) return;
  const p = r;
  await sql`
    insert into org_profiles (name_key, resolve_status, website, website_confidence, website_source, website_candidate,
      careers_url, ats_type, ats_slug, wikidata_id, companies_house_no, ch_status, incorporated_on, sic_codes,
      size_band, industry, sector_tags, site_title, site_description, provenance, attempts, last_error, resolved_at)
    values (${t.name_key}, ${p ? p.status : 'error'}, ${p?.website ?? null}, ${p?.websiteConfidence ?? null}, ${p?.websiteSource ?? null},
      ${p?.websiteCandidate ?? null}, ${p?.careersUrl ?? null}, ${p?.ats?.ats ?? null}, ${p?.ats?.slug ?? null},
      ${p?.wikidata?.id ?? null}, ${p?.company?.number ?? null}, ${p?.company?.status ?? null}, ${p?.company?.incorporatedOn ?? null},
      ${sql.array(p?.company?.sic ?? [])}, ${p ? sizeBand(p.wikidata?.employees ?? null) : null}, ${sql.array(p?.wikidata?.industry ?? [])},
      ${sql.array(p?.sectorTags ?? [])}, ${p?.siteTitle ?? null}, ${p?.siteDescription ?? null},
      ${sql.json((p?.provenance ?? {}) as any)}, 1, ${error ?? null}, ${p?.status === 'resolved' ? sql`now()` : null})
    on conflict (name_key) do update set
      resolve_status = excluded.resolve_status, website = excluded.website, website_confidence = excluded.website_confidence,
      website_source = excluded.website_source, website_candidate = excluded.website_candidate, careers_url = excluded.careers_url,
      ats_type = excluded.ats_type, ats_slug = excluded.ats_slug, wikidata_id = excluded.wikidata_id,
      companies_house_no = excluded.companies_house_no, ch_status = excluded.ch_status, incorporated_on = excluded.incorporated_on,
      sic_codes = excluded.sic_codes, size_band = excluded.size_band, industry = excluded.industry,
      sector_tags = excluded.sector_tags, site_title = excluded.site_title, site_description = excluded.site_description,
      provenance = excluded.provenance, attempts = org_profiles.attempts + 1, last_error = excluded.last_error,
      resolved_at = excluded.resolved_at, updated_at = now()`;
}

const targets = await pickTargets();
console.log(`Resolving ${targets.length} organisations (tag=${nameLike ? `name~${nameLike}` : tag}, concurrency=${concurrency}${chKey ? ', Companies House on' : ', Companies House off'}${dryRun ? ', dry-run' : ''})`);

const stats = { resolved: 0, candidate: 0, not_found: 0, error: 0, careers: 0, ats: 0 } as Record<string, number>;
const atsCounts: Record<string, number> = {};
let done = 0;
let next = 0;

async function worker() {
  while (next < targets.length) {
    const t = targets[next++];
    try {
      const r = await resolveOrg({ name: t.name, town: t.town, county: t.county }, { companiesHouseKey: chKey });
      stats[r.status]++;
      if (r.careersUrl) stats.careers++;
      if (r.ats) {
        stats.ats++;
        atsCounts[r.ats.ats] = (atsCounts[r.ats.ats] ?? 0) + 1;
      }
      await save(t, r);
      if (flag('verbose') || r.status === 'resolved')
        console.log(`  [${r.status}] ${t.name} -> ${r.website ?? r.websiteCandidate ?? '-'} ${r.websiteConfidence ?? ''} careers=${r.careersUrl ?? '-'} ats=${r.ats?.ats ?? '-'}`);
    } catch (e) {
      stats.error++;
      await save(t, null, String((e as Error).message).slice(0, 300));
      console.log(`  [error] ${t.name}: ${(e as Error).message}`);
    }
    if (++done % 25 === 0) console.log(`  ... ${done}/${targets.length}`);
  }
}

const started = Date.now();
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s`, stats, atsCounts);
await sql.end();
