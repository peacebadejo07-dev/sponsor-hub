import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import { refreshSectors } from '../src/sectors.ts';

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/sponsored', { max: 2, onnotice: () => {}, connect_timeout: 3 });
let up = true;
try {
  await sql`select 1`;
} catch {
  up = false;
}

const KEYS = ['zz sectors software ltd', 'zz sectors bank plc', 'zz sectors digital eats ltd', 'zz sectors acme network ltd'];

describe.skipIf(!up)('refreshSectors (needs the dev database)', () => {
  let importId: number;
  const cleanup = async () => {
    await sql`delete from opportunities where name_key = any(${sql.array(KEYS, 1009)}::text[])`;
    await sql`delete from org_profiles where name_key = any(${sql.array(KEYS, 1009)}::text[])`;
    await sql`delete from orgs where name_key = any(${sql.array(KEYS, 1009)}::text[])`;
    if (importId) await sql`delete from register_imports where id = ${importId}`;
  };
  afterAll(async () => {
    await cleanup();
    await sql.end();
  });

  it('derives tags and evidence from SIC, name last, and writes only changes', async () => {
    const [imp] = await sql`insert into register_imports (source, published_on, row_count, org_count) values ('test', '2031-01-01', 0, 0) returning id`;
    importId = imp.id;
    const org = (key: string, name: string, tags: string[]) => sql`
      insert into orgs (name_key, name, rating, sector_tags, first_import_id, last_import_id)
      values (${key}, ${name}, 'A', ${sql.array(tags, 1009)}::text[], ${importId}, ${importId})`;
    await org(KEYS[0], 'ZZ Sectors Software Ltd', ['software', 'tech']);
    await org(KEYS[1], 'ZZ Sectors Bank plc', []);
    await org(KEYS[2], 'ZZ Sectors Digital Eats Ltd', ['digital', 'tech']);
    await org(KEYS[3], 'ZZ Sectors Acme Network Ltd', ['telecoms', 'tech']);
    const prof = (key: string, sic: string[]) => sql`insert into org_profiles (name_key, resolve_status, sic_codes) values (${key}, 'resolved', ${sql.array(sic, 1009)}::text[])`;
    await prof(KEYS[0], ['62012']);
    await prof(KEYS[1], ['64191']);
    await prof(KEYS[2], ['56101']); // a restaurant: the name must not make it tech
    await prof(KEYS[3], ['70229']); // generic code: name is the last resort

    const first = await refreshSectors(sql);
    expect(first.changed).toBeGreaterThanOrEqual(4);
    const rows = await sql<{ name_key: string; all_sector_tags: string[]; sector_basis: string | null }[]>`
      select name_key, all_sector_tags, sector_basis from orgs_enriched where name_key = any(${sql.array(KEYS, 1009)}::text[])`;
    const by = Object.fromEntries(rows.map((r) => [r.name_key, r]));
    expect(by[KEYS[0]]).toMatchObject({ sector_basis: 'sic', all_sector_tags: expect.arrayContaining(['software', 'tech']) });
    expect(by[KEYS[1]]).toMatchObject({ sector_basis: 'sic', all_sector_tags: ['finance'] });
    expect(by[KEYS[2]]).toMatchObject({ sector_basis: null, all_sector_tags: [] });
    expect(by[KEYS[3]]).toMatchObject({ sector_basis: 'name', all_sector_tags: expect.arrayContaining(['telecoms']) });

    // Live jobs speak only when nothing stronger exists
    const second = await refreshSectors(sql);
    expect(second.changed).toBe(0); // idempotent: nothing rewritten
  });
});
