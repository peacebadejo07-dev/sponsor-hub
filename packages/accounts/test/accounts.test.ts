import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import postgres from 'postgres';
import {
  requestLogin, verifyLogin, getSession, endSession, deleteAccount, normaliseEmail, sha256, resendMailer,
  sanitiseProfile, splitList, safeNext, ipBucket, maskEmail, peekLogin, getProfile, saveProfile, setMark, marksFor, setSavedOrg, savedOrgIds, exportUserData,
  type AuthConfig, type Mail
} from '../src/index.ts';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/sponsored';
const sql = postgres(url, { max: 3, onnotice: () => {}, connect_timeout: 3 });
let up = true;
try {
  await sql`select 1`;
} catch {
  up = false;
}

const TAG = `t${Date.now()}`;
const mail = (n: string) => `${n}.${TAG}@example.test`;
let sent: Mail[] = [];
const cfg = (over: Partial<AuthConfig> = {}): AuthConfig => ({
  secret: 'test-secret', baseUrl: 'https://hub.test', mailer: { send: async (m) => void sent.push(m) }, log: () => {}, ...over
});
const tokenFrom = (m: Mail) => new URL(m.text.match(/https:\/\/\S+/)![0]).searchParams.get('token')!;
const cleanup = async () => {
  await sql`delete from login_tokens where email like ${'%.' + TAG + '@example.test'}`;
  await sql`delete from users where email like ${'%.' + TAG + '@example.test'}`;
};

describe('email handling (no database needed)', () => {
  it('normalises and validates addresses', () => {
    expect(normaliseEmail('  Alice@Example.COM ')).toBe('alice@example.com');
    for (const bad of ['', 'nope', 'a@b', 'a b@c.com', 'a@b.c', '<x>@y.com', 'a@@b.com', 'x'.repeat(250) + '@b.com']) expect(normaliseEmail(bad), bad).toBeNull();
  });
  it('the Resend mailer sends the right request and reports failures', async () => {
    const calls: any[] = [];
    const ok = resendMailer('key123', 'Hub <hi@hub.test>', (async (u: string, init: any) => (calls.push([u, init]), new Response('{}', { status: 200 }))) as any);
    await ok.send({ to: 'a@b.test', subject: 'S', text: 'T' });
    await ok.send({ to: 'a@b.test', subject: 'S', text: 'T', headers: { 'List-Unsubscribe': '<https://x.test/u>' } });
    expect(JSON.parse(calls[1][1].body).headers).toEqual({ 'List-Unsubscribe': '<https://x.test/u>' });
    expect(calls[0][0]).toBe('https://api.resend.com/emails');
    expect(calls[0][1].headers.authorization).toBe('Bearer key123');
    expect(JSON.parse(calls[0][1].body)).toEqual({ from: 'Hub <hi@hub.test>', to: ['a@b.test'], subject: 'S', text: 'T' });
    const bad = resendMailer('k', 'f', (async () => new Response('no', { status: 429 })) as any);
    await expect(bad.send({ to: 'a@b.test', subject: 'S', text: 'T' })).rejects.toThrow(/429/);
  });
});

