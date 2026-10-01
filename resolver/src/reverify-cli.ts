import { connect } from '@sponsored/db';
import { fetchPage } from '@sponsored/http';
import { verifyHomepage } from './names.ts';
import { probeBoards } from './probe.ts';
import { sicToTags } from './companieshouse.ts';

/**
 * Re-check weakly verified results against the current rules. Needed after the rules get stricter: earlier runs
 * stored some websites (and boards found through them) that would not pass today. Anything that fails loses its
 * website, its job board and its jobs rather than being left on a public site as if it were right.
 */
const args = process.argv.slice(2);
const opt = (n: string, d?: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const apply = args.includes('--apply');
const nameLike = opt('name');
const concurrency = Number(opt('concurrency', '6'));
const limit = Number(opt('limit', '5000'));

const sql = connect(4);

interface Row { name_key: string; name: string; town: string | null; website: string; conf: number; ats_type: string | null; ats_evidence: string | null; sic: string[] }
const rows = await sql<Row[]>`
  select p.name_key, o.name, o.town, p.website, p.website_confidence as conf, p.ats_type,
         case when p.provenance->'ats'->>'source' like 'job-board address guessed%' then p.provenance->'ats'->>'detail' end as ats_evidence,
         p.sic_codes as sic
  from org_profiles p join lateral (select name, town from orgs where name_key = p.name_key order by id limit 1) o on true
  where p.resolve_status = 'resolved' and p.website is not null and p.website_confidence < 0.8 and p.website_source = 'domain_guess'
    and ${nameLike ? sql`p.name_key like ${'%' + nameLike.toLowerCase() + '%'}` : sql`true`}
  order by p.name_key limit ${limit}`;

console.log(`Re-verifying ${rows.length} weakly verified websites${apply ? '' : ' (dry run: nothing is changed)'}`);
const stats = { kept: 0, websiteDropped: 0, boardDropped: 0, unreachable: 0 };
let next = 0;

async function clear(r: Row, why: string, wholeProfile: boolean) {
  console.log(`  [${wholeProfile ? 'drop website' : 'drop board'}] ${r.name} (${r.website}${r.ats_type ? `, ${r.ats_type}` : ''}): ${why}`);
  if (!apply) return;
  await sql.begin(async (tx) => {
    const prov = { checked_at: new Date().toISOString() };
    if (wholeProfile) {
      await tx`update org_profiles set resolve_status = 'candidate', website_candidate = website, website = null, website_confidence = null,
                 careers_url = null, ats_type = null, ats_slug = null, sector_tags = ${tx.array(sicToTags(r.sic), 1009)}, site_title = null, site_description = null,
                 provenance = provenance || ${tx.json({ website: { status: 'unconfirmed', source: 'domain_guess', detail: `failed re-verification: ${why}`, ...prov }, careers_url: { status: 'unconfirmed', source: 'website', detail: 'website no longer trusted', ...prov } } as never)},
                 updated_at = now() where name_key = ${r.name_key}`;
    } else {
      await tx`update org_profiles set ats_type = null, ats_slug = null,
                 provenance = provenance || ${tx.json({ ats: { status: 'unconfirmed', source: 'board probe', detail: `failed re-verification: ${why}`, ...prov } } as never)},
                 updated_at = now() where name_key = ${r.name_key}`;
    }
    await tx`delete from opportunities where name_key = ${r.name_key}`;
    await tx`delete from org_scans where name_key = ${r.name_key}`;
  });
}

async function worker() {
  while (next < rows.length) {
    const r = rows[next++];
    try {
      const page = await fetchPage(r.website);
      if (!page || page.status >= 400) {
        stats.unreachable++; // cannot tell; leave it alone rather than delete on a network blip
        continue;
      }
      const v = verifyHomepage(page.text, page.url, { name: r.name, town: r.town ?? undefined });
      if (v.confidence < 0.6) {
        stats.websiteDropped++;
        await clear(r, v.reasons.join('; ') || 'no longer matches', true);
        continue;
      }
      if (r.ats_evidence) {
        const hit = await probeBoards({ name: r.name, website: r.website, websiteConfidence: v.confidence });
        if (!hit) {
          stats.boardDropped++;
          await clear(r, 'the job board no longer passes the stricter ownership checks', false);
          continue;
        }
      }
      stats.kept++;
    } catch (e) {
      console.log(`  [error] ${r.name}: ${(e as Error).message}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
console.log('\nDone', stats);
await sql.end();
