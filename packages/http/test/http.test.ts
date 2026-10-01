import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

process.env.HTTP_ALLOW_LOOPBACK = '1';
const { fetchPage, fetchJson, isPrivateIp, blockedHosts, clearBlockedHosts } = await import('../src/index.ts');

let server: Server;
let base = '';
const hits: Record<string, number> = {};

beforeAll(async () => {
  process.env.HOST_INTERVAL_MS = '0';
  server = createServer((req, res) => {
    const path = req.url ?? '/';
    hits[path] = (hits[path] ?? 0) + 1;
    if (path === '/limited-twice') {
      if (hits[path] <= 2) return res.writeHead(429, { 'retry-after': '0' }).end('slow down');
      return res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
    }
    if (path === '/banned') return res.writeHead(429, { 'retry-after': '81207' }).end('come back tomorrow');
    if (path === '/other') return res.writeHead(200).end('fine');
    if (path === '/always-429') return res.writeHead(429).end('no');
    if (path === '/redirect') return res.writeHead(302, { location: '/final' }).end();
    if (path === '/final') return res.writeHead(200, { 'content-type': 'text/plain' }).end('landed');
    if (path === '/post-redirect') return res.writeHead(307, { location: '/final' }).end();
    if (path === '/json-post') {
      let body = '';
      req.on('data', (c) => (body += c));
      return req.on('end', () => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ got: JSON.parse(body), ct: req.headers['content-type'] })));
    }
    if (path === '/big') return res.writeHead(200).end('x'.repeat(2_000_000));
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

describe('polite fetching', () => {
  it('retries a 429, honouring Retry-After, and then succeeds', async () => {
    const r = await fetchJson<{ ok: boolean }>(`${base}/limited-twice`, { skipRobots: true });
    expect(r).toMatchObject({ ok: true, status: 200, data: { ok: true } });
    expect(hits['/limited-twice']).toBe(3);
  });

  it('gives up after two retries and reports the 429 instead of hanging or throwing', async () => {
    const p = await fetchPage(`${base}/always-429`, { skipRobots: true, retryBaseMs: 5 });
    expect(p?.status).toBe(429);
    expect(hits['/always-429']).toBe(3); // the first try plus two retries, no more
  });

  it('believes a long Retry-After: fails fast, stops sending that host anything, and does not retry', async () => {
    clearBlockedHosts();
    const first = await fetchPage(`${base}/banned`, { skipRobots: true });
    expect(first?.status).toBe(429);
    expect(hits['/banned']).toBe(1); // no retries against a 22-hour ban
    expect(blockedHosts()).toHaveLength(1);
    const second = await fetchPage(`${base}/other`, { skipRobots: true }); // same host: not even attempted
    expect(second?.status).toBe(429);
    expect(hits['/other'] ?? 0).toBe(0);
    clearBlockedHosts();
    expect((await fetchPage(`${base}/other`, { skipRobots: true }))?.text).toBe('fine'); // and it recovers when the block is cleared
  });

  it('follows GET redirects, but never replays a POST across one', async () => {
    expect((await fetchPage(`${base}/redirect`, { skipRobots: true }))?.text).toBe('landed');
    expect(await fetchPage(`${base}/post-redirect`, { skipRobots: true, method: 'POST', body: '{}' })).toBeNull();
  });

  it('sends a JSON body with a JSON content type on POST', async () => {
    const r = await fetchJson<{ got: { a: number }; ct: string }>(`${base}/json-post`, { skipRobots: true, method: 'POST', body: JSON.stringify({ a: 1 }) });
    expect(r.data).toEqual({ got: { a: 1 }, ct: 'application/json' });
  });

  it('caps how much it reads', async () => {
    const p = await fetchPage(`${base}/big`, { skipRobots: true, maxBytes: 100_000 });
    expect(p!.text.length).toBeLessThan(1_000_000);
  });

  it('refuses loopback, private, metadata and reserved addresses, including IPv6 and IPv4-mapped forms', () => {
    const blocked = [
      '127.0.0.1', '127.255.255.254', '10.1.2.3', '192.168.0.9', '172.16.0.1', '172.31.255.255', '169.254.169.254', '168.63.129.16', '100.64.0.1',
      '0.0.0.0', '0.1.2.3', '224.0.0.1', '255.255.255.255', '192.0.2.1', '198.18.0.1',
      '::', '::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '2001:db8::1',
      '::ffff:127.0.0.1', '::ffff:10.1.2.3', '::ffff:192.168.1.1', '::ffff:172.16.0.9', '::ffff:169.254.169.254', '::ffff:7f00:1', '0:0:0:0:0:ffff:a00:1',
      '64:ff9b::10.0.0.1', 'not-an-ip', '999.1.1.1', ''
    ];
    for (const ip of blocked) expect(isPrivateIp(ip), ip).toBe(true);
    const allowed = ['93.184.216.34', '8.8.8.8', '141.101.90.96', '172.32.0.1', '172.15.255.255', '100.63.255.255', '169.253.1.1', '2606:4700:4700::1111', '::ffff:93.184.216.34', '2a00:1450:4009:81f::200e'];
    for (const ip of allowed) expect(isPrivateIp(ip), ip).toBe(false);
  });
});
