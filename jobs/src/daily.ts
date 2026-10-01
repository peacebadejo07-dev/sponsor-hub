import { connect } from '@sponsored/db';
import { orchestrate, validateStepNames } from './orchestrate.ts';
import { buildSteps } from './steps.ts';


/**
 * The daily run. Fired by the scheduler at 07:00 and 08:00 UTC; with --gate it does nothing unless it is the UK
 * morning window and today's run has not already completed, so exactly one of the two firings does the work.
 *
 *   npm run daily -- --gate            scheduled use
 *   npm run daily -- --force           manual run, any time
 *   npm run daily -- --skip digest,probe   leave steps out
 */
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const sql = connect(3);
try {
  const all = buildSteps(sql);
  const skipList = (opt('skip') ?? '').split(',').filter(Boolean);
  const onlyList = (opt('only') ?? '').split(',').filter(Boolean);
  const problem = validateStepNames([...skipList, ...onlyList], all.map((s) => s.name));
  if (problem || (args.includes('--only') && !onlyList.length)) {
    console.error(problem ?? '--only needs at least one step name');
    await sql.end();
    process.exit(2); // a typo must not turn into a "successful" run that did nothing
  }
  const steps = all.filter((s) => !skipList.includes(s.name) && (!onlyList.length || onlyList.includes(s.name)));
  const partial = skipList.length > 0 || onlyList.length > 0;
  const result = await orchestrate(sql, {
    steps,
    gate: flag('gate') && !flag('force'),
    trigger: flag('force') || flag('manual') || partial ? 'manual' : 'schedule',
    full: !partial,
    totalBudgetMinutes: Number(opt('budget-minutes') ?? 240)
  });
  if (result.ran) {
    console.log(`\nRun ${result.runId}: ${result.status}`);
    for (const s of result.steps ?? []) console.log(`  ${s.name.padEnd(12)} ${s.status.padEnd(8)} ${String(s.seconds).padStart(5)}s${s.error ? `  ${s.error}` : ''}`);
  }
  await sql.end();
  process.exit(result.ran && result.status === 'failed' ? 1 : 0); // a failed day shows up red in the scheduler
} catch (e) {
  console.error('Daily run crashed:', e);
  await sql.end().catch(() => {});
  process.exit(1);
}
