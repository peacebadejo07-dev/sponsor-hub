import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import { textArray, deadlineFrom } from '../src/index.ts';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/sponsored';
const probe = postgres(url, { max: 1, connect_timeout: 3, onnotice: () => {} });
let up = true;
try {
  await probe`select 1`;
} catch {
  up = false;
}
afterAll(() => probe.end());

describe.skipIf(!up)('text[] parameters (the "malformed array literal" bug)', () => {
  for (const prepare of [true, false]) {
    it(`round-trips 0, 1 and many elements, and awkward characters (prepared statements: ${prepare})`, async () => {
      const sql = postgres(url, { max: 1, prepare, onnotice: () => {} });
      try {
        for (const xs of [[], ['ai'], ['a', 'b', 'c'], ['a,b', 'c"d', '{x}', 'NULL', '', ' spaced ', "o'clock", 'back\\slash']]) {
          const [r] = await sql<{ v: string[] }[]>`select ${textArray(sql, xs)}::text[] as v`;
          expect(r.v, JSON.stringify(xs)).toEqual(xs);
        }
        // and as the app uses them: filters with a single choice
        const [m] = await sql<{ hit: boolean }[]>`select ${'ai'} = any(${textArray(sql, ['ai'])}::text[]) as hit`;
        expect(m.hit).toBe(true);
        const [o] = await sql<{ hit: boolean }[]>`select '{tech,ai}'::text[] && ${textArray(sql, ['ai'])}::text[] as hit`;
        expect(o.hit).toBe(true);
      } finally {
        await sql.end();
      }
    });
  }

  it('demonstrates why the helper exists: a bare one-element sql.array is mis-serialised', async () => {
    const sql = postgres(url, { max: 1, onnotice: () => {} });
    try {
      await expect(sql`select ${sql.array(['ai'])}::text[]`).rejects.toThrow(/malformed array literal/);
    } finally {
      await sql.end();
    }
  });
});

describe('deadlines', () => {
  it('turns a minutes budget into a timestamp, and no budget into never', () => {
    const t = deadlineFrom(2);
    expect(t - Date.now()).toBeGreaterThan(119_000);
    expect(t - Date.now()).toBeLessThanOrEqual(120_000);
    expect(deadlineFrom(0)).toBe(Infinity);
    expect(deadlineFrom(undefined)).toBe(Infinity);
  });
});