describe('review fixes that need no database', () => {
  it('buckets IPv6 by /64 so a whole range counts as one client', () => {
    expect(ipBucket('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2');
    expect(ipBucket('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2');
    expect(ipBucket('2001:db8::1')).toBe('2001:db8:0:0');
    expect(ipBucket('2001:DB8::ABCD:1')).toBe('2001:db8:0:0');
    expect(ipBucket('::1')).toBe('0:0:0:0');
    expect(ipBucket('::ffff:203.0.113.9')).toBe('203.0.113.9');
    expect(ipBucket('203.0.113.9')).toBe('203.0.113.9');
    expect(ipBucket('2001:db8:1:2::1')).toBe(ipBucket('2001:db8:1:2:dead:beef:0:7'));
  });
  it('masks an email enough to recognise it but not to harvest it', () => {
    expect(maskEmail('tester@example.test')).toBe('t***@e***.test');
    expect(maskEmail('jane.doe@gmail.com')).toBe('j***@g***.com');
    expect(maskEmail('a@b.co.uk')).toBe('a***@b***.co.uk');
  });
  it('turns non-ASCII redirect targets into safe escapes instead of crashing the redirect', () => {
    expect(safeNext('/é')).toBe('/%C3%A9');
    expect(safeNext('/search?q=café')).toBe('/search?q=caf%C3%A9');
    expect(() => new Headers({ location: safeNext('/é\u2603') })).not.toThrow();
  });
});

describe('redirect targets (no database needed)', () => {
  it('allows only paths on this site', () => {
    expect(safeNext('/for-you')).toBe('/for-you');
    expect(safeNext('/opportunities?family=data&page=2')).toBe('/opportunities?family=data&page=2');
    for (const bad of ['//evil.test', '/\\evil.test', 'https://evil.test', 'http://evil.test/x', 'javascript:alert(1)', '\\evil.test', '', 'evil.test', '/\u0000x', '/a\r\nSet-Cookie: x=1', '///evil.test']) {
      expect(safeNext(bad, '/safe'), JSON.stringify(bad)).toBe('/safe');
    }
    expect(safeNext('/a%0d%0ab')).toBe('/a%0d%0ab'); // percent-encoded is inert text, not a header break
    expect(safeNext(null, '/x')).toBe('/x');
    expect(safeNext(undefined)).toBe('/');
  });
});

describe('profile input is cleaned, not trusted (no database needed)', () => {
  it('drops unknown values and clamps numbers', () => {
    const p = sanitiseProfile({
      roles: ['data', 'bogus', 'ai_ml'], locations: ['London', ' london ', 'x'.repeat(100), ''], workModes: ['remote', 'moon'],
      employmentTypes: ['full_time', 'x'], level: 'senior', skills: ['Python', 'python', 'SQL'], yearsExperience: '7', needsSponsorship: 'yes',
      minSalary: '60000', hideRefusals: 'on'
    });
    expect(p.roles).toEqual(['data', 'ai_ml']);
    expect(p.locations).toEqual(['London', 'x'.repeat(40)]); // de-duplicated ignoring case, trimmed to 40
    expect(p.workModes).toEqual(['remote']);
    expect(p.employmentTypes).toEqual(['full_time']);
    expect(p.skills).toEqual(['Python', 'SQL']);
    expect(p.yearsExperience).toBe(7);
    expect(p.minSalary).toBe(60000);
    expect(p.hideRefusals).toBe(true);
  });
  it('rejects out-of-range and non-numeric values and unknown choices', () => {
    const p = sanitiseProfile({ level: 'god', needsSponsorship: 'maybe', yearsExperience: '999', minSalary: 'lots' });
    expect(p).toMatchObject({ level: null, needsSponsorship: null, yearsExperience: null, minSalary: null, hideRefusals: false });
  });
  it('caps list lengths and strips control characters', () => {
    const p = sanitiseProfile({ skills: Array.from({ length: 80 }, (_, i) => `s${i}`), locations: ['Leeds\u0000\n'] });
    expect(p.skills).toHaveLength(30);
    expect(p.locations).toEqual(['Leeds']);
    expect(splitList('python, sql ; react\n go')).toEqual(['python', 'sql', 'react', 'go']);
  });
});

describe.skipIf(!up)('sign-in, sessions and data (needs the dev database)', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(() => {
    sent = [];
  });

  it('emails a link, stores only a hash, and answers the same for any address', async () => {
    const r = await requestLogin(sql, cfg(), mail('a'), '1.2.3.4');
    expect(r).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(mail('a'));
    const token = tokenFrom(sent[0]);
    const rows = await sql`select token_hash, requested_ip_hash from login_tokens where email = ${mail('a')}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(sha256(token));
    expect(JSON.stringify(rows)).not.toContain(token); // the raw token is not in the database
    expect(rows[0].requested_ip_hash).not.toContain('1.2.3.4');
    expect(await requestLogin(sql, cfg(), 'not an email', '1.2.3.4')).toEqual({ ok: false, reason: 'invalid_email' });
  });

  it('signs in once; the same link never works twice', async () => {
    await requestLogin(sql, cfg(), mail('b'), '1.2.3.5');
    const token = tokenFrom(sent[0]);
    const v = await verifyLogin(sql, {}, token, 'test-agent');
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.isNew).toBe(true);
    expect(await verifyLogin(sql, {}, token)).toEqual({ ok: false });
    // A second sign-in for the same address finds the same user.
    sent = [];
    await requestLogin(sql, cfg(), mail('b').toUpperCase(), '1.2.3.5');
    const v2 = await verifyLogin(sql, {}, tokenFrom(sent[0]));
    expect(v2.ok && v2.userId).toBe(v.userId);
    expect(v2.ok && v2.isNew).toBe(false);
  });

  it('two simultaneous attempts with one link produce exactly one session', async () => {
    await requestLogin(sql, cfg(), mail('race'), '1.2.3.6');
    const token = tokenFrom(sent[0]);
    const results = await Promise.all([verifyLogin(sql, {}, token), verifyLogin(sql, {}, token), verifyLogin(sql, {}, token)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it('rejects expired, garbage and truncated tokens', async () => {
    await requestLogin(sql, cfg({ tokenTtlMs: 1000 }), mail('exp'), '1.2.3.7');
    const token = tokenFrom(sent[0]);
    await sql`update login_tokens set expires_at = now() - interval '1 second' where email = ${mail('exp')}`;
    expect(await verifyLogin(sql, {}, token)).toEqual({ ok: false });
    for (const bad of ['', 'short', 'x'.repeat(300), 'A'.repeat(43)]) expect(await verifyLogin(sql, {}, bad)).toEqual({ ok: false });
  });

  it('a newer link retires older unused links for the same address', async () => {
    await requestLogin(sql, cfg(), mail('two'), '1.2.3.8');
    await requestLogin(sql, cfg(), mail('two'), '1.2.3.8');
    const [first, second] = [tokenFrom(sent[0]), tokenFrom(sent[1])];
    expect((await verifyLogin(sql, {}, second)).ok).toBe(true);
    expect(await verifyLogin(sql, {}, first)).toEqual({ ok: false });
  });

  it('rate limits per address, per IP and per day, silently', async () => {
    for (let i = 0; i < 8; i++) expect(await requestLogin(sql, cfg({ maxPerEmailPerHour: 3 }), mail('rl'), `9.9.9.${i}`)).toEqual({ ok: true });
    expect(sent.filter((m) => m.to === mail('rl'))).toHaveLength(3); // the rest were dropped, with the same response
    sent = [];
    for (let i = 0; i < 6; i++) await requestLogin(sql, cfg({ maxPerIpPerHour: 2 }), mail(`ip${i}`), '8.8.8.8');
    expect(sent).toHaveLength(2);
    sent = [];
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from login_tokens where created_at > now() - interval '1 day'`;
    await requestLogin(sql, cfg({ maxPerDay: n }), mail('day'), '7.7.7.7');
    expect(sent).toHaveLength(0);
  });

  it('carries a safe "next" page through the emailed link, and drops an unsafe one', async () => {
    await requestLogin(sql, cfg(), mail('nx1'), '3.3.3.1', { next: '/for-you?page=2' });
    expect(new URL(sent[0].text.match(/https:\/\/\S+/)![0]).searchParams.get('next')).toBe('/for-you?page=2');
    await requestLogin(sql, cfg(), mail('nx2'), '3.3.3.2', { next: '//evil.test' });
    expect(sent[1].text).not.toContain('next=');
    expect(sent[1].text).not.toContain('evil');
  });

  it('shows which account a link is for without using it up', async () => {
    await requestLogin(sql, cfg(), mail('peek'), '3.3.3.3');
    const token = tokenFrom(sent[0]);
    expect(await peekLogin(sql, token)).toEqual({ maskedEmail: maskEmail(mail('peek')) });
    expect(await peekLogin(sql, token)).toEqual({ maskedEmail: maskEmail(mail('peek')) }); // still there: peeking is free
    expect((await verifyLogin(sql, {}, token)).ok).toBe(true); // and the link still works afterwards
    expect(await peekLogin(sql, token)).toBeNull(); // spent
    expect(await peekLogin(sql, 'x'.repeat(43))).toBeNull();
    expect(await peekLogin(sql, '')).toBeNull();
  });

  it('an attacker hammering a victim from one IP cannot stop the victim signing in from another', async () => {
    const victim = mail('victim');
    for (let i = 0; i < 6; i++) await requestLogin(sql, cfg(), victim, '66.66.66.66'); // attacker, one address
    expect(sent.filter((m) => m.to === victim)).toHaveLength(3); // capped at 3 from that address
    sent = [];
    expect(await requestLogin(sql, cfg(), victim, '203.0.113.50')).toEqual({ ok: true }); // the real owner, elsewhere
    expect(sent.filter((m) => m.to === victim)).toHaveLength(1); // still gets a link
  });

  it('counts a whole IPv6 /64 as one client for the per-IP limit', async () => {
    for (let i = 0; i < 6; i++) await requestLogin(sql, cfg({ maxPerIpPerHour: 2 }), mail(`v6-${i}`), `2001:db8:77:88:${i}:${i}:${i}:${i}`);
    expect(sent).toHaveLength(2);
  });

  it('a failing mailer does not break the response or leak the link', async () => {
    const logs: string[] = [];
    const r = await requestLogin(sql, cfg({ mailer: { send: async () => { throw new Error('smtp down'); } }, log: (m) => logs.push(m) }), mail('fail'), '6.6.6.6');
    expect(r).toEqual({ ok: true });
    expect(logs.join(' ')).toContain('smtp down');
    expect(logs.join(' ')).not.toMatch(/token=/);
  });

  it('sessions: read-only when recently used, refreshed when stale, and capped at 90 days', async () => {
    await requestLogin(sql, cfg(), mail('slide'), '2.2.2.2');
    const v = await verifyLogin(sql, {}, tokenFrom(sent[0]));
    if (!v.ok) throw new Error('sign-in failed');
    const snap = async () => (await sql`select last_seen_at::text as l, expires_at::text as e from sessions where user_id = ${v.userId}`)[0];
    const before = await snap();
    for (let i = 0; i < 3; i++) await getSession(sql, {}, v.sessionToken);
    expect(await snap()).toEqual(before); // a recently used session is not rewritten on every request

    await sql`update sessions set last_seen_at = now() - interval '3 days', expires_at = now() + interval '5 days' where user_id = ${v.userId}`;
    const stale = await snap();
    await getSession(sql, {}, v.sessionToken);
    const after = await snap();
    expect(after.l).not.toBe(stale.l); // refreshed...
    expect(new Date(after.e).getTime()).toBeGreaterThan(new Date(stale.e).getTime() + 20 * 86400000); // ...and slid forward

    // Sliding expiry can never push a session past 90 days from sign-in.
    await sql`update sessions set created_at = now() - interval '80 days', last_seen_at = now() - interval '2 days', expires_at = now() + interval '1 day' where user_id = ${v.userId}`;
    await getSession(sql, {}, v.sessionToken);
    const [{ capped }] = await sql<{ capped: boolean }[]>`select expires_at <= created_at + interval '90 days' + interval '1 second' as capped from sessions where user_id = ${v.userId}`;
    expect(capped).toBe(true);

    await sql`update sessions set created_at = now() - interval '91 days' where user_id = ${v.userId}`;
    expect(await getSession(sql, {}, v.sessionToken)).toBeNull(); // too old, even though it was just used
  });

  it('sessions: found by cookie value, stored hashed, expire, and can be ended', async () => {
    await requestLogin(sql, cfg(), mail('s'), '5.5.5.5');
    const v = await verifyLogin(sql, {}, tokenFrom(sent[0]), 'ua');
    if (!v.ok) throw new Error('sign-in failed');
    const [row] = await sql`select token_hash from sessions where user_id = ${v.userId}`;
    expect(row.token_hash).toBe(sha256(v.sessionToken));
    expect(await getSession(sql, {}, v.sessionToken)).toEqual({ userId: v.userId, email: mail('s') });
    expect(await getSession(sql, {}, 'x'.repeat(43))).toBeNull();
    expect(await getSession(sql, {}, undefined)).toBeNull();
    await sql`update sessions set expires_at = now() - interval '1 minute' where user_id = ${v.userId}`;
    expect(await getSession(sql, {}, v.sessionToken)).toBeNull();
    await endSession(sql, v.sessionToken);
    expect(await getSession(sql, {}, v.sessionToken)).toBeNull();
  });

  it('keeps one user’s profile, saves and exports separate from another’s, and deletes everything on request', async () => {
    const signIn = async (n: string) => {
      await requestLogin(sql, cfg(), mail(n), '4.4.4.4');
      const v = await verifyLogin(sql, {}, tokenFrom(sent[sent.length - 1]));
      if (!v.ok) throw new Error('sign-in failed');
      return v.userId;
    };
    const alice = await signIn('alice');
    const bob = await signIn('bob');
    const [org] = await sql`select id from orgs limit 1`;
    await saveProfile(sql, alice, sanitiseProfile({ roles: ['data'], locations: ['Leeds'], skills: ['python'], needsSponsorship: 'yes', minSalary: 50000, hideRefusals: true }));
    expect((await getProfile(sql, alice)).profile).toMatchObject({ roles: ['data'], locations: ['Leeds'], needsSponsorship: 'yes', minSalary: 50000 });
    expect((await getProfile(sql, bob)).exists).toBe(false);

    await setSavedOrg(sql, alice, Number(org.id), true);
    expect((await savedOrgIds(sql, alice, [Number(org.id)])).has(Number(org.id))).toBe(true);
    expect((await savedOrgIds(sql, bob, [Number(org.id)])).size).toBe(0);
    await setSavedOrg(sql, alice, 999999999, true); // an id that does not exist creates nothing
    expect((await sql`select count(*)::int as n from saved_orgs where user_id = ${alice}`)[0].n).toBe(1);

    const opps = await sql`select id from opportunities limit 2`;
    if (opps.length) {
      const id = Number(opps[0].id);
      await setMark(sql, alice, id, 'saved');
      await setMark(sql, alice, id, 'applied'); // changes the mark, still one row
      expect((await marksFor(sql, alice, [id])).get(id)).toBe('applied');
      expect((await marksFor(sql, bob, [id])).size).toBe(0);
      await setMark(sql, bob, id, 'dismissed');
      expect((await marksFor(sql, alice, [id])).get(id)).toBe('applied'); // bob's mark did not touch alice's
      await setMark(sql, alice, 123456789012, 'saved'); // unknown opportunity: no row
      expect((await sql`select count(*)::int as n from opportunity_marks where user_id = ${alice}`)[0].n).toBe(1);
    }

    const data: any = await exportUserData(sql, alice);
    expect(data.account.email).toBe(mail('alice'));
    expect(data.profile.roles).toEqual(['data']);
    expect(data.signedInDevices.length).toBeGreaterThan(0); // the data-access request covers signed-in devices too
    expect(JSON.stringify(data)).not.toMatch(/token_hash|password/);
    expect(JSON.stringify(data)).not.toContain(mail('bob'));

    const [ses] = await sql`select count(*)::int as n from sessions where user_id = ${alice}`;
    expect(ses.n).toBeGreaterThan(0);
    expect(await deleteAccount(sql, alice)).toBe(true);
    for (const t of ['sessions', 'user_profiles', 'opportunity_marks', 'saved_orgs']) {
      expect((await sql.unsafe(`select count(*)::int as n from ${t} where user_id = '${alice}'`))[0].n, t).toBe(0);
    }
    expect((await sql`select count(*)::int as n from login_tokens where email = ${mail('alice')}`)[0].n).toBe(0);
    expect((await sql`select count(*)::int as n from users where id = ${alice}`)[0].n).toBe(0);
    expect((await getProfile(sql, bob)).exists === false && (await sql`select count(*)::int as n from users where id = ${bob}`)[0].n === 1).toBe(true); // bob is untouched
    expect(await deleteAccount(sql, alice)).toBe(false);
  });
});

import { unsubscribeToken, verifyUnsubscribeToken, setDigest, buildDigest, sendDigests, rankForUser } from '../src/index.ts';

describe('unsubscribe tokens (no database needed)', () => {
  const id = '3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69';
  it('round-trips, and cannot be forged or reused for another user', () => {
    const t = unsubscribeToken(id, 'secret-a');
    expect(verifyUnsubscribeToken(t, 'secret-a')).toBe(id);
    expect(verifyUnsubscribeToken(t, 'secret-b')).toBeNull(); // different key
    const other = '9c1e2d3c-4b5a-4f69-8a7b-0e1d2c3b4a58';
    expect(verifyUnsubscribeToken(`${other}.${t.split('.')[1]}`, 'secret-a')).toBeNull(); // another user's id with this MAC
    for (const bad of ['', 'x', `${id}.`, `${id}.AAAA`, `not-a-uuid.${t.split('.')[1]}`, `${t}x`, '..']) expect(verifyUnsubscribeToken(bad, 'secret-a'), bad).toBeNull();
  });
});

describe.skipIf(!up)('weekly digest (needs the dev database)', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(() => { sent = []; });
  const cfgD = (over = {}) => ({ mailer: { send: async (m: Mail) => void sent.push(m) }, secret: 'digest-secret', baseUrl: 'https://hub.test', ...over });
  const mkUser = async (n: string, opts: { optIn?: boolean; profile?: Record<string, unknown> | null; lastDigest?: string | null } = {}) => {
    await requestLogin(sql, cfg(), mail(n), '5.5.5.9');
    const v = await verifyLogin(sql, {}, tokenFrom(sent[sent.length - 1]));
    if (!v.ok) throw new Error('sign-in failed');
    if (opts.optIn) await setDigest(sql, v.userId, true);
    if (opts.profile !== null) await saveProfile(sql, v.userId, sanitiseProfile(opts.profile ?? { roles: ['software', 'data', 'ai_ml', 'product', 'design', 'cloud_devops', 'cybersecurity', 'adjacent', 'it_support'], skills: ['python'], level: 'senior' }));
    if (opts.lastDigest !== undefined) await sql`update users set last_digest_at = ${opts.lastDigest === null ? null : sql`now() - ${opts.lastDigest}::interval`} where id = ${v.userId}`;
    sent = [];
    return v.userId;
  };

  it('only emails people who opted in, with a working unsubscribe link, and records the send', async () => {
    const yes = await mkUser('dg-yes', { optIn: true });
    const no = await mkUser('dg-no', { optIn: false });
    const [live] = await sql`select count(*)::int as n from opportunities where status = 'live'`;
    // Freshly found roles are what the digest is for; make sure some exist for this test.
    await sql`update opportunities set first_seen_at = now() - interval '1 day' where id in (select id from opportunities where status = 'live' limit 8)`;
    const r = await sendDigests(sql, cfgD());
    expect(r.failed).toBe(0);
    const mine = sent.filter((m) => m.to === mail('dg-yes'));
    if (live.n > 0) {
      expect(mine).toHaveLength(1);
      expect(mine[0].text).toMatch(/% match\)/);
      expect(mine[0].text).toMatch(/Apply: https?:\/\//);
      const listing = mine[0].text.split('Every employer')[0]; // everything before the disclaimer
      expect(listing).not.toMatch(/is sponsored|will sponsor|guaranteed/i); // the listing never claims a role is sponsored
      expect(mine[0].text).toMatch(/does not mean a particular role is sponsored/); // and the disclaimer is there
      const link = mine[0].text.match(/unsubscribe\?token=(\S+)/)![1];
      expect(verifyUnsubscribeToken(decodeURIComponent(link), 'digest-secret')).toBe(yes);
      // Machine-readable one-click unsubscribe, as Gmail and Yahoo require from bulk senders.
      expect(mine[0].headers?.['List-Unsubscribe']).toMatch(/^<https:\/\/hub\.test\/unsubscribe\/one-click\?token=/);
      expect(mine[0].headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
      expect((await sql`select last_digest_at from users where id = ${yes}`)[0].last_digest_at).not.toBeNull();
    }
    expect(sent.some((m) => m.to === mail('dg-no'))).toBe(false);
    expect((await sql`select last_digest_at from users where id = ${no}`)[0].last_digest_at).toBeNull();
  });

  it('sends at most one a week, and not at all to someone with no preferences', async () => {
    await mkUser('dg-recent', { optIn: true, lastDigest: '2 days' });
    await mkUser('dg-empty', { optIn: true, profile: null });
    await sql`update opportunities set first_seen_at = now() - interval '1 day' where id in (select id from opportunities where status = 'live' limit 8)`;
    await sendDigests(sql, cfgD());
    expect(sent.some((m) => m.to === mail('dg-recent'))).toBe(false); // sent 2 days ago
    expect(sent.some((m) => m.to === mail('dg-empty'))).toBe(false); // nothing to rank by
  });

  it('does not mark someone as sent when there was nothing to send, so the next run tries again', async () => {
    const uid = await mkUser('dg-nothing', { optIn: true, profile: { roles: ['product'], locations: ['Nowhereville'], skills: ['cobol'], level: 'executive' } });
    await sql`update opportunities set first_seen_at = now() - interval '30 days'`; // nothing new in the last week
    const r = await sendDigests(sql, cfgD());
    expect(sent.some((m) => m.to === mail('dg-nothing'))).toBe(false);
    expect(r.nothingToSend).toBeGreaterThan(0);
    expect((await sql`select last_digest_at from users where id = ${uid}`)[0].last_digest_at).toBeNull();
  });

  it('a failing mailer is counted, not thrown, does not mark the user as sent, and does not log their address', async () => {
    await mkUser('dg-fail', { optIn: true });
    await sql`update opportunities set first_seen_at = now() - interval '1 day' where id in (select id from opportunities where status = 'live' limit 8)`;
    const logs: string[] = [];
    const r = await sendDigests(sql, cfgD({ mailer: { send: async () => { throw new Error('mail provider 500'); } }, log: (m: string) => logs.push(m) }));
    expect(logs.join(' ')).not.toContain(mail('dg-fail'));
    const [u] = await sql`select last_digest_at from users where email = ${mail('dg-fail')}`;
    expect(u.last_digest_at).toBeNull();
    expect(r.sent).toBe(0);
  });

  it('ranks for a one-role profile (a single-element array parameter)', async () => {
    const uid = await mkUser('dg-onerole', { optIn: false, profile: { roles: ['data'], skills: ['sql'] } });
    const { profile } = await getProfile(sql, uid);
    expect(profile.roles).toEqual(['data']);
    const r = await rankForUser(sql, uid, profile, 1);
    expect(r.items.every((i) => i.row.role_family === 'data')).toBe(true);
  });

  it('two overlapping runs cannot email the same person twice', async () => {
    await mkUser('dg-race', { optIn: true });
    await sql`update opportunities set first_seen_at = now() - interval '1 day' where id in (select id from opportunities where status = 'live' limit 8)`;
    await Promise.all([sendDigests(sql, cfgD()), sendDigests(sql, cfgD())]);
    expect(sent.filter((m) => m.to === mail('dg-race')).length).toBeLessThanOrEqual(1);
  });

  it('only includes roles found since the previous digest', async () => {
    const uid = await mkUser('dg-since', { optIn: true, lastDigest: '6 days 1 hour' });
    await sql`update opportunities set first_seen_at = now() - interval '7 days' where status = 'live'`; // all older than the last digest
    await sendDigests(sql, cfgD());
    expect(sent.some((m) => m.to === mail('dg-since'))).toBe(false); // nothing new since then: no repeat
    void uid;
  });

  it('respects the per-run cap', async () => {
    for (const n of ['cap1', 'cap2', 'cap3']) await mkUser(`dg-${n}`, { optIn: true });
    const r = await sendDigests(sql, cfgD({ maxPerRun: 2 }));
    expect(r.due).toBeLessThanOrEqual(2);
  });
});

// One shared connection for the whole file, closed once everything has run.
afterAll(async () => {
  await cleanup().catch(() => {});
  await sql.end();
});
