import type { Sql } from 'postgres';
import { EMPTY_PROFILE, ROLE_FAMILIES, type EmploymentType, type RoleFamily, type Seniority, type UserProfile } from '@sponsored/core';

const WORK = ['remote', 'hybrid', 'onsite'] as const;
const EMP: EmploymentType[] = ['full_time', 'part_time', 'contract', 'internship', 'temporary'];
const LEVELS: Seniority[] = ['entry', 'mid', 'senior', 'lead', 'principal', 'executive'];
const NEEDS = ['yes', 'no', 'unsure'] as const;

const strings = (v: unknown, max: number, len: number): string[] => {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];
  const out: string[] = [];
  for (const x of arr) {
    const s = String(x).replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, len);
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= max) break;
  }
  return out;
};
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T[] => strings(v, 20, 30).filter((x): x is T => (allowed as readonly string[]).includes(x));
const intOrNull = (v: unknown, min: number, max: number): number | null => {
  if (v === '' || v == null) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** Clean untrusted form input into a valid profile. Anything unrecognised is dropped, not guessed at. */
export function sanitiseProfile(input: Record<string, unknown>): UserProfile {
  const level = typeof input.level === 'string' && (LEVELS as string[]).includes(input.level) ? (input.level as Seniority) : null;
  const needs = typeof input.needsSponsorship === 'string' && (NEEDS as readonly string[]).includes(input.needsSponsorship) ? (input.needsSponsorship as UserProfile['needsSponsorship']) : null;
  return {
    roles: pick<RoleFamily>(input.roles, ROLE_FAMILIES),
    locations: strings(input.locations, 10, 40),
    workModes: pick(input.workModes, WORK) as UserProfile['workModes'],
    employmentTypes: pick(input.employmentTypes, EMP),
    level,
    skills: strings(input.skills, 30, 30),
    yearsExperience: intOrNull(input.yearsExperience, 0, 50),
    needsSponsorship: needs,
    minSalary: intOrNull(input.minSalary, 0, 1_000_000),
    hideRefusals: input.hideRefusals === true || input.hideRefusals === 'on' || input.hideRefusals === '1'
  };
}

/** "python, sql ; react" -> ['python','sql','react'] */
export const splitList = (s: string | null | undefined): string[] => (s ?? '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

export async function getProfile(sql: Sql, userId: string): Promise<{ profile: UserProfile; exists: boolean }> {
  const [r] = await sql`select * from user_profiles where user_id = ${userId}`;
  if (!r) return { profile: { ...EMPTY_PROFILE }, exists: false };
  return {
    exists: true,
    profile: {
      roles: r.roles, locations: r.locations, workModes: r.work_modes, employmentTypes: r.employment_types, level: r.level,
      skills: r.skills, yearsExperience: r.years_experience, needsSponsorship: r.needs_sponsorship, minSalary: r.min_salary,
      hideRefusals: r.hide_refusals
    }
  };
}

export async function saveProfile(sql: Sql, userId: string, p: UserProfile): Promise<void> {
  await sql`
    insert into user_profiles (user_id, roles, locations, work_modes, employment_types, level, skills, years_experience, needs_sponsorship, min_salary, hide_refusals, updated_at)
    values (${userId}, ${sql.array(p.roles)}, ${sql.array(p.locations)}, ${sql.array(p.workModes)}, ${sql.array(p.employmentTypes)}, ${p.level},
            ${sql.array(p.skills)}, ${p.yearsExperience}, ${p.needsSponsorship}, ${p.minSalary}, ${p.hideRefusals}, now())
    on conflict (user_id) do update set roles = excluded.roles, locations = excluded.locations, work_modes = excluded.work_modes,
      employment_types = excluded.employment_types, level = excluded.level, skills = excluded.skills,
      years_experience = excluded.years_experience, needs_sponsorship = excluded.needs_sponsorship,
      min_salary = excluded.min_salary, hide_refusals = excluded.hide_refusals, updated_at = now()`;
}
