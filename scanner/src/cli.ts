import { connect, deadlineFrom } from '@sponsored/db';
import { ADAPTERS, isSupported } from './adapters/index.ts';
import { screen, normalise, type OppRow } from './normalise.ts';
import { saveScan } from './db.ts';
import type { RawJob, Source } from './types.ts';

const args = process.argv.slice(2);
const opt = (n: string, d?: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const flag = (n: string) => args.includes(`--${n}`);

const limit = Number(opt('limit', '50'));
const concurrency = Number(opt('concurrency', '4'));
const orgLike = opt('org');
const force = flag('force');
const dryRun = flag('dry-run');
const ENRICH_CAP = 80;

const sql = connect(4);
const deadline = deadlineFrom(Number(opt('budget-minutes', '0')));

interface Target { name_key: string; ats_type: string; ats_slug: string }

const targets = await sql<Target[]>`
  select p.name_key, p.ats_type, p.ats_slug
  from org_profiles p
  left join lateral (select started_at, ok from org_scans s where s.name_key = p.name_key order by started_at desc limit 1) ls on true
  where p.ats_type in ${sql(Object.keys(ADAPTERS))} and p.ats_slug is not null
    and ${orgLike ? sql`p.name_key like ${'%' + orgLike.toLowerCase() + '%'}` : sql`true`}
    and (${force} or ls.started_at is null
         or (ls.ok and ls.started_at < now() - interval '20 hours')
         or (not ls.ok and ls.started_at < now() - interval '3 days'))  -- back off boards that failed
  order by ls.started_at nulls first, p.name_key
  limit ${limit}`;

console.log(`Scanning ${targets.length} job boards${dryRun ? ' (dry run)' : ''}`);
const totals = { boards: 0, deferred: 0, failed: 0, found: 0, kept: 0, added: 0, changed: 0, expired: 0, notUk: 0, notTech: 0 };

async function scanOne(t: Target) {
  if (!isSupported(t.ats_type)) return;
  const adapter = ADAPTERS[t.ats_type as Source];
  const res = await adapter.fetchBoard(t.ats_slug);
  totals.boards++;
  if (res.ok && res.slug && res.slug !== t.ats_slug && !dryRun) {
    // The adapter found the precise board address (e.g. Workday host number); remember it.
    await sql`update org_profiles set ats_slug = ${res.slug} where name_key = ${t.name_key}`;
    t.ats_slug = res.slug;
  }
  if (!res.ok && res.status === 429) {
    // The host asked us to slow down or stay away. That is not the board's fault, so it is not recorded as a failure
    // (which would back it off for 3 days); it is simply tried again on the next run.
    totals.deferred++;
    console.log(`  [deferred] ${t.name_key} ${t.ats_type}:${t.ats_slug} (host is rate limiting us)`);
    return;
  }
  if (!res.ok) {
    totals.failed++;
    console.log(`  [failed] ${t.name_key} ${t.ats_type}:${t.ats_slug} HTTP ${res.status}`);
    if (!dryRun) await saveScan(sql, { nameKey: t.name_key, source: t.ats_type as Source, slug: t.ats_slug }, { ok: false, status: res.status, found: 0, kept: [] });
    return;
  }
  const kept: OppRow[] = [];
  let enriched = 0;
  for (const raw of res.jobs) {
    const s = screen(raw);
    if ('skip' in s) {
      if (s.skip === 'not_uk') totals.notUk++;
      else totals.notTech++;
      continue;
    }
    let job: RawJob = raw;
    if (job.descriptionText == null && adapter.enrich && enriched < ENRICH_CAP) {
      enriched++;
      const e = await adapter.enrich(t.ats_slug, job);
      if (e) {
        // Only take values the detail call actually provided.
        const extra = Object.fromEntries(Object.entries(e).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0)));
        job = { ...job, ...extra };
      }
    }
    const n = normalise(job, s.family);
    if ('skip' in n) continue;
    n.source = t.ats_type as Source;
    kept.push(n);
  }
  totals.found += res.jobs.length;
  totals.kept += kept.length;
  const stats = dryRun
    ? { added: kept.length, changed: 0, expired: 0 }
    : await saveScan(sql, { nameKey: t.name_key, source: t.ats_type as Source, slug: t.ats_slug }, { ok: true, status: 200, found: res.jobs.length, kept });
  totals.added += stats.added;
  totals.changed += stats.changed;
  totals.expired += stats.expired;
  console.log(`  ${t.name_key} (${t.ats_type}:${t.ats_slug}): ${res.jobs.length} jobs, ${kept.length} UK tech kept; +${stats.added} ~${stats.changed} -${stats.expired}`);
}

let next = 0;
async function worker() {
  while (next < targets.length && Date.now() < deadline) {
    const t = targets[next++];
    try {
      await scanOne(t);
    } catch (e) {
      totals.failed++;
      console.log(`  [error] ${t.name_key}: ${(e as Error).message}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
console.log('\nDone', totals);
console.log('SUMMARY ' + JSON.stringify({ step: 'scan', ...totals, queued: targets.length, stoppedEarly: next < targets.length }));
await sql.end();
