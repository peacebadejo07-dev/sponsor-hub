import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { saveScan } from '../src/db.ts';
import { normalise } from '../src/normalise.ts';
import type { RawJob } from '../src/types.ts';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/sponsored';
const sql = postgres(url, { max: 2, onnotice: () => {}, connect_timeout: 3 });
let up = true;
try {
  await sql`select 1`;
} catch {
  up = false;
}

const KEY = '__test_lifecycle__';
const ORG = { nameKey: KEY, source: 'greenhouse' as const, slug: 'test' };

const job = (id: string, over: Partial<RawJob> = {}): RawJob => ({
  externalId: id, title: `Software Engineer ${id}`, locations: ['London, UK'], countryCodes: [], applyUrl: `https://x.test/${id}`,
  postedAt: null, department: null, employmentTypeRaw: null, workMode: null, descriptionText: `Build things ${id}`, salary: null, ...over
});
const kept = (...jobs: RawJob[]) =>
  jobs.map((j) => {
    const o = normalise(j, 'software');
    if ('skip' in o) throw new Error('skipped');
    o.source = 'greenhouse';
    return o;
  });
const ok = (...jobs: RawJob[]) => ({ ok: true, status: 200, found: jobs.length, kept: kept(...jobs) });
const status = async (id: string) => (await sql`select status, missed_scans, repost_count from opportunities where name_key = ${KEY} and external_id = ${id}`)[0];

describe.skipIf(!up)('scan lifecycle (needs the dev database)', () => {
  beforeAll(async () => {
    await sql`delete from opportunities where name_key = ${KEY}`;
    await sql`delete from org_scans where name_key = ${KEY}`;
    await sql`delete from org_profiles where name_key = ${KEY}`;
    await sql`insert into org_profiles (name_key, resolve_status) values (${KEY}, 'resolved')`;
  });
  afterAll(async () => {
    await sql`delete from opportunities where name_key = ${KEY}`;
    await sql`delete from org_scans where name_key = ${KEY}`;
    await sql`delete from org_profiles where name_key = ${KEY}`;
    await sql.end();
  });

  it('a board that lists the same posting twice does not crash the scan and stores it once', async () => {
    const dup = ok(job('dup'), job('dup', { title: 'Software Engineer dup (updated)' }), job('other'));
    expect(dup.kept).toHaveLength(3);
    const stats = await saveScan(sql, ORG, dup);
    expect(stats.added).toBe(2); // 'dup' and 'other'
    const rows = await sql`select title from opportunities where name_key = ${KEY} and external_id = 'dup'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toMatch(/updated/); // the last listing wins
    await sql`delete from opportunities where name_key = ${KEY}`;
  });

  it('adds new jobs, then reports no change on an identical rescan', async () => {
    expect(await saveScan(sql, ORG, ok(job('a'), job('b')))).toEqual({ added: 2, changed: 0, expired: 0 });
    expect(await saveScan(sql, ORG, ok(job('a'), job('b')))).toEqual({ added: 0, changed: 0, expired: 0 });
  });

  it('records a changed description and sets changed_at', async () => {
    expect(await saveScan(sql, ORG, ok(job('a', { descriptionText: 'Different text' }), job('b')))).toEqual({ added: 0, changed: 1, expired: 0 });
    const [r] = await sql`select changed_at from opportunities where name_key = ${KEY} and external_id = 'a'`;
    expect(r.changed_at).not.toBeNull();
  });

  it('does NOT expire anything when the fetch fails', async () => {
    await saveScan(sql, ORG, { ok: false, status: 503, found: 0, kept: [], error: 'boom' });
    await saveScan(sql, ORG, { ok: false, status: 0, found: 0, kept: [] });
    await saveScan(sql, ORG, { ok: false, status: 404, found: 0, kept: [] });
    expect(await status('a')).toMatchObject({ status: 'live', missed_scans: 0 });
    expect(await status('b')).toMatchObject({ status: 'live', missed_scans: 0 });
    const scans = await sql`select ok from org_scans where name_key = ${KEY} order by id desc limit 3`;
    expect(scans.every((s) => s.ok === false)).toBe(true);
  });

  it('expires a job only after two consecutive missed scans', async () => {
    await saveScan(sql, ORG, ok(job('a', { descriptionText: 'Different text' }))); // b missing, 1st miss
    expect(await status('b')).toMatchObject({ status: 'live', missed_scans: 1 });
    const s = await saveScan(sql, ORG, ok(job('a', { descriptionText: 'Different text' }))); // 2nd miss
    expect(s.expired).toBe(1);
    expect(await status('b')).toMatchObject({ status: 'expired', missed_scans: 2 });
    expect(await status('a')).toMatchObject({ status: 'live', missed_scans: 0 });
  });

  it('brings a job back to live if it reappears', async () => {
    await saveScan(sql, ORG, ok(job('a', { descriptionText: 'Different text' }), job('b')));
    expect(await status('b')).toMatchObject({ status: 'live', missed_scans: 0 });
    const [r] = await sql`select expired_at from opportunities where name_key = ${KEY} and external_id = 'b'`;
    expect(r.expired_at).toBeNull();
  });

  it('counts a repost: same title and place under a new id after the old one expired', async () => {
    await saveScan(sql, ORG, ok(job('a', { descriptionText: 'Different text' }))); // b: miss 1
    await saveScan(sql, ORG, ok(job('a', { descriptionText: 'Different text' }))); // b: expired
    expect(await status('b')).toMatchObject({ status: 'expired' });
    await saveScan(sql, ORG, ok(job('a', { descriptionText: 'Different text' }), job('c', { title: 'Software Engineer b', descriptionText: 'Build things b' })));
    expect(await status('c')).toMatchObject({ status: 'live', repost_count: 1 });
  });
});
