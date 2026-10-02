import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import robotsModule from 'robots-parser';

interface RobotsRules {
  isAllowed(url: string, ua?: string): boolean | undefined;
}
const robotsParser = robotsModule as unknown as (url: string, txt: string) => RobotsRules;

export const USER_AGENT = `SponsorHubBot/0.1 (+${process.env.BOT_CONTACT ?? 'https://sponsorhub.uk/bot'}; respects robots.txt)`;

const MIN_INTERVAL_MS = Number(process.env.HOST_INTERVAL_MS ?? 1000);
/** Documented public APIs tolerate a faster rate than arbitrary company sites. */
const HOST_INTERVALS: Record<string, number> = {
  'www.wikidata.org': 300,
  'api.company-information.service.gov.uk': 600,
  'boards-api.greenhouse.io': 300,
  'api.lever.co': 300,
  'api.eu.lever.co': 300,
  'api.ashbyhq.com': 300,
  'apply.workable.com': 1500, // Workable rate-limits aggressively (HTTP 429 at 300 ms)
  'api.smartrecruiters.com': 300
};
const nextSlot = new Map<string, number>();

/** Hosts that asked us to stay away for a long time (429 + a big Retry-After), until when. Respected in-process. */
const blocked = new Map<string, number>();
const LONG_BLOCK_SECONDS = 60;
export const blockedHosts = (): string[] => [...blocked.entries()].filter(([, until]) => until > Date.now()).map(([h]) => h);
export const clearBlockedHosts = () => blocked.clear();
const stillBlocked = (host: string) => (blocked.get(host) ?? 0) > Date.now();
const syntheticLimited = (url: string): Page => ({ url, status: 429, contentType: '', text: '' });

/** Serialise requests per host: at most one per interval. */
async function throttle(host: string) {
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, at + (HOST_INTERVALS[host] ?? MIN_INTERVAL_MS));
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

const V4_BLOCKS: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4], ['168.63.129.16', 32] // the last is Azure's WireServer, reachable from some CI runners
];
const v4num = (ip: string): number | null => {
  const p = ip.split('.');
  if (p.length !== 4 || p.some((x) => !/^\d{1,3}$/.test(x) || Number(x) > 255)) return null;
  return ((Number(p[0]) << 24) | (Number(p[1]) << 16) | (Number(p[2]) << 8) | Number(p[3])) >>> 0;
};
const V4_RANGES = V4_BLOCKS.map(([b, bits]) => ({ base: v4num(b)!, mask: bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0 }));

