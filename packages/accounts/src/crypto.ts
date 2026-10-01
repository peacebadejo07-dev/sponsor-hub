import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256 bits of randomness, URL-safe. Used for emailed sign-in tokens and session cookies. */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

/** Tokens are stored only as their SHA-256, so a database leak does not hand out working sign-in links or sessions. */
export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

/** Keyed hash of an IP address, for rate limiting only. The address itself is never stored. */
export const ipHash = (ip: string, secret: string): string => createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32);

/**
 * The unit we rate-limit by. An IPv6 user can easily have billions of addresses inside their own /64, so limiting
 * by the full address would be no limit at all; IPv6 is bucketed by /64, IPv4 by address.
 */
export function ipBucket(ip: string): string {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];
  if (!ip.includes(':')) return ip;
  const gap = ip.includes('::');
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const full = gap ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return full.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, '')).join(':');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
