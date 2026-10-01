import type { Sql } from 'postgres';

export type Mark = 'saved' | 'applied' | 'dismissed';
export const MARKS: Mark[] = ['saved', 'applied', 'dismissed'];

/** Every function takes the user id and scopes by it: a user can only ever touch their own rows. */
export async function setMark(sql: Sql, userId: string, opportunityId: number, mark: Mark | null): Promise<void> {
  if (!Number.isInteger(opportunityId) || opportunityId < 1) return;
  if (mark === null) {
    await sql`delete from opportunity_marks where user_id = ${userId} and opportunity_id = ${opportunityId}`;
    return;
  }
  if (!MARKS.includes(mark)) return;
  // Insert only for opportunities that exist, so a made-up id cannot create a dangling row.
  await sql`
    insert into opportunity_marks (user_id, opportunity_id, mark)
    select ${userId}, id, ${mark} from opportunities where id = ${opportunityId}
    on conflict (user_id, opportunity_id) do update set mark = excluded.mark, created_at = now()`;
}

export async function marksFor(sql: Sql, userId: string, opportunityIds: number[]): Promise<Map<number, Mark>> {
  if (!opportunityIds.length) return new Map();
  const rows = await sql<{ opportunity_id: string; mark: Mark }[]>`
    select opportunity_id, mark from opportunity_marks where user_id = ${userId} and opportunity_id in ${sql(opportunityIds)}`;
  return new Map(rows.map((r) => [Number(r.opportunity_id), r.mark]));
}

export async function setSavedOrg(sql: Sql, userId: string, orgId: number, saved: boolean): Promise<void> {
  if (!Number.isInteger(orgId) || orgId < 1) return;
  if (!saved) {
    await sql`delete from saved_orgs where user_id = ${userId} and org_id = ${orgId}`;
    return;
  }
  await sql`insert into saved_orgs (user_id, org_id) select ${userId}, id from orgs where id = ${orgId} on conflict do nothing`;
}

export async function savedOrgIds(sql: Sql, userId: string, orgIds: number[]): Promise<Set<number>> {
  if (!orgIds.length) return new Set();
  const rows = await sql<{ org_id: string }[]>`select org_id from saved_orgs where user_id = ${userId} and org_id in ${sql(orgIds)}`;
  return new Set(rows.map((r) => Number(r.org_id)));
}

/** Everything we hold about a user, for the "download my data" request. Contains no token hashes. */
export async function exportUserData(sql: Sql, userId: string) {
  const [account] = await sql`select email, created_at, last_login_at from users where id = ${userId}`;
  if (!account) return null;
  const [profile] = await sql`select roles, locations, work_modes, employment_types, level, skills, years_experience, needs_sponsorship, min_salary, hide_refusals, updated_at from user_profiles where user_id = ${userId}`;
  const marks = await sql`
    select m.mark, m.created_at, o.title, o.apply_url, n.name as employer
    from opportunity_marks m join opportunities o on o.id = m.opportunity_id
    join lateral (select name from orgs where name_key = o.name_key order by id limit 1) n on true
    where m.user_id = ${userId} order by m.created_at desc`;
  const orgs = await sql`select o.name, o.town, s.created_at from saved_orgs s join orgs o on o.id = s.org_id where s.user_id = ${userId} order by s.created_at desc`;
  const sessions = await sql`select created_at, last_seen_at, expires_at, user_agent from sessions where user_id = ${userId} order by created_at desc`;
  return { exportedAt: new Date().toISOString(), account, profile: profile ?? null, savedOpportunities: marks, savedOrganisations: orgs, signedInDevices: sessions };
}