function expandV6(ip: string): number[] | null {
  const lower = ip.toLowerCase().split('%')[0];
  let [head, tail = ''] = lower.split('::');
  const embedded = (tail || head).match(/(\d+\.\d+\.\d+\.\d+)$/);
  let fix = (x: string) => x;
  if (embedded) {
    const n = v4num(embedded[1]);
    if (n === null) return null;
    const hex = `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
    fix = (x: string) => x.replace(embedded[1], hex);
  }
  const h = fix(head).split(':').filter(Boolean);
  const t = fix(tail).split(':').filter(Boolean);
  const gap = lower.includes('::');
  const groups = gap ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  if (groups.length !== 8) return null;
  const out = groups.map((g) => parseInt(g, 16));
  return out.some((n) => !Number.isFinite(n) || n < 0 || n > 0xffff) ? null : out;
}

/** True for any address a public web fetch must never reach: loopback, private, link-local, metadata, reserved, multicast. Unparseable counts as private. */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const g = expandV6(ip);
    if (!g) return true;
    // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::a.b.c.d) addresses are judged by the IPv4 address inside them.
    const mapped = g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff;
    const nat64 = g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0);
    if (mapped || nat64) return isPrivateIp(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
    if (g.every((x) => x === 0) || (g.slice(0, 7).every((x) => x === 0) && g[7] === 1)) return true; // :: and ::1
    return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xff00) === 0xff00 || (g[0] === 0x2001 && g[1] === 0x0db8);
  }
  const n = v4num(ip);
  if (n === null) return true;
  return V4_RANGES.some((r) => ((n & r.mask) >>> 0) === r.base);
}

const dnsCache = new Map<string, boolean>();

/** Does this exact host resolve to public addresses? Cached; fails fast on NXDOMAIN. */
export async function hostResolves(host: string): Promise<boolean> {
  const hit = dnsCache.get(host);
  if (hit !== undefined) return hit;
  const ok = await safeHost(host);
  dnsCache.set(host, ok);
  return ok;
}

async function safeHost(host: string): Promise<boolean> {
  // Tests may talk to a local server, but only when they say so explicitly. Never set in production.
  if (process.env.NODE_ENV === 'test' && process.env.HTTP_ALLOW_LOOPBACK === '1' && (host === 'localhost' || host === '127.0.0.1')) return true;
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (isIP(host)) return !isPrivateIp(host);
  try {
    const addrs = await Promise.race([
      lookup(host, { all: true }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('dns timeout')), 4000))
    ]);
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false; // NXDOMAIN, timeout etc.
  }
}

type Robots = RobotsRules | 'allow' | 'deny';
const robotsCache = new Map<string, { at: number; r: Robots }>();

async function robotsFor(origin: string): Promise<Robots> {
  const hit = robotsCache.get(origin);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.r;
  let r: Robots = 'allow';
  try {
    await throttle(new URL(origin).host);
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'user-agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });
    if (res.status >= 500) r = 'deny';
    else if (res.ok) r = robotsParser(`${origin}/robots.txt`, (await res.text()).slice(0, 500_000));
  } catch {
    r = 'allow';
  }
  robotsCache.set(origin, { at: Date.now(), r });
  return r;
}

export async function allowedByRobots(url: string): Promise<boolean> {
  const u = new URL(url);
  const r = await robotsFor(u.origin);
  if (r === 'allow') return true;
  if (r === 'deny') return false;
  return r.isAllowed(url, USER_AGENT) !== false;
}

export interface Page {
  url: string; // final URL after redirects
  status: number;
  contentType: string;
  text: string;
}

export interface FetchOpts {
  timeoutMs?: number;
  maxBytes?: number;
  skipRobots?: boolean; // only for documented public APIs (Wikidata, ATS JSON feeds)
  retryBaseMs?: number; // wait before retrying a 429/503 that gave no Retry-After (default 2000, doubling)
  accept?: string;
  method?: 'GET' | 'POST';
  body?: string; // JSON body for POST
}

/** Polite GET: private-IP guard, robots.txt, per-host throttle, redirect cap, size cap. Returns null on any failure. */
export async function fetchPage(url: string, opts: FetchOpts = {}, extraHeaders: Record<string, string> = {}): Promise<Page | null> {
  let current = url;
  let retries = 0;
  for (let hop = 0; hop < 5; hop++) {
    let u: URL;
    try {
      u = new URL(current);
    } catch {
      return null;
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!(await safeHost(u.hostname))) return null;
    if (stillBlocked(u.host)) return syntheticLimited(current); // do not make a long block longer
    if (!opts.skipRobots && !(await allowedByRobots(current))) return null;
    await throttle(u.host);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        method: opts.method ?? 'GET',
        body: opts.method === 'POST' ? opts.body : undefined,
        headers: { ...(opts.method === 'POST' ? { 'content-type': 'application/json' } : {}), 'user-agent': USER_AGENT, accept: opts.accept ?? 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5', ...(hop === 0 ? extraHeaders : {}) },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 7_000)
      });
    } catch {
      return null;
    }
    // Rate limited or briefly unavailable: wait as the host asks (or back off) and try the same URL again, twice at most.
    if (res.status === 429 || res.status === 503) {
      const h = res.headers.get('retry-after');
      const secs = h == null ? NaN : Number(h);
      if (Number.isFinite(secs) && secs > LONG_BLOCK_SECONDS) {
        // "Come back in 22 hours": believe it. Remember it for every later request to this host and give up now.
        blocked.set(u.host, Date.now() + Math.min(secs, 86_400) * 1000);
        await res.body?.cancel().catch(() => {});
        return syntheticLimited(current);
      }
    }
    if ((res.status === 429 || res.status === 503) && retries < 2) {
      retries++;
      const header = res.headers.get('retry-after');
      const asked = header == null ? NaN : Number(header); // a missing header is not "0 seconds"
      const wait = Math.min(20_000, Number.isFinite(asked) && asked >= 0 ? Math.max(asked * 1000, 50) : (opts.retryBaseMs ?? 2000) * 2 ** (retries - 1));
      await res.body?.cancel().catch(() => {});
      await new Promise((r) => setTimeout(r, wait));
      hop--;
      continue;
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (opts.method === 'POST') return null; // never replay a POST across a redirect
      current = new URL(res.headers.get('location')!, current).toString();
      continue;
    }
    const contentType = res.headers.get('content-type') ?? '';
    const maxBytes = opts.maxBytes ?? 800_000;
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        chunks.push(value);
        if (size >= maxBytes) {
          await reader.cancel();
          break;
        }
      }
    } catch {
      return null;
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return { url: current, status: res.status, contentType, text };
  }
  return null;
}

export interface JsonResult<T> {
  ok: boolean;
  status: number; // 0 = network/DNS/robots failure
  data: T | null;
}

/** GET a documented public JSON API. Distinguishes "not found" (404) from "could not reach" (status 0). */
export async function fetchJson<T = unknown>(url: string, opts: FetchOpts = {}): Promise<JsonResult<T>> {
  const page = await fetchPage(url, { skipRobots: true, accept: 'application/json', maxBytes: 25_000_000, timeoutMs: 30_000, ...opts });
  if (!page) return { ok: false, status: 0, data: null };
  if (page.status !== 200) return { ok: false, status: page.status, data: null };
  try {
    return { ok: true, status: 200, data: JSON.parse(page.text) as T };
  } catch {
    return { ok: false, status: 200, data: null }; // truncated or not JSON
  }
}
