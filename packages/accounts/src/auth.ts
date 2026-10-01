import type { Sql } from 'postgres';
import { ipBucket, ipHash, randomToken, sha256 } from './crypto.ts';
import { safeNext } from './redirect.ts';
import { loginEmail, type Mailer } from './mail.ts';

export interface AuthConfig {
  secret: string; // keys the IP hash; required
  baseUrl: string; // e.g. https://sponsorhub.uk, no trailing slash
  mailer: Mailer;
  tokenTtlMs?: number;
  sessionTtlMs?: number;
  maxPerEmailPerHour?: number; // across all IPs: bounds how many emails one victim can be sent
  maxPerEmailPerIpPerHour?: number; // from one IP: so an attacker cannot use up a victim's allowance from a single address
  maxPerIpPerHour?: number;
  maxPerDay?: number; // overall cap, protects a free email quota
  log?: (msg: string) => void;
}

const DEFAULTS = { tokenTtlMs: 15 * 60_000, sessionTtlMs: 30 * 86_400_000, maxPerEmailPerHour: 10, maxPerEmailPerIpPerHour: 3, maxPerIpPerHour: 20, maxPerDay: 300 };

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function normaliseEmail(raw: string): string | null {
  const e = (raw ?? '').trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

export type RequestResult = { ok: true } | { ok: false; reason: 'invalid_email' };

/**
 * Ask for a sign-in link. The answer is the same whether or not the address has an account and whether or not
 * we actually sent anything, so this cannot be used to find out who is registered or to probe rate limits.
 */
export async function requestLogin(sql: Sql, cfg: AuthConfig, rawEmail: string, ip: string, opts: { next?: string } = {}): Promise<RequestResult> {
  const c = { ...DEFAULTS, ...cfg };
  const email = normaliseEmail(rawEmail);
  if (!email) return { ok: false, reason: 'invalid_email' };
  const ih = ipHash(ipBucket(ip || 'unknown'), c.secret);
  const log = cfg.log ?? ((m) => console.warn(m));

  // Opportunistic cleanup of old rows.
  await sql`delete from login_tokens where created_at < now() - interval '2 days'`;
  await sql`delete from sessions where expires_at < now()`;

  const [counts] = await sql<{ by_email: number; by_email_ip: number; by_ip: number; today: number }[]>`
    select count(*) filter (where email = ${email} and created_at > now() - interval '1 hour')::int as by_email,
           count(*) filter (where email = ${email} and requested_ip_hash = ${ih} and created_at > now() - interval '1 hour')::int as by_email_ip,
           count(*) filter (where requested_ip_hash = ${ih} and created_at > now() - interval '1 hour')::int as by_ip,
           count(*) filter (where created_at > now() - interval '1 day')::int as today
    from login_tokens`;
  // Silent drops give the same answer as a sent email, so limits cannot be used to probe who is registered.
  // The reason is logged, and the daily cap (the one that would stop everyone) is logged loudly.
  if (counts.today >= c.maxPerDay) {
    log('ALERT: daily sign-in email cap reached; no more sign-in emails will be sent today');
    return { ok: true };
  }
  if (counts.by_email_ip >= c.maxPerEmailPerIpPerHour || counts.by_email >= c.maxPerEmailPerHour || counts.by_ip >= c.maxPerIpPerHour) {
    log('login request dropped by rate limit');
    return { ok: true };
  }

  const token = randomToken();
  await sql`insert into login_tokens (email, token_hash, expires_at, requested_ip_hash)
            values (${email}, ${sha256(token)}, now() + make_interval(secs => ${c.tokenTtlMs / 1000}), ${ih})`;
  const next = safeNext(opts.next, '');
  const link = `${cfg.baseUrl.replace(/\/$/, '')}/auth/verify?token=${token}${next && next !== '/' ? `&next=${encodeURIComponent(next)}` : ''}`;
  try {
    await cfg.mailer.send({ to: email, ...loginEmail(link, Math.round(c.tokenTtlMs / 60_000)) });
  } catch (e) {
    log(`failed to send sign-in email: ${(e as Error).message}`); // the link is not logged
  }
  return { ok: true };
}

export type VerifyResult = { ok: true; sessionToken: string; userId: string; isNew: boolean; expiresAt: Date } | { ok: false };

/** Turn an emailed token into a session. Single use: the token is consumed atomically. */
export async function verifyLogin(sql: Sql, cfg: Pick<AuthConfig, 'sessionTtlMs'>, token: string, userAgent = ''): Promise<VerifyResult> {
  if (!token || token.length < 20 || token.length > 200) return { ok: false };
  const ttl = cfg.sessionTtlMs ?? DEFAULTS.sessionTtlMs;
  return sql.begin(async (tx) => {
    // One statement both checks and consumes the token, so two requests cannot both succeed.
    const used = await tx<{ email: string }[]>`
      update login_tokens set used_at = now()
      where token_hash = ${sha256(token)} and used_at is null and expires_at > now()
      returning email`;
    if (!used.length) return { ok: false } as const;
    const email = used[0].email;
    await tx`update login_tokens set used_at = now() where email = ${email} and used_at is null`; // retire the rest
    const [u] = await tx<{ id: string; is_new: boolean }[]>`
      insert into users (email, last_login_at) values (${email}, now())
      on conflict (email) do update set last_login_at = now()
      returning id, (xmax = 0) as is_new`;
    const sessionToken = randomToken();
    const [s] = await tx<{ expires_at: Date }[]>`
      insert into sessions (user_id, token_hash, expires_at, user_agent)
      values (${u.id}, ${sha256(sessionToken)}, now() + make_interval(secs => ${ttl / 1000}), ${userAgent.slice(0, 200)})
      returning expires_at`;
    return { ok: true, sessionToken, userId: u.id, isNew: u.is_new, expiresAt: s.expires_at } as const;
  });
}

export interface SessionUser {
  userId: string;
  email: string;
}

/** "tester@example.test" -> "t***@e***.test": enough for a person to recognise their own address, not enough to harvest. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const [first = '', ...rest] = domain.split('.');
  return `${local.slice(0, 1)}***@${first.slice(0, 1)}***${rest.length ? '.' + rest.join('.') : ''}`;
}

/**
 * Who would this link sign in? Does NOT use the token. The confirmation page shows the masked address, so someone
 * who was sent a link for the attacker's account (login CSRF) can see it is not theirs before pressing the button.
 */
export async function peekLogin(sql: Sql, token: string): Promise<{ maskedEmail: string } | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const [r] = await sql<{ email: string }[]>`select email from login_tokens where token_hash = ${sha256(token)} and used_at is null and expires_at > now()`;
  return r ? { maskedEmail: maskEmail(r.email) } : null;
}

