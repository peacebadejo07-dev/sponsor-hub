import type { Sql } from 'postgres';
import { scoreMatch, type MatchableJob, type MatchResult, type UserProfile } from '@sponsored/core';

export const FOR_YOU_PAGE = 20;
const CANDIDATE_CAP = 400;

export interface RankedRow {
  id: number;
  org_id: number;
  org_name: string;
  title: string;
  role_family: string;
  seniority: string | null;
  city: string | null;
  location_raw: string;
  work_mode: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  skills: string[];
  years_experience: number | null;
  apply_url: string;
  sponsorship_signal: string;
  sponsorship_snippet: string | null;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  changed_at: string | null;
  stale_reason: string | null;
  status: string;
  provenance: Record<string, { status: string }>;
}

export function ranked(sql: Sql) {
  return sql`id, org_id, org_name, title, role_family, seniority, city, location_raw, work_mode, employment_type, salary_min, salary_max,
  salary_currency, salary_period, skills, years_experience, apply_url, sponsorship_signal, sponsorship_snippet, posted_at, first_seen_at, last_seen_at,
  changed_at, stale_reason, status, provenance`;
}

export interface RankOptions {
  /** Only consider roles first seen within this many hours (for "new for you" and the digest). */
  sinceHours?: number;
  minScore?: number;
}

/**
 * Rank live opportunities for one person. SQL narrows to a few hundred recent candidates (the database does the heavy work,
 * which matters on free hosting with tiny CPU limits); scoring and the explanations happen here, on those rows only.
 */
export async function rankForUser(sql: Sql, userId: string, profile: UserProfile, page = 1, opts: RankOptions = {}) {
  const candidates = await sql<RankedRow[]>`
    select ${ranked(sql)} from opportunities_view
    where status = 'live'
      and id not in (select opportunity_id from opportunity_marks where user_id = ${userId} and mark = 'dismissed')
      ${profile.roles.length ? sql`and role_family = any(${sql.array(profile.roles, 1009)}::text[])` : sql``}
      ${opts.sinceHours ? sql`and first_seen_at > now() - make_interval(hours => ${opts.sinceHours})` : sql``}
    order by coalesce(posted_at, first_seen_at) desc, id desc
    limit ${CANDIDATE_CAP}`;
  const scored: { row: RankedRow; match: MatchResult }[] = [];
  let hiddenCount = 0;
  for (const row of candidates) {
    const match = scoreMatch(profile, row as unknown as MatchableJob);
    if (match.hidden) hiddenCount++;
    else if (!opts.minScore || match.score >= opts.minScore) scored.push({ row, match });
  }
  scored.sort((a, b) => b.match.score - a.match.score || +new Date(b.row.first_seen_at) - +new Date(a.row.first_seen_at));
  const start = (page - 1) * FOR_YOU_PAGE;
  return { items: scored.slice(start, start + FOR_YOU_PAGE), total: scored.length, hiddenCount, capped: candidates.length >= CANDIDATE_CAP };
}
