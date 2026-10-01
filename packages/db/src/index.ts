import postgres, { type Sql } from 'postgres';

export const LOCAL_URL = 'postgres://postgres:postgres@localhost:54329/sponsored';

const isLocal = (url: string) => /@(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);

/**
 * One way for every script to connect. Local development uses the embedded Postgres; anything else is a hosted
 * database reached over the internet, so TLS is required and prepared statements are off (Supabase's pooler).
 */
export function connect(max = 4): Sql {
  const url = process.env.DATABASE_URL ?? LOCAL_URL;
  const local = isLocal(url);
  // 'require' encrypts the connection but does not check who is on the other end. Supply the provider's CA certificate
  // (Supabase publishes one) in DATABASE_CA to also verify the server's identity.
  const ca = process.env.DATABASE_CA;
  return postgres(url, { max, onnotice: () => {}, ssl: local ? false : ca ? { ca, rejectUnauthorized: true } : 'require', prepare: local });
}

/** Parse `--budget-minutes N` style flags into a deadline for loops that should stop picking up new work. */
export function deadlineFrom(minutes: number | undefined): number {
  return minutes && minutes > 0 ? Date.now() + minutes * 60_000 : Infinity;
}

/**
 * A Postgres text[] parameter. Always use this (never a bare `sql.array(x)`): without an explicit type the driver
 * mis-serialises a one-element array ("malformed array literal"), which would break any filter with a single choice.
 */
export const TEXT_ARRAY = 1009;
export const textArray = (sql: Sql, xs: readonly string[]) => sql.array([...xs], TEXT_ARRAY);
