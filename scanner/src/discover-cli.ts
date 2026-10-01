import postgres from 'postgres';
import { jsonld } from './adapters/jsonld.ts';

/** Find careers pages that publish schema.org JobPosting data, and mark them scannable (ats_type = 'jsonld'). */
const args = process.argv.slice(2);
const opt = (n: string, d?: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const limit = Number(opt('limit', '100'));
const concurrency = Number(opt('concurrency', '4'));
const nameLike = opt('name');
const dryRun = args.includes('--dry-run');

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/sponsored', { max: 4, onnotice: () => {} });

interface Target { name_key: string; careers_url: string }
const targets = await sql<Target[]>`
  select name_key, careers_url from org_profiles
  where careers_url is not null and ats_type is null
    and ${nameLike ? sql`name_key like ${'%' + nameLike.toLowerCase() + '%'}` : sql`true`}
    and (jsonld_checked_at is null or jsonld_checked_at < now() - interval '30 days')
  order by jsonld_checked_at nulls first, name_key
  limit ${limit}`;

console.log(`Checking ${targets.length} careers pages for structured job data${dryRun ? ' (dry run)' : ''}`);
let found = 0;
let next = 0;
async function worker() {
  while (next < targets.length) {
    const t = targets[next++];
    try {
      const r = await jsonld.fetchBoard(t.careers_url);
      if (r.ok && r.jobs.length > 0) {
        found++;
        console.log(`  [found] ${t.name_key}: ${r.jobs.length} JobPosting(s) at ${t.careers_url}`);
        if (!dryRun) {
          await sql`update org_profiles set ats_type = 'jsonld', ats_slug = ${t.careers_url}, jsonld_checked_at = now(),
            provenance = provenance || ${sql.json({ ats: { status: 'verified', source: 'schema.org JobPosting data on the careers page', detail: `${r.jobs.length} posting(s)`, checked_at: new Date().toISOString() } } as never)}
            where name_key = ${t.name_key}`;
        }
      } else if (!dryRun) {
        await sql`update org_profiles set jsonld_checked_at = now() where name_key = ${t.name_key}`;
      }
    } catch (e) {
      console.log(`  [error] ${t.name_key}: ${(e as Error).message}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
console.log(`\nDone: ${found}/${targets.length} careers pages publish structured job data`);
await sql.end();
