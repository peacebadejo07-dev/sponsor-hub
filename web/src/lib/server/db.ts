import postgres, { type Sql } from 'postgres';
import { AsyncLocalStorage } from 'node:async_hooks';
import { building, dev } from '$app/environment';
import { env } from '$env/dynamic/private';

// `building` is true while SvelteKit analyses the app at build time, when no database is (or should be) configured.
// At runtime in production a missing DATABASE_URL is a hard error, never a silent fallback to localhost.
const url = env.DATABASE_URL ?? (dev ? 'postgres://postgres:postgres@localhost:54329/sponsored' : '');
if (!url && !building) throw new Error('DATABASE_URL must be set in production');

// Production talks to a hosted database over the internet: insist on TLS. Supabase's pooler needs prepared statements off.
const local = dev || /@(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);
// 'require' encrypts but does not verify the server's identity; set DATABASE_CA to the provider's CA certificate to verify it too.
const ssl = local ? false : env.DATABASE_CA ? { ca: env.DATABASE_CA, rejectUnauthorized: true } : ('require' as const);
const open = (max: number) => postgres(url || 'postgres://build:build@localhost/build', { max, prepare: false, idle_timeout: 20, onnotice: () => {}, ssl });

/**
 * Cloudflare Workers forbid using a network connection opened in one request from another request, so a shared pool
 * breaks as soon as two requests overlap. On Workers every request gets its own short-lived connection; on Node (local
 * development, tests, other hosts) one shared pool is used as usual.
 */
const onWorkers = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
const pool: Sql | null = onWorkers ? null : open(5);
const perRequest = new AsyncLocalStorage<Sql>();

const current = (): Sql => {
  const c = pool ?? perRequest.getStore();
  if (!c) throw new Error('No database connection for this request');
  return c;
};

/** The database handle every query uses. It looks up the right connection for the request that is running. */
export const sql: Sql = new Proxy(function () {} as unknown as Sql, {
  apply: (_t, _this, args) => (current() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => {
    const c = current() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  }
});

/** Run one request with its own connection (Workers) or the shared pool (everywhere else). */
export async function withRequestDb<T>(fn: () => Promise<T>, waitUntil?: (p: Promise<unknown>) => void): Promise<T> {
  if (!onWorkers) return fn();
  const conn = open(1);
  try {
    return await perRequest.run(conn, fn);
  } finally {
    const closing = conn.end({ timeout: 5 }).catch(() => {});
    if (waitUntil) waitUntil(closing); // close it after the response has gone out
  }
}
