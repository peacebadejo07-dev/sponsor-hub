import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import robotsModule from 'robots-parser';

interface RobotsRules {
  isAllowed(url: string, ua?: string): boolean | undefined;
}
const robotsParser = robotsModule as unknown as (url: string, txt: string) => RobotsRules;

export const USER_AGENT = `SponsorHubBot/0.1 (+${process.env.BOT_CONTACT ?? 'https://github.com/OWNER/sponsor-hub'}; respects robots.txt)`;

const MIN_INTERVAL_MS = Number(process.env.HOST_INTERVAL_MS ?? 1000);
/** Documented public APIs tolerate a faster rate than arbitrary company sites. */
const HOST_INTERVALS: Record<string, number> = {
  'www.wikidata.org': 300,
  'api.company-information.service.gov.uk': 600,
  'boards-api.greenhouse.io': 300,
  'api.lever.co': 300,
  'api.eu.lever.co': 300,
  'api.ashbyhq.com': 300,
  'apply.workable.com': 300,
  'api.smartrecruiters.com': 300
};
const nextSlot = new Map<string, number>();

/** Serialise requests per host: at most one per interval. */
async function throttle(host: string) {
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, at + (HOST_INTERVALS[host] ?? MIN_INTERVAL_MS));
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

export function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const l = ip.toLowerCase();
    return l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:127.') || l.startsWith('::ffff:10.') || l === '::';
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  );
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
  accept?: string;
  method?: 'GET' | 'POST';
  body?: string; // JSON body for POST
}

/** Polite GET: private-IP guard, robots.txt, per-host throttle, redirect cap, size cap. Returns null on any failure. */
export async function fetchPage(url: string, opts: FetchOpts = {}, extraHeaders: Record<string, string> = {}): Promise<Page | null> {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    let u: URL;
    try {
      u = new URL(current);
    } catch {
      return null;
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!(await safeHost(u.hostname))) return null;
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