/** A session is valid for at most this long since sign-in, however often it is used. */
export const SESSION_ABSOLUTE_DAYS = 90;

/**
 * Look up a session cookie. Returns null for unknown, expired or malformed tokens. Reads first and only writes when the
 * session has not been touched for a day (a write per request would be costly on free hosting). Sliding expiry is capped:
 * a stolen cookie cannot be kept alive forever just by using it.
 */
export async function getSession(sql: Sql, cfg: Pick<AuthConfig, 'sessionTtlMs'>, token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const ttl = cfg.sessionTtlMs ?? DEFAULTS.sessionTtlMs;
  const [row] = await sql<{ id: string; user_id: string; email: string; stale: boolean }[]>`
    select s.id, s.user_id, u.email, (s.last_seen_at < now() - interval '1 day') as stale
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()
      and s.created_at > now() - make_interval(days => ${SESSION_ABSOLUTE_DAYS})`;
  if (!row) return null;
  if (row.stale) {
    await sql`update sessions set last_seen_at = now(),
                expires_at = least(now() + make_interval(secs => ${ttl / 1000}), created_at + make_interval(days => ${SESSION_ABSOLUTE_DAYS}))
              where id = ${row.id}`;
  }
  return { userId: row.user_id, email: row.email };
}

export async function endSession(sql: Sql, token: string | undefined): Promise<void> {
  if (token) await sql`delete from sessions where token_hash = ${sha256(token)}`;
}

export async function endAllSessions(sql: Sql, userId: string): Promise<void> {
  await sql`delete from sessions where user_id = ${userId}`;
}

/** Delete the account and everything attached to it (profile, saved items, sessions, outstanding sign-in links). */
export async function deleteAccount(sql: Sql, userId: string): Promise<boolean> {
  return sql.begin(async (tx) => {
    const [u] = await tx<{ email: string }[]>`select email from users where id = ${userId}`;
    if (!u) return false;
    await tx`delete from login_tokens where email = ${u.email}`;
    await tx`delete from users where id = ${userId}`; // cascades to sessions, profile, marks, saved orgs
    return true;
  });
}
