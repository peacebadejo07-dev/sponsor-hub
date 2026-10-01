import type { UserProfile } from '@sponsored/core';
import { FOR_YOU_PAGE, rankForUser as rank, ranked, type RankedRow, type RankOptions } from '@sponsored/accounts';
import { sql } from './db';

export type { RankedRow };

export { FOR_YOU_PAGE };

export const rankForUser = (userId: string, profile: UserProfile, page: number, opts?: RankOptions) => rank(sql, userId, profile, page, opts);

export async function savedForUser(userId: string) {
  const rows = await sql<(RankedRow & { mark: string })[]>`
    select ${ranked(sql)}, m.mark from opportunity_marks m
    join opportunities_view v on v.id = m.opportunity_id
    where m.user_id = ${userId} order by m.created_at desc`;
  const orgs = await sql<{ id: number; name: string; town: string; county: string; website: string | null; careers_url: string | null; live: number }[]>`
    select o.id, o.name, o.town, o.county, p.website, p.careers_url,
           (select count(*)::int from opportunities x where x.name_key = o.name_key and x.status = 'live') as live
    from saved_orgs s join orgs o on o.id = s.org_id left join org_profiles p on p.name_key = o.name_key
    where s.user_id = ${userId} order by s.created_at desc`;
  return { rows, orgs };
}
