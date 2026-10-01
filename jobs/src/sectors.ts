import type { Sql } from 'postgres';
import { deriveSectors, type RoleFamily } from '@sponsored/core';

/** Stable text for comparison: Postgres jsonb reorders object keys, so sort them. */
const canon = (v: unknown): string => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/**
 * Recompute every researched organisation's sector tags and their evidence from: Companies House SIC codes, the
 * website description, live job families, and (last resort) the name. Only rows that actually change are written.
 */
export async function refreshSectors(sql: Sql): Promise<{ checked: number; changed: number; byBasis: Record<string, number> }> {
  const profiles = await sql<{ name_key: string; name: string; sic_codes: string[] | null; site_title: string | null; site_description: string | null; sector_basis: string | null; sector_evidence: unknown; sectors_computed_at: Date | null }[]>`
    select p.name_key, o.name, p.sic_codes, p.site_title, p.site_description, p.sector_basis, p.sector_evidence, p.sectors_computed_at
    from org_profiles p join orgs o on o.name_key = p.name_key`;
  const jobRows = await sql<{ name_key: string; role_family: RoleFamily; n: number }[]>`
    select name_key, role_family, count(*)::int as n from opportunities where status = 'live' and role_family is not null group by 1, 2`;
  const jobs = new Map<string, Partial<Record<RoleFamily, number>>>();
  for (const r of jobRows) (jobs.get(r.name_key) ?? jobs.set(r.name_key, {}).get(r.name_key)!)[r.role_family] = r.n;

  const keys: string[] = [];
  const evs: string[] = [];
  const bases: string[] = [];
  const byBasis: Record<string, number> = {};
  for (const p of profiles) {
    const r = deriveSectors({
      name: p.name,
      sic: p.sic_codes ?? [],
      websiteText: [p.site_title, p.site_description].filter(Boolean).join(' ') || null,
      jobFamilies: jobs.get(p.name_key)
    });
    byBasis[r.basis ?? 'none'] = (byBasis[r.basis ?? 'none'] ?? 0) + 1;
    const ev = JSON.stringify(r.evidence);
    if (p.sectors_computed_at && p.sector_basis === r.basis && canon(p.sector_evidence) === canon(r.evidence)) continue;
    keys.push(p.name_key);
    evs.push(ev);
    bases.push(r.basis ?? '');
  }
  const CHUNK = 1000;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const k = keys.slice(i, i + CHUNK);
    const e = evs.slice(i, i + CHUNK);
    const b = bases.slice(i, i + CHUNK);
    await sql`
      update org_profiles p set
        sector_evidence = v.e::jsonb,
        sector_tags = array(select distinct x->>'tag' from jsonb_array_elements(v.e::jsonb) x order by 1),
        sector_basis = nullif(v.b, ''),
        sectors_computed_at = now()
      from unnest(${sql.array(k, 1009)}::text[], ${sql.array(e, 1009)}::text[], ${sql.array(b, 1009)}::text[]) as v(k, e, b)
      where p.name_key = v.k`;
  }
  return { checked: profiles.length, changed: keys.length, byBasis };
}
