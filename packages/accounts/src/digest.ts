import type { Sql } from 'postgres';
import { createHmac } from 'node:crypto';
import { safeEqual } from './crypto.ts';
import { getProfile } from './profile.ts';
import { rankForUser } from './ranking.ts';
import type { Mailer } from './mail.ts';
import { ROLE_LABELS, type RoleFamily, type UserProfile } from '@sponsored/core';

/** Stateless unsubscribe token: the user id plus a keyed MAC, so it cannot be guessed or forged and needs no storage. */
export function unsubscribeToken(userId: string, secret: string): string {
  return `${userId}.${createHmac('sha256', secret).update(`unsubscribe:${userId}`).digest('base64url').slice(0, 32)}`;
}

export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  const [id, mac] = (token ?? '').split('.');
  if (!id || !mac || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return safeEqual(unsubscribeToken(id, secret), `${id}.${mac}`) ? id : null;
}

export async function setDigest(sql: Sql, userId: string, on: boolean): Promise<void> {
  await sql`update users set digest_opt_in = ${on} where id = ${userId}`;
}

const hasPreferences = (p: UserProfile) => p.roles.length + p.locations.length + p.skills.length + p.workModes.length > 0 || p.level != null;

export interface Digest {
  subject: string;
  text: string;
  count: number;
  headers: Record<string, string>;
}

/** The best new matches for one person, or null when there is nothing worth emailing. Reasons come from the same scorer as the site. */
export async function buildDigest(sql: Sql, userId: string, profile: UserProfile, baseUrl: string, secret: string, sinceHours = 8 * 24): Promise<Digest | null> {
  if (!hasPreferences(profile)) return null;
  const { items } = await rankForUser(sql, userId, profile, 1, { sinceHours, minScore: 65 });
  const top = items.slice(0, 5);
  if (!top.length) return null;
  const base = baseUrl.replace(/\/$/, '');
  const token = encodeURIComponent(unsubscribeToken(userId, secret));
  const lines = top.map(({ row, match }, i) => {
    const why = match.reasons.filter((r) => r.kind === '+').slice(0, 3).map((r) => r.text).join('; ');
    return [
      `${i + 1}. ${row.title} at ${row.org_name.trim()} (${match.score}% match)`,
      `   ${[row.city ?? row.location_raw.split(' | ')[0], ROLE_LABELS[row.role_family as RoleFamily]].filter(Boolean).join(' · ')}`,
      why ? `   Why: ${why}` : '',
      `   Apply: ${row.apply_url}`
    ].filter(Boolean).join('\n');
  });
  return {
    count: top.length,
    subject: `${top.length} new role${top.length === 1 ? '' : 's'} that fit you on Sponsor Hub`,
    text: [
      'Here are the best new matches from the last week, based on the preferences in your profile.',
      '',
      ...lines.flatMap((l) => [l, '']),
      `See everything ranked for you: ${base}/for-you`,
      '',
      'Every employer listed is on the Home Office register of licensed sponsors, but that does not mean a particular role is sponsored. Check each posting.',
      '',
      `You asked for this weekly email. Turn it off any time: ${base}/unsubscribe?token=${token}`
    ].join('\n'),
    // Mail providers (Gmail, Yahoo) require a machine-readable unsubscribe for bulk senders: a one-click POST endpoint.
    headers: { 'List-Unsubscribe': `<${base}/unsubscribe/one-click?token=${token}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
  };
}

export interface DigestConfig {
  mailer: Mailer;
  secret: string;
  baseUrl: string;
  maxPerRun?: number;
  log?: (m: string) => void;
}

/** Send the weekly digest to everyone who opted in and is due. At most one per person per six days. */
export async function sendDigests(sql: Sql, cfg: DigestConfig): Promise<{ due: number; sent: number; nothingToSend: number; failed: number }> {
  const log = cfg.log ?? (() => {});
  const due = await sql<{ id: string; email: string; last: Date | null }[]>`
    select id, email, last_digest_at as last from users
    where digest_opt_in and (last_digest_at is null or last_digest_at < now() - interval '6 days')
    order by last_digest_at nulls first limit ${cfg.maxPerRun ?? 100}`;
  const out = { due: due.length, sent: 0, nothingToSend: 0, failed: 0 };
  for (const u of due) {
    let claimed = false;
    try {
      const { profile } = await getProfile(sql, u.id);
      // Only roles found since the last digest (so a week's digest does not repeat the previous one), at most 8 days back.
      const sinceHours = u.last ? Math.min(8 * 24, Math.max(24, Math.ceil((Date.now() - new Date(u.last).getTime()) / 3_600_000))) : 8 * 24;
      const digest = await buildDigest(sql, u.id, profile, cfg.baseUrl, cfg.secret, sinceHours);
      if (!digest) {
        out.nothingToSend++;
        continue; // not marked as sent, so tomorrow's run looks again
      }
      // Claim the send BEFORE sending, so two overlapping runs cannot both email the same person, and a crash between
      // "sent" and "recorded" cannot make tomorrow's run send it again. If sending fails the claim is undone.
      const won = await sql`update users set last_digest_at = now() where id = ${u.id} and last_digest_at is not distinct from ${u.last} returning id`;
      if (!won.length) continue;
      claimed = true;
      await cfg.mailer.send({ to: u.email, subject: digest.subject, text: digest.text, headers: digest.headers });
      out.sent++;
    } catch (e) {
      out.failed++;
      if (claimed) await sql`update users set last_digest_at = ${u.last} where id = ${u.id}`.catch(() => {});
      log(`digest failed for a user: ${(e as Error).message}`); // the address is not logged
    }
  }
  return out;
}
