import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import postgres from 'postgres';
import { londonParts, inRunWindow } from '../src/london.ts';
import { orchestrate, validateStepNames, type Step } from '../src/orchestrate.ts';

describe('UK time and the 08:00 window', () => {
  it('converts UTC to UK clock time, in summer and winter', () => {
    expect(londonParts(new Date('2026-07-15T07:00:00Z'))).toEqual({ date: '2026-07-15', hour: 8, minute: 0 }); // BST
    expect(londonParts(new Date('2026-01-15T07:00:00Z'))).toEqual({ date: '2026-01-15', hour: 7, minute: 0 }); // GMT
    expect(londonParts(new Date('2026-01-15T08:00:00Z')).hour).toBe(8);
  });
  it('handles both clock changes of 2026 and the date rolling over at UK midnight', () => {
    expect(londonParts(new Date('2026-03-29T07:00:00Z')).hour).toBe(8); // clocks went forward that morning
    expect(londonParts(new Date('2026-03-28T07:00:00Z')).hour).toBe(7); // the day before: still GMT
    expect(londonParts(new Date('2026-10-25T07:00:00Z')).hour).toBe(7); // clocks went back that morning
    expect(londonParts(new Date('2026-10-24T07:00:00Z')).hour).toBe(8); // the day before: still BST
    expect(londonParts(new Date('2026-07-15T23:30:00Z')).date).toBe('2026-07-16'); // 00:30 UK time
  });
  it('on every day of 2026 and 2027, one of the two cron times (07:07 and 08:07 UTC) is exactly 08:00 in the UK, and the earlier eligible one is hour 8', () => {
    for (let d = new Date('2026-01-01T00:00:00Z'); d < new Date('2028-01-01T00:00:00Z'); d = new Date(d.getTime() + 86_400_000)) {
      const day = d.toISOString().slice(0, 10);
      const a = new Date(`${day}T07:07:00Z`);
      const b = new Date(`${day}T08:07:00Z`);
      const hours = [londonParts(a).hour, londonParts(b).hour];
      expect(hours.includes(8), day).toBe(true);
      const firstInWindow = [a, b].find((t) => inRunWindow(t))!;
      expect(firstInWindow, day).toBeTruthy();
      expect(londonParts(firstInWindow).hour, day).toBe(8);
      expect(londonParts(a).date, day).toBe(day); // both belong to the same UK date
    }
  });
  it('the window is 08:00 to 13:59 UK time (GitHub can start scheduled jobs hours late)', () => {
    expect(inRunWindow(new Date('2026-01-15T07:59:00Z'))).toBe(false);
    expect(inRunWindow(new Date('2026-01-15T08:00:00Z'))).toBe(true);
    expect(inRunWindow(new Date('2026-01-15T13:59:00Z'))).toBe(true);
    expect(inRunWindow(new Date('2026-01-15T14:00:00Z'))).toBe(false);
    expect(inRunWindow(new Date('2026-07-15T06:59:00Z'))).toBe(false);
    expect(inRunWindow(new Date('2026-07-15T07:00:00Z'))).toBe(true);
  });
});

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/sponsored';
const sql = postgres(url, { max: 2, onnotice: () => {}, connect_timeout: 3 });
let up = true;
try {
  await sql`select 1`;
} catch {
  up = false;
}

const ok = (name: string, summary: Record<string, unknown> = {}): Step => ({ name, maxMinutes: 5, run: async () => ({ status: 'ok', summary }) });
const clean = () => sql`delete from scan_runs where run_date >= '2031-01-01'`;
const quiet = { log: () => {} };

