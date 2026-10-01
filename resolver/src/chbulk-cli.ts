import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { parse } from 'csv-parse';
import { connect } from '@sponsored/db';
import { BulkMatcher, rowFromRecord, snapshotFromListing, type Match, type OrgRef } from './chbulk.ts';

/**
 * Read Companies House's monthly bulk file (BasicCompanyData, ~470 MB zipped) and attach company number, status,
 * incorporation date and SIC codes to our organisations. Run monthly; `npm run chbulk [-- --force] [-- --file x.zip]`.
 */

const LISTING = 'https://download.companieshouse.gov.uk/en_output.html';
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);

async function download(url: string, to: string) {
  const res = await fetch(url, { headers: { 'user-agent': 'SponsorHubBot (open-source; monthly Companies House bulk read)' }, signal: AbortSignal.timeout(20 * 60_000) });
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(to));
}

const sql = connect(2);
let dir: string | null = null;
try {
  let zip = opt('file');
  let snapshot: string | null = null;
  if (!zip) {
    const listing = await fetch(LISTING, { signal: AbortSignal.timeout(30_000) }).then((r) => r.text());
    snapshot = snapshotFromListing(listing);
    if (!snapshot) throw new Error('could not find the bulk file in the Companies House listing');
    const [done] = await sql`select 1 from ch_bulk_imports where snapshot_date = ${snapshot}`;
    if (done && !flag('force')) {
      console.log(`SUMMARY ${JSON.stringify({ step: 'companies-house', snapshot, skipped: 'already imported' })}`);
      snapshot = null; // nothing to do
    }
    if (snapshot) {
      dir = await mkdtemp(join(tmpdir(), 'chbulk-'));
      zip = join(dir, 'bulk.zip');
      console.log(`downloading snapshot ${snapshot} ...`);
      await download(`https://download.companieshouse.gov.uk/BasicCompanyDataAsOneFile-${snapshot}.zip`, zip);
    }
  } else {
    snapshot = zip.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10);
  }

  if (snapshot && zip) {
    const orgRows = await sql<{ name_key: string; name: string; towns: string[]; number: string | null }[]>`
      select o.name_key, (array_agg(o.name order by o.id))[1] as name, array_agg(distinct o.town) as towns,
             max(p.companies_house_no) as number
      from orgs o left join org_profiles p on p.name_key = o.name_key
      where o.status = 'active' group by o.name_key`;
    const orgs: OrgRef[] = orgRows.map((r) => ({ nameKey: r.name_key, name: r.name, towns: r.towns, number: r.number }));
    const matcher = new BulkMatcher(orgs);

    // funzip streams the single CSV out of the archive without writing it to disk.
    const unzip = spawn('funzip', [zip], { stdio: ['ignore', 'pipe', 'inherit'] });
    const parser = parse({ columns: (h: string[]) => h.map((x) => x.trim()), relax_quotes: true, relax_column_count: true, skip_empty_lines: true });
    const exited = new Promise<number>((res) => unzip.on('close', (c) => res(c ?? 1)));
    unzip.stdout.pipe(parser);
    for await (const rec of parser) {
      const row = rowFromRecord(rec as Record<string, string>);
      if (row) matcher.offer(row);
    }
    if ((await exited) !== 0) throw new Error('could not unzip the bulk file');
    if (matcher.rows < 1_000_000) throw new Error(`only ${matcher.rows} rows read; the file looks truncated, nothing written`);

    const matches = matcher.results(orgs);
    const { created, updated } = await apply(matches);
    await sql`insert into ch_bulk_imports (snapshot_date, rows_read, matched, created, updated)
              values (${snapshot}, ${matcher.rows}, ${matches.length}, ${created}, ${updated})
              on conflict (snapshot_date) do update set rows_read = excluded.rows_read, matched = excluded.matched,
                created = excluded.created, updated = excluded.updated, imported_at = now()`;
    const by = { number: 0, name_and_town: 0, exact_name: 0 };
    for (const m of matches) by[m.by]++;
    console.log(`SUMMARY ${JSON.stringify({ step: 'companies-house', snapshot, rows: matcher.rows, matched: matches.length, created, updated, by })}`);
  }
} finally {
  if (dir) await rm(dir, { recursive: true, force: true });
  await sql.end();
}

async function apply(matches: Match[]): Promise<{ created: number; updated: number }> {
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  const CHUNK = 1000;
  for (let i = 0; i < matches.length; i += CHUNK) {
    const part = matches.slice(i, i + CHUNK);
    const col = <T>(f: (m: Match) => T) => part.map(f);
    const rows = await sql<{ inserted: boolean }[]>`
      insert into org_profiles (name_key, companies_house_no, ch_status, incorporated_on, sic_codes, provenance)
      select v.k, v.n, v.s, nullif(v.d, '')::date, coalesce(string_to_array(nullif(v.c, ''), ','), '{}'), coalesce(nullif(v.p, '')::jsonb, '{}')
      from unnest(${sql.array(col((m) => m.nameKey), 1009)}::text[], ${sql.array(col((m) => m.row.number), 1009)}::text[],
                  ${sql.array(col((m) => m.row.status), 1009)}::text[], ${sql.array(col((m) => m.row.incorporated ?? ''), 1009)}::text[],
                  ${sql.array(col((m) => m.row.sic.join(',')), 1009)}::text[],
                  ${sql.array(col((m) => (m.by === 'number' ? '' : JSON.stringify({ companies_house: { status: 'inferred', source: 'companies_house_bulk', detail: m.row.number, checked_at: now } }))), 1009)}::text[])
        as v(k, n, s, d, c, p)
      on conflict (name_key) do update set
        companies_house_no = excluded.companies_house_no, ch_status = excluded.ch_status,
        incorporated_on = excluded.incorporated_on, sic_codes = excluded.sic_codes,
        provenance = org_profiles.provenance || excluded.provenance, updated_at = now()
        where org_profiles.companies_house_no is null or org_profiles.companies_house_no = excluded.companies_house_no
      returning (xmax = 0) as inserted`;
    for (const r of rows) r.inserted ? created++ : updated++;
  }
  return { created, updated };
}
