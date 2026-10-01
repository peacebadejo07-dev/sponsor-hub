import type { Sql } from 'postgres';
import { refreshSectors } from './sectors.ts';

/** Keep the free-tier database small and free of stale data. Returns what was removed. */
export async function maintenance(sql: Sql) {
  // Closed roles stay visible for a while ("this one has closed"), then go, unless someone saved or applied to them.
  const closed = await sql`
    delete from opportunities where status = 'expired' and expired_at < now() - interval '60 days'
      and id not in (select opportunity_id from opportunity_marks where mark in ('saved', 'applied'))
    returning id`;
  const scans = await sql`delete from org_scans where started_at < now() - interval '30 days' returning id`;
  const runs = await sql`delete from scan_runs where started_at < now() - interval '180 days' returning id`;
  const tokens = await sql`delete from login_tokens where created_at < now() - interval '2 days' returning id`;
  const sessions = await sql`delete from sessions where expires_at < now() returning id`;
  const sectors = await refreshSectors(sql); // after the scan, so live job families are current
  return { sectorsChanged: sectors.changed, closedRolesRemoved: closed.length, scanLogRemoved: scans.length, runLogRemoved: runs.length, loginTokensRemoved: tokens.length, sessionsRemoved: sessions.length };
}