describe.skipIf(!up)('orchestrator (needs the dev database)', () => {
  beforeAll(async () => {
    await sql`delete from scan_runs where status = 'running' and run_date < '2031-01-01'`.catch(() => {});
    await clean();
  });
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await sql.end();
  });

  const WINTER_8 = new Date('2031-01-15T08:00:00Z'); // 08:00 UK
  const SUMMER_9 = new Date('2031-07-15T08:00:00Z'); // 09:00 UK (BST), still inside the window

  it('does nothing outside the UK morning window when gated', async () => {
    const r = await orchestrate(sql, { ...quiet, gate: true, now: new Date('2031-01-15T07:00:00Z'), steps: [ok('scan')] });
    expect(r).toEqual({ ran: false, reason: 'outside_window' });
    expect((await sql`select count(*)::int as n from scan_runs where run_date >= '2031-01-01'`)[0].n).toBe(0);
  });

  it('runs every step in order, records them, and marks the run ok', async () => {
    const order: string[] = [];
    const steps: Step[] = ['register', 'research', 'scan'].map((n) => ({ name: n, maxMinutes: 5, run: async () => (order.push(n), { status: 'ok' as const, summary: n === 'scan' ? { boards: 12, failed: 1, added: 30, changed: 4, expired: 2, queued: 12 } : {} }) }));
    const r = await orchestrate(sql, { ...quiet, gate: true, now: WINTER_8, steps });
    expect(r).toMatchObject({ ran: true, status: 'ok' });
    expect(order).toEqual(['register', 'research', 'scan']);
    const [row] = await sql`select run_date::text as d, status, finished_at, steps, summary from scan_runs where id = ${r.runId!}`;
    expect(row.d).toBe('2031-01-15');
    expect(row.status).toBe('ok');
    expect(row.finished_at).not.toBeNull();
    expect(row.steps.map((s: any) => s.name)).toEqual(['register', 'research', 'scan']);
    expect(row.summary).toMatchObject({ boardsScanned: 12, boardsFailed: 1, rolesAdded: 30, rolesChanged: 4, rolesExpired: 2 });
  });

  it('runs once per UK day however many times the scheduler fires', async () => {
    let runs = 0;
    const steps: Step[] = [{ name: 'scan', maxMinutes: 5, run: async () => (runs++, { status: 'ok' }) }];
    await orchestrate(sql, { ...quiet, gate: true, now: SUMMER_9, steps });
    const again = await orchestrate(sql, { ...quiet, gate: true, now: new Date(SUMMER_9.getTime() + 3600_000 / 2), steps });
    expect(again).toEqual({ ran: false, reason: 'already_ran' });
    expect(runs).toBe(1);
  });

  it('a failing step is recorded and the later steps still run (partial), and a throwing step is caught', async () => {
    const order: string[] = [];
    const steps: Step[] = [
      { name: 'research', maxMinutes: 5, run: async () => (order.push('research'), { status: 'failed', error: 'Wikidata down' }) },
      { name: 'probe', maxMinutes: 5, run: async () => { order.push('probe'); throw new Error('boom'); } },
      { name: 'scan', maxMinutes: 5, run: async () => (order.push('scan'), { status: 'ok' }) },
      { name: 'digest', maxMinutes: 5, run: async () => (order.push('digest'), { status: 'ok' }) }
    ];
    const r = await orchestrate(sql, { ...quiet, now: WINTER_8, steps });
    expect(order).toEqual(['research', 'probe', 'scan', 'digest']);
    expect(r.status).toBe('partial');
    const [row] = await sql`select status, error from scan_runs where id = ${r.runId!}`;
    expect(row.status).toBe('partial');
    expect(row.error).toMatch(/research: Wikidata down/);
    expect(row.error).toMatch(/probe: boom/);
  });

  it('is "failed" when the scan itself fails, and a failed day can be retried', async () => {
    const bad: Step[] = [{ name: 'scan', maxMinutes: 5, run: async () => ({ status: 'failed', error: 'db down' }) }];
    const r = await orchestrate(sql, { ...quiet, gate: true, now: WINTER_8, steps: bad });
    expect(r.status).toBe('failed');
    const retry = await orchestrate(sql, { ...quiet, gate: true, now: new Date(WINTER_8.getTime() + 600_000), steps: [ok('scan')] });
    expect(retry).toMatchObject({ ran: true, status: 'ok' }); // a failed run does not count as "done for today"
  });

  it('refuses a second scheduled run while one is in progress, and abandons a crashed one', async () => {
    await sql`insert into scan_runs (run_date, status, started_at) values ('2031-02-02', 'running', now())`;
    expect(await orchestrate(sql, { ...quiet, now: new Date('2031-02-03T08:00:00Z'), steps: [ok('scan')] })).toEqual({ ran: false, reason: 'in_progress' });
    await sql`update scan_runs set started_at = now() - interval '9 hours' where run_date = '2031-02-02'`;
    const r = await orchestrate(sql, { ...quiet, now: new Date('2031-02-03T08:00:00Z'), steps: [ok('scan')] });
    expect(r.ran).toBe(true);
    expect((await sql`select status, error from scan_runs where run_date = '2031-02-02'`)[0]).toMatchObject({ status: 'failed', error: expect.stringMatching(/abandoned/) });
  });

  it('a manual run on a day that already has a completed scheduled run does not crash, and leaves the day recorded once', async () => {
    await orchestrate(sql, { ...quiet, gate: true, now: WINTER_8, steps: [ok('scan')] });
    const m = await orchestrate(sql, { ...quiet, trigger: 'manual', now: new Date(WINTER_8.getTime() + 3600_000), steps: [ok('scan')] });
    expect(m).toMatchObject({ ran: true, status: 'ok' });
    expect((await sql`select count(*)::int as n from scan_runs where run_date = '2031-01-15' and status = 'running'`)[0].n).toBe(0);
    expect((await sql`select count(*)::int as n from scan_runs where run_date = '2031-01-15'`)[0].n).toBe(2);
  });

  it('a partial run (--only / --skip) is recorded but does not count as the day\'s scheduled run', async () => {
    const partial = await orchestrate(sql, { ...quiet, trigger: 'manual', full: false, now: new Date('2031-05-05T06:30:00Z'), steps: [ok('digest')] });
    expect(partial.status).toBe('ok');
    const real = await orchestrate(sql, { ...quiet, gate: true, now: new Date('2031-05-05T07:30:00Z'), steps: [ok('scan')] }); // 08:30 UK (BST)
    expect(real).toMatchObject({ ran: true, status: 'ok' }); // the partial run did not use up the day
    expect((await sql`select all_steps from scan_runs where id = ${partial.runId!}`)[0].all_steps).toBe(false);
  });

  it('two overlapping runs cannot leave a row stuck as "running"', async () => {
    const a = orchestrate(sql, { ...quiet, gate: true, now: new Date('2031-06-06T08:00:00Z'), steps: [ok('scan')] });
    const b = orchestrate(sql, { ...quiet, gate: true, now: new Date('2031-06-06T08:00:00Z'), steps: [ok('scan')] });
    await Promise.allSettled([a, b]);
    expect((await sql`select count(*)::int as n from scan_runs where run_date = '2031-06-06' and status = 'running'`)[0].n).toBe(0);
    expect((await sql`select count(*)::int as n from scan_runs where run_date = '2031-06-06' and status in ('ok','partial')`)[0].n).toBe(1);
  });

  it('a manual run bypasses the gate and the in-progress check but still records itself', async () => {
    const r = await orchestrate(sql, { ...quiet, trigger: 'manual', now: new Date('2031-03-03T14:30:00Z'), steps: [ok('scan')] });
    expect(r).toMatchObject({ ran: true, status: 'ok' });
    expect((await sql`select trigger from scan_runs where id = ${r.runId!}`)[0].trigger).toBe('manual');
  });

  it('skips remaining steps when the budget is used up and gives each step at most its own limit', async () => {
    const budgets: number[] = [];
    const steps: Step[] = [
      { name: 'slow', maxMinutes: 3, run: async (b) => (budgets.push(b), { status: 'ok' }) },
      { name: 'scan', maxMinutes: 100, run: async (b) => (budgets.push(b), { status: 'ok' }) }
    ];
    const r = await orchestrate(sql, { ...quiet, now: WINTER_8, totalBudgetMinutes: 10, steps });
    expect(budgets[0]).toBeLessThanOrEqual(3 * 60_000);
    expect(budgets[1]).toBeLessThanOrEqual(10 * 60_000); // capped by what is left of the whole budget, not its own 100 minutes
    expect(r.status).toBe('ok');
    const none = await orchestrate(sql, { ...quiet, now: new Date('2031-04-04T08:00:00Z'), totalBudgetMinutes: 0, steps: [ok('scan')] });
    expect(none.steps![0]).toMatchObject({ status: 'skipped' });
  });
});

