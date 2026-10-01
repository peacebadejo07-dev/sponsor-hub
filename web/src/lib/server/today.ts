import { ranked, type RankedRow } from '@sponsored/accounts';
import { sql } from './db';

const NEW_HOURS = 36;

export async function lastRuns(limit = 14) {
  return sql<{ id: number; run_date: string; trigger: string; status: string; started_at: string; finished_at: string | null; seconds: number | null; steps: { name: string; status: string; seconds: number }[]; summary: Record<string, number | boolean> }[]>`
    select id, run_date::text, trigger, status, started_at::text, finished_at::text,
           extract(epoch from finished_at - started_at)::int as seconds, steps, summary
    from scan_runs order by started_at desc limit ${limit}`;
}

export async function todaySummary() {
  const [lastOk] = await sql<{ finished_at: string; summary: Record<string, number | boolean> }[]>`
    select finished_at::text, summary from scan_runs where status in ('ok', 'partial') order by finished_at desc limit 1`;
  const [counts] = await sql<{ fresh: number; updated: number; closed: number; live: number; employers: number }[]>`
    select count(*) filter (where status = 'live' and first_seen_at > now() - make_interval(hours => ${NEW_HOURS}))::int as fresh,
           count(*) filter (where status = 'live' and changed_at > now() - make_interval(hours => ${NEW_HOURS}) and first_seen_at <= now() - make_interval(hours => ${NEW_HOURS}))::int as updated,
           count(*) filter (where status = 'expired' and expired_at > now() - interval '72 hours')::int as closed,
           count(*) filter (where status = 'live')::int as live,
           count(distinct name_key) filter (where status = 'live')::int as employers
    from opportunities`;
  return { lastOk: lastOk ?? null, ...counts };
}

export async function newRoles(limit = 30) {
  return sql<RankedRow[]>`
    select ${ranked(sql)} from opportunities_view
    where status = 'live' and first_seen_at > now() - make_interval(hours => ${NEW_HOURS})
    order by first_seen_at desc, id desc limit ${limit}`;
}

export async function updatedRoles(limit = 15) {
  return sql<RankedRow[]>`
    select ${ranked(sql)} from opportunities_view
    where status = 'live' and changed_at > now() - make_interval(hours => ${NEW_HOURS}) and first_seen_at <= now() - make_interval(hours => ${NEW_HOURS})
    order by changed_at desc limit ${limit}`;
}

/** Roles this person saved or applied to that changed or closed recently. */
export async function myWatchlistChanges(userId: string) {
  return sql<(RankedRow & { mark: string })[]>`
    select ${ranked(sql)}, m.mark from opportunity_marks m join opportunities_view v on v.id = m.opportunity_id
    where m.user_id = ${userId} and m.mark in ('saved', 'applied')
      and ((v.status = 'expired' and v.expired_at > now() - interval '14 days') or v.changed_at > now() - interval '3 days')
    order by coalesce(v.expired_at, v.changed_at) desc limit 20`;
}

/** New roles at organisations this person follows. */
export async function followedOrgsNewRoles(userId: string) {
  return sql<RankedRow[]>`
    select ${ranked(sql)} from opportunities_view v
    where v.status = 'live' and v.first_seen_at > now() - interval '7 days'
      and v.name_key in (select o.name_key from saved_orgs s join orgs o on o.id = s.org_id where s.user_id = ${userId})
    order by v.first_seen_at desc limit 20`;
}

export async function coverage() {
  const [c] = await sql<{ researched: number; websites: number; boards: number; employers_with_roles: number; live: number; failing: number }[]>`
    select (select count(*) from org_profiles where resolve_status <> 'pending')::int as researched,
           (select count(*) from org_profiles where resolve_status = 'resolved')::int as websites,
           (select count(*) from org_profiles where ats_type is not null)::int as boards,
           (select count(distinct name_key) from opportunities where status = 'live')::int as employers_with_roles,
           (select count(*) from opportunities where status = 'live')::int as live,
           (select count(*) from (select distinct on (name_key) ok from org_scans order by name_key, started_at desc) x where not ok)::int as failing`;
  const byPlatform = await sql<{ ats_type: string; boards: number }[]>`select ats_type, count(*)::int as boards from org_profiles where ats_type is not null group by 1 order by 2 desc`;
  return { ...c, byPlatform };
}
