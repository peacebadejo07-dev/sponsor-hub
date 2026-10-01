import postgres, { type Sql } from 'postgres';
import { pipeline } from 'node:stream/promises';

/**
 * Copy researched data (profiles, live jobs, scan log, Companies House import log) from the local development database to
 * another one, normally Supabase, so a new deployment starts with everything already found instead of rebuilding it over
 * weeks of daily runs. The register itself comes from `npm run import` and is not copied.
 *
 *   TO_URL='postgres://...' npm run copy-data           (from the local dev database)
 *   FROM_URL=... TO_URL=... npm run copy-data
 *
 * It replaces those tables in the target. It refuses to run if the target already has user accounts, so it can never
 * wipe a live site's saved items.
 */

const LOCAL = 'postgres://postgres:postgres@localhost:54329/sponsored';
const TABLES = ['org_profiles', 'opportunities', 'org_scans', 'ch_bulk_imports'] as const;

const isLocal = (u: string) => /@(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(u);
const open = (u: string): Sql => postgres(u, { max: 1, onnotice: () => {}, ssl: isLocal(u) ? false : 'require', prepare: false });

const fromUrl = process.env.FROM_URL ?? LOCAL;
const toUrl = process.env.TO_URL;
if (!toUrl) {
  console.error('Set TO_URL to the target database (for example your Supabase pooler string).');
  process.exit(1);
}
if (fromUrl === toUrl) {
  console.error('FROM_URL and TO_URL are the same database; nothing to do.');
  process.exit(1);
}

const from = open(fromUrl);
const to = open(toUrl);
try {
  const [{ n: users }] = await to`select count(*)::int as n from users`;
  if (users > 0) throw new Error(`The target already has ${users} user account(s). Refusing to overwrite a live site's data.`);
  const [{ n: orgs }] = await to`select count(*)::int as n from orgs`;
  if (orgs === 0) throw new Error('The target has no organisations. Run `npm run db:migrate` and `npm run import` against it first.');

  for (const t of TABLES) {
    await to.begin(async (tx) => {
      await tx`delete from ${tx(t)}`;
      const readable = await from`copy ${from(t)} to stdout`.readable();
      const writable = await tx`copy ${tx(t)} from stdin`.writable();
      await pipeline(readable, writable);
    });
    const [{ n }] = await to`select count(*)::int as n from ${to(t)}`;
    console.log(`${t}: ${n} rows`);
  }
  for (const [t, col] of [['opportunities', 'id'], ['org_scans', 'id']] as const) {
    await to`select setval(pg_get_serial_sequence(${t}, ${col}), greatest(coalesce((select max(id) from ${to(t)}), 1), 1))`;
  }
  console.log('done');
} finally {
  await from.end();
  await to.end();
}
