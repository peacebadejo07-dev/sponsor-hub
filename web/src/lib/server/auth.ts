import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { consoleMailer, resendMailer, safeNext, type AuthConfig } from '@sponsored/accounts';

export { safeNext };

export const SESSION_COOKIE = 'sh_session';

/**
 * Auth settings. In production the secret, the public base URL and a real email sender are all REQUIRED:
 * the base URL builds the sign-in link, and trusting the request's Host header for it would let an attacker
 * point a victim's link at their own server.
 */
export function authConfig(origin: string): AuthConfig {
  const secret = env.AUTH_SECRET;
  if (!dev && (!secret || secret.length < 32)) throw new Error('AUTH_SECRET (32+ characters) must be set in production');
  const baseUrl = env.PUBLIC_BASE_URL ?? (dev ? origin : '');
  if (!baseUrl) throw new Error('PUBLIC_BASE_URL must be set in production');
  let mailer = consoleMailer;
  if (env.RESEND_API_KEY && env.AUTH_FROM) mailer = resendMailer(env.RESEND_API_KEY, env.AUTH_FROM);
  else if (!dev) throw new Error('RESEND_API_KEY and AUTH_FROM must be set in production');
  return { secret: secret ?? 'dev-only-secret-not-for-production', baseUrl, mailer };
}

/** The key for unsubscribe links. Same value the daily job uses (AUTH_SECRET); required in production. */
export function authSecret(): string {
  const secret = env.AUTH_SECRET;
  if (!dev && (!secret || secret.length < 32)) throw new Error('AUTH_SECRET (32+ characters) must be set in production');
  return secret ?? 'dev-only-secret-not-for-production';
}

export const sessionCookieOptions = (expires: Date) => ({
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: !dev,
  expires
});
