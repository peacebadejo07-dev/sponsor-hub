import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Sql } from 'postgres';
import { consoleMailer, resendMailer, sendDigests, type Mailer } from '@sponsored/accounts';
import { maintenance } from './maintenance.ts';
import type { Step, StepOutcome } from './orchestrate.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * The scraping and database CLIs get only what they need. They do not get the email key or the secret that signs
 * unsubscribe links: code that reads arbitrary websites has no business seeing them.
 */
const CHILD_ENV_ALLOW = ['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'TZ', 'NODE_ENV', 'CI', 'DATABASE_URL', 'DATABASE_CA', 'COMPANIES_HOUSE_API_KEY', 'BOT_CONTACT', 'HOST_INTERVAL_MS'];
export function childEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const k of CHILD_ENV_ALLOW) if (env[k] !== undefined) out[k] = env[k];
  return out;
}

const KILL_AFTER_MS = 3 * 60_000; // beyond the step's own budget, before we step in
const FORCE_AFTER_MS = 30_000; // from a polite stop to a hard kill

export interface ProcessOptions {
  budgetMs: number;
  killAfterMs?: number;
  forceAfterMs?: number;
  drainMs?: number;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  quiet?: boolean;
}

/** Run one of the project's CLIs as a child process, forward its output, and read its final SUMMARY line. */
export const runCli = (label: string, args: string[], budgetMs: number) => runProcess(label, 'npm', ['run', ...args], { budgetMs });

export function runProcess(label: string, command: string, args: string[], opts: ProcessOptions): Promise<StepOutcome> {
  const { budgetMs } = opts;
  const killAfter = opts.killAfterMs ?? KILL_AFTER_MS;
  const forceAfter = opts.forceAfterMs ?? FORCE_AFTER_MS;
  return new Promise((resolve) => {
    // Its own process group, so a stuck grandchild (npm starts node starts tsx) can be stopped too.
    const child = spawn(command, args, { cwd: opts.cwd ?? ROOT, env: opts.env ?? childEnv(), detached: true });
    let summary: Record<string, unknown> | undefined;
    const tail: string[] = [];
    let done = false;
    let forced: ReturnType<typeof setTimeout> | undefined;

    const onLine = (line: string) => {
      if (line.startsWith('SUMMARY ')) {
        try { summary = JSON.parse(line.slice(8)); } catch { /* ignore a malformed summary */ }
        return;
      }
      tail.push(line);
      if (tail.length > 20) tail.shift();
      if (!opts.quiet) console.log(`[${label}] ${line}`);
    };
    for (const stream of [child.stdout, child.stderr]) {
      let buf = '';
      stream.on('data', (d) => {
        buf += d.toString();
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        lines.forEach(onLine);
      });
      stream.on('end', () => { if (buf) onLine(buf); buf = ''; }); // a last line with no newline (often the SUMMARY) still counts
    }
    const signalGroup = (sig: NodeJS.Signals) => { try { if (child.pid) process.kill(-child.pid, sig); } catch { /* already gone */ } };
    const finish = (o: StepOutcome) => {
      if (done) return;
      done = true;
      clearTimeout(killer);
      if (forced) clearTimeout(forced);
      resolve(o);
    };
    // The CLI stops starting new work at its own budget; this is the backstop for one that hangs on a slow site.
    const killer = setTimeout(() => {
      if (!opts.quiet) console.log(`[${label}] still running past its budget; stopping it`);
      signalGroup('SIGTERM');
      forced = setTimeout(() => {
        signalGroup('SIGKILL');
        finish({ status: 'failed', summary, error: 'killed: still running past its budget' });
      }, forceAfter);
    }, budgetMs + killAfter);

    // `exit` fires when the process ends even if a grandchild keeps the pipes open; give the output a moment to drain.
    child.on('exit', (code) => setTimeout(() => finish(code === 0 ? { status: 'ok', summary } : { status: 'failed', summary, error: `exit ${code}: ${tail.slice(-3).join(' | ').slice(0, 300)}` }), opts.drainMs ?? 1500));
    child.on('error', (e) => finish({ status: 'failed', error: e.message }));
  });
}

const mins = (ms: number) => String(Math.max(1, Math.floor(ms / 60_000)));

/** In CI, never print emails to the log (they contain people's addresses and sign-in links); in development, do. */
export function chooseMailer(env = process.env): Mailer | null {
  if (env.RESEND_API_KEY && env.AUTH_FROM) return resendMailer(env.RESEND_API_KEY, env.AUTH_FROM);
  return env.CI ? null : consoleMailer;
}

export function buildSteps(sql: Sql): Step[] {
  return [
    {
      name: 'register', maxMinutes: 10,
      run: async (b) => {
        // The register changes occasionally; checking weekly is plenty.
        const [r] = await sql<{ days: number | null }[]>`select extract(day from now() - max(finished_at))::int as days from register_imports where finished_at is not null`;
        if (r.days !== null && r.days < 6) return { status: 'skipped', summary: { daysSinceImport: r.days }, error: 'register imported within the last 6 days' };
        return runCli('register', ['import'], b);
      }
    },
    // Monthly: the step skips itself unless Companies House has published a snapshot we have not read yet.
    { name: 'companieshouse', maxMinutes: 25, run: (b) => runCli('companieshouse', ['chbulk'], b) },
    { name: 'research', maxMinutes: 20, run: (b) => runCli('research', ['resolve', '--', '--limit', '150', '--tag', 'tech', '--concurrency', '6', '--budget-minutes', mins(b)], b) },
    { name: 'probe', maxMinutes: 15, run: (b) => runCli('probe', ['probe', '--', '--limit', '200', '--concurrency', '6', '--budget-minutes', mins(b)], b) },
    { name: 'discover', maxMinutes: 12, run: (b) => runCli('discover', ['discover', '--', '--limit', '80', '--concurrency', '4', '--budget-minutes', mins(b)], b) },
    { name: 'scan', maxMinutes: 200, run: (b) => runCli('scan', ['scan', '--', '--limit', '3000', '--concurrency', '4', '--budget-minutes', mins(b)], b) },
    {
      name: 'maintenance', maxMinutes: 3,
      run: async () => ({ status: 'ok', summary: await maintenance(sql) })
    },
    {
      name: 'digest', maxMinutes: 10,
      run: async () => {
        const mailer = chooseMailer();
        const secret = process.env.AUTH_SECRET;
        const baseUrl = process.env.PUBLIC_BASE_URL;
        if (!mailer || !secret || !baseUrl) return { status: 'skipped', error: 'email is not configured (RESEND_API_KEY, AUTH_FROM, AUTH_SECRET, PUBLIC_BASE_URL)' };
        return { status: 'ok', summary: await sendDigests(sql, { mailer, secret, baseUrl, log: console.warn }) };
      }
    }
  ];
}
