import type { Sql } from 'postgres';
import type { OppRow } from './normalise.ts';
import type { Source } from './types.ts';

export interface ScanOutcome {
  ok: boolean;
  status: number;
  found: number;
  kept: OppRow[];
  error?: string;
}

export interface ScanStats {
  added: number;
  changed: number;
  expired: number;
}

/** A job missing from this many successful scans in a row is marked expired. One miss could be a blip. */
export const EXPIRE_AFTER_MISSES = 2;

const COLS = [
  'name_key', 'source', 'external_id', 'title', 'role_family', 'seniority', 'location_raw', 'city', 'work_mode', 'employment_type',
  'salary_min', 'salary_max', 'salary_currency', 'salary_period', 'department', 'skills', 'years_experience', 'degree_mentioned',
  'apply_url', 'excerpt', 'sponsorship_signal', 'sponsorship_snippet', 'posted_at', 'content_hash', 'provenance', 'repost_count'
] as const;

export async function saveScan(sql: Sql, org: { nameKey: string; source: Source; slug: string }, out: ScanOutcome): Promise<ScanStats> {
  const stats: ScanStats = { added: 0, changed: 0, expired: 0 };
  return sql.begin(async (tx) => {
    const [scan] = await tx`insert into org_scans (name_key, source, slug) values (${org.nameKey}, ${org.source}, ${org.slug}) returning id`;
    // A failed fetch must never expire anything: we know nothing about the board's state.
    if (!out.ok) {
      await tx`update org_scans set finished_at = now(), ok = false, http_status = ${out.status}, error = ${out.error ?? `HTTP ${out.status}`} where id = ${scan.id}`;
      return stats;
    }

    const existing = await tx<{ external_id: string; content_hash: string }[]>`
      select external_id, content_hash from opportunities where name_key = ${org.nameKey} and source = ${org.source}`;
    const known = new Map(existing.map((e) => [e.external_id, e.content_hash]));

    // A new posting identical in title and place to an expired one is a repost.
    const prior = await tx<{ t: string; l: string; n: number }[]>`
      select lower(title) as t, lower(location_raw) as l, max(repost_count)::int as n from opportunities
      where name_key = ${org.nameKey} and status = 'expired' group by 1, 2`;
    const priorMap = new Map(prior.map((p) => [`${p.t}\u0000${p.l}`, p.n]));

    const rows = out.kept.map((o) => {
      const isNew = !known.has(o.external_id);
      const repost = isNew ? (priorMap.has(`${o.title.toLowerCase()}\u0000${o.location_raw.toLowerCase()}`) ? priorMap.get(`${o.title.toLowerCase()}\u0000${o.location_raw.toLowerCase()}`)! + 1 : 0) : 0;
      if (isNew) stats.added++;
      else if (known.get(o.external_id) !== o.content_hash) stats.changed++;
      return {
        ...o,
        name_key: org.nameKey,
        source: org.source,
        skills: o.skills,
        provenance: tx.json(o.provenance as never),
        repost_count: repost
      };
    });

    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      await tx`
        insert into opportunities ${tx(chunk as never, ...COLS)}
        on conflict (source, name_key, external_id) do update set
          title = excluded.title, role_family = excluded.role_family, seniority = excluded.seniority,
          location_raw = excluded.location_raw, city = excluded.city, work_mode = excluded.work_mode,
          employment_type = excluded.employment_type, salary_min = excluded.salary_min, salary_max = excluded.salary_max,
          salary_currency = excluded.salary_currency, salary_period = excluded.salary_period, department = excluded.department,
          skills = excluded.skills, years_experience = excluded.years_experience, degree_mentioned = excluded.degree_mentioned,
          apply_url = excluded.apply_url, excerpt = excluded.excerpt, sponsorship_signal = excluded.sponsorship_signal,
          sponsorship_snippet = excluded.sponsorship_snippet, posted_at = excluded.posted_at, provenance = excluded.provenance,
          changed_at = case when opportunities.content_hash <> excluded.content_hash then now() else opportunities.changed_at end,
          content_hash = excluded.content_hash,
          last_seen_at = now(), missed_scans = 0, status = 'live', expired_at = null`;
    }

    const seen = out.kept.map((o) => o.external_id);
    const gone = await tx`
      update opportunities set
        missed_scans = missed_scans + 1,
        status = case when missed_scans + 1 >= ${EXPIRE_AFTER_MISSES} then 'expired' else status end,
        expired_at = case when missed_scans + 1 >= ${EXPIRE_AFTER_MISSES} then now() else expired_at end
      where name_key = ${org.nameKey} and source = ${org.source} and status = 'live'
        and external_id <> all(${tx.array(seen.length ? seen : ['__none__'])}::text[])
      returning (status = 'expired') as expired`;
    stats.expired = gone.filter((g) => g.expired).length;

    await tx`update org_scans set finished_at = now(), ok = true, http_status = 200, jobs_found = ${out.found},
             jobs_kept = ${out.kept.length}, added = ${stats.added}, changed = ${stats.changed}, expired = ${stats.expired} where id = ${scan.id}`;
    return stats;
  });
}
