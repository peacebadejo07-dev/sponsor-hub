import postgres from 'postgres';
import { probeBoards } from './probe.ts';

const args = process.argv.slice(2);
const opt = (n: string, d?: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const limit = Number(opt('limit', '200'));
const concurrency = Number(opt('concurrency', '6'));
const nameLike = opt('name');
const dryRun = args.includes('--dry-run');
const retryDays = Number(opt('retry-days', '30'));

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/sponsored', { max: 4, onnotice: () => {} });

interface Target { name_key: string; name: string; website: string | null; status: string }

// Any researched organisation without a known job board, even if its website was not found:
// board names let us verify a match without the website.
const targets = await sql<Target[]>`
  select p.name_key, o.name, p.website, p.resolve_status as status
  from org_profiles p
  join lateral (select name from orgs where name_key = p.name_key order by id limit 1) o on true
  where p.ats_type is null
    and ${nameLike ? sql`p.name_key like ${'%' + nameLike.toLowerCase() + '%'}` : sql`true`}
    and (p.ats_probed_at is null or p.ats_probed_at < now() - make_interval(days => ${retryDays}))
  order by (p.resolve_status = 'resolved') desc, p.ats_probed_at nulls first, p.name_key
  limit ${limit}`;

console.log(`Probing ${targets.length} organisations for job boards${dryRun ? ' (dry run)' : ''}`);
const found: Record<string, number> = {};
let hits = 0;
let next = 0;

async function worker() {
  while (next < targets.length) {
    const t = targets[next++];
    try {
      const hit = await probeBoards({ name: t.name, website: t.website });
      if (hit) {
        hits++;
        found[hit.ats] = (found[hit.ats] ?? 0) + 1;
        console.log(`  [found] ${t.name} -> ${hit.ats}:${hit.slug}  (${hit.evidence})`);
        if (!dryRun) {
          await sql`
            update org_profiles set ats_type = ${hit.ats}, ats_slug = ${hit.slug}, ats_probed_at = now(),
              provenance = provenance || ${sql.json({ ats: { status: 'inferred', source: 'job-board address guessed from the name, then checked', detail: hit.evidence, checked_at: new Date().toISOString() } } as never)}
            where name_key = ${t.name_key}`;
        }
      } else if (!dryRun) {
        await sql`update org_profiles set ats_probed_at = now() where name_key = ${t.name_key}`;
      }
    } catch (e) {
      console.log(`  [error] ${t.name}: ${(e as Error).message}`);
    }
  }
}
const started = Date.now();
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s: ${hits}/${targets.length} organisations matched a board`, found);
await sql.end();