describe('step name validation', () => {
  it('rejects typos instead of running nothing and calling it a success', () => {
    const known = ['register', 'scan', 'digest'];
    expect(validateStepNames(['scan', 'digest'], known)).toBeNull();
    expect(validateStepNames(['scna'], known)).toMatch(/Unknown step: scna/);
    expect(validateStepNames(['a', 'b'], known)).toMatch(/Unknown steps: a, b/);
  });
});

import { runProcess, childEnv } from '../src/steps.ts';

describe('running a step as a child process', () => {
  const node = (code: string, opts: Partial<Parameters<typeof runProcess>[3]> = {}) =>
    runProcess('t', process.execPath, ['-e', code], { budgetMs: 5_000, quiet: true, drainMs: 50, env: process.env, ...opts });

  it('reads the SUMMARY line, including one with no trailing newline', async () => {
    const r = await node(`console.log('hello'); process.stdout.write('SUMMARY ' + JSON.stringify({ step: 'x', n: 3 }))`);
    expect(r).toEqual({ status: 'ok', summary: { step: 'x', n: 3 } });
  });

  it('reports a non-zero exit as failed, with the last lines of output', async () => {
    const r = await node(`console.error('something broke'); process.exit(3)`);
    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/exit 3.*something broke/);
  });

  it('stops a step that ignores polite stop signals, instead of waiting for the whole job to time out', async () => {
    const started = Date.now();
    // A grandchild that ignores SIGTERM and never exits: the shape of a hung scraper under npm.
    const hung = `
      const { spawn } = require('node:child_process');
      spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: 'inherit' });
      process.on('SIGTERM', () => {});
      setInterval(() => {}, 1000);`;
    const r = await node(hung, { budgetMs: 100, killAfterMs: 200, forceAfterMs: 400 });
    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/killed/);
    expect(Date.now() - started).toBeLessThan(5_000); // minutes in real life, well under a few seconds here
  });

  it('gives children only the variables they need, never the email key or the unsubscribe secret', () => {
    const env = childEnv({ PATH: '/bin', DATABASE_URL: 'postgres://x', COMPANIES_HOUSE_API_KEY: 'k', RESEND_API_KEY: 'secret-mail', AUTH_SECRET: 'secret-auth', GITHUB_TOKEN: 'ghs_x', AUTH_FROM: 'a@b' });
    expect(Object.keys(env).sort()).toEqual(['COMPANIES_HOUSE_API_KEY', 'DATABASE_URL', 'PATH']);
  });
});
