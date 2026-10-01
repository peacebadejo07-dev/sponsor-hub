import type { Sql } from 'postgres';
import { inRunWindow, londonParts } from './london.ts';

export interface StepOutcome {
  status: 'ok' | 'failed' | 'skipped';
  summary?: Record<string, unknown>;
  error?: string;
}

export interface Step {
  name: string;
  /** Upper bound for this step in minutes; it also gets whatever is left of the whole run's budget, if less. */
  maxMinutes: number;
  run: (budgetMs: number) => Promise<StepOutcome>;
}

export interface RunOptions {
  steps: Step[];
  now?: Date;
  trigger?: 'schedule' | 'manual';
  /** True when every step runs. Only a full scheduled run counts as the day's run. */
  full?: boolean;
  /** Only run inside the UK morning window, and only if today's run has not already completed. */
  gate?: boolean;
  totalBudgetMinutes?: number;
  log?: (msg: string) => void;
}

export interface RunResult {
  ran: boolean;
  reason?: 'outside_window' | 'already_ran' | 'in_progress';
  runId?: number;
  status?: 'ok' | 'partial' | 'failed';
  steps?: ({ name: string; seconds: number } & StepOutcome)[];
}

const STALE_RUNNING_HOURS = 8; // a "running" row older than this is a crashed run, not a live one

export async function orchestrate(sql: Sql, opts: RunOptions): Promise<RunResult> {
  const now = opts.now ?? new Date();
  const log = opts.log ?? ((m) => console.log(m));
  const trigger = opts.trigger ?? 'schedule';
  const { date } = londonParts(now);

  if (opts.gate) {
    if (!inRunWindow(now)) {
      log(`Not the UK morning window (it is ${londonParts(now).hour}:${String(londonParts(now).minute).padStart(2, '0')} in the UK); nothing to do.`);
      return { ran: false, reason: 'outside_window' };
    }
    const [done] = await sql`select id from scan_runs where run_date = ${date} and status in ('ok', 'partial') and trigger = 'schedule' and all_steps`;
    if (done) {
      log(`Today's run (${date}) already completed; nothing to do.`);
      return { ran: false, reason: 'already_ran' };
    }
  }
  const [busy] = await sql`select id from scan_runs where status = 'running' and started_at > now() - make_interval(hours => ${STALE_RUNNING_HOURS})`;
  if (busy && trigger === 'schedule') {
    log('Another run is still in progress; not starting a second one.');
    return { ran: false, reason: 'in_progress' };
  }
  // A crashed earlier run must not block the next one forever.
  await sql`update scan_runs set status = 'failed', finished_at = now(), error = 'abandoned: no result recorded' where status = 'running' and started_at <= now() - make_interval(hours => ${STALE_RUNNING_HOURS})`;

  const full = opts.full ?? trigger === 'schedule';
  const [run] = await sql<{ id: number }[]>`insert into scan_runs (run_date, trigger, all_steps, started_at) values (${date}, ${trigger}, ${full}, ${now}) returning id`;
  const deadline = Date.now() + (opts.totalBudgetMinutes ?? 240) * 60_000;
  const results: NonNullable<RunResult['steps']> = [];

  const save = (status: 'running' | 'ok' | 'partial' | 'failed', error?: string) =>
    sql`update scan_runs set steps = ${sql.json(results as never)}, status = ${status}, finished_at = ${status === 'running' ? null : sql`now()`}, error = ${error ?? null}, summary = ${sql.json(summarise(results) as never)} where id = ${run.id}`;

  for (const step of opts.steps) {
    const remainingMs = deadline - Date.now();
    const started = Date.now();
    let outcome: StepOutcome;
    if (remainingMs < 30_000) {
      outcome = { status: 'skipped', error: 'no time left in the run budget' };
    } else {
      const budgetMs = Math.min(step.maxMinutes * 60_000, remainingMs);
      log(`\n== ${step.name} (budget ${Math.round(budgetMs / 60_000)} min)`);
      try {
        outcome = await step.run(budgetMs);
      } catch (e) {
        outcome = { status: 'failed', error: String((e as Error).message ?? e).slice(0, 500) }; // one broken step never stops the rest
      }
    }
    results.push({ name: step.name, seconds: Math.round((Date.now() - started) / 1000), ...outcome });
    log(`== ${step.name}: ${outcome.status}${outcome.error ? ` (${outcome.error})` : ''}`);
    await save('running');
  }

  const failed = results.filter((r) => r.status === 'failed');
  const scan = results.find((r) => r.name === 'scan');
  // "failed" means the part users depend on did not happen; anything else that went wrong is "partial".
  const status = !failed.length ? 'ok' : scan && scan.status === 'failed' ? 'failed' : 'partial';
  const note = failed.length ? failed.map((f) => `${f.name}: ${f.error}`).join('; ').slice(0, 800) : undefined;
  try {
    await save(status, note);
  } catch (e) {
    // Recording the result must never leave the run stuck as "running" (which would block the next scheduled run).
    await sql`update scan_runs set status = 'failed', finished_at = now(), error = ${`could not record the result: ${(e as Error).message}`.slice(0, 500)} where id = ${run.id}`.catch(() => {});
    throw e;
  }
  return { ran: true, runId: run.id, status, steps: results };
}

function summarise(results: NonNullable<RunResult['steps']>) {
  const get = (n: string) => (results.find((r) => r.name === n)?.summary ?? {}) as Record<string, number>;
  const scan = get('scan');
  return {
    boardsScanned: scan.boards ?? 0, boardsFailed: scan.failed ?? 0, boardsQueued: scan.queued ?? 0,
    rolesAdded: scan.added ?? 0, rolesChanged: scan.changed ?? 0, rolesExpired: scan.expired ?? 0,
    scanStoppedEarly: !!scan.stoppedEarly
  };
}

export function validateStepNames(requested: string[], known: string[]): string | null {
  const bad = requested.filter((n) => !known.includes(n));
  return bad.length ? `Unknown step${bad.length > 1 ? 's' : ''}: ${bad.join(', ')}. Known steps: ${known.join(', ')}` : null;
}
