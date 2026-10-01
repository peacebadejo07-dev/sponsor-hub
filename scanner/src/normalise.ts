import { createHash } from 'node:crypto';
import {
  safeHttpUrl, classifyRole, classifySeniority, extractSkills, extractYears, mentionsDegree, inferEmploymentType, inferWorkMode,
  isUkLocation, mapEmploymentType, parseSalary, sponsorshipSignal, ukCity, type RoleFamily
} from '@sponsored/core';
import type { RawJob, Source } from './types.ts';

export type Status = 'verified' | 'inferred' | 'unconfirmed';
export interface Prov {
  status: Status;
  source: string;
  detail?: string;
}

export interface OppRow {
  source: Source;
  external_id: string;
  title: string;
  role_family: RoleFamily;
  seniority: string | null;
  location_raw: string;
  city: string | null;
  work_mode: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  department: string | null;
  skills: string[];
  years_experience: number | null;
  degree_mentioned: boolean | null;
  apply_url: string;
  excerpt: string | null;
  sponsorship_signal: string;
  sponsorship_snippet: string | null;
  posted_at: Date | null;
  content_hash: string;
  provenance: Record<string, Prov>;
}

export type Skip = 'not_uk' | 'not_tech' | 'no_apply_url';

/** First, cheap checks that need no description. Returns the role family if the job is worth keeping. */
export function screen(raw: RawJob): { family: RoleFamily } | { skip: Skip } {
  if (!isUkLocation(raw.locations, raw.countryCodes)) return { skip: 'not_uk' };
  const family = classifyRole(raw.title, raw.department);
  if (!family) return { skip: 'not_tech' };
  return { family };
}

export function normalise(raw: RawJob, family: RoleFamily): OppRow | { skip: Skip } {
  const applyUrl = safeHttpUrl(raw.applyUrl);
  if (!applyUrl) return { skip: 'no_apply_url' }; // missing, or not an http(s) link (never store a javascript: URL)
  const text = raw.descriptionText ?? '';
  const prov: Record<string, Prov> = {
    role_family: { status: 'inferred', source: 'job title' }
  };

  // Salary: structured API data is verified; a range parsed out of the text is inferred.
  let salary = raw.salary;
  if (salary) prov.salary = { status: 'verified', source: 'job board pay field' };
  else {
    salary = text ? parseSalary(text) : null;
    prov.salary = salary
      ? { status: 'inferred', source: 'range found in the job text' }
      : { status: 'unconfirmed', source: 'job text', detail: 'no salary range found' };
  }

  // Work mode.
  let mode: string | null = null;
  if (raw.workMode) {
    mode = raw.workMode;
    prov.work_mode = { status: 'verified', source: 'job board field' };
  } else {
    const m = inferWorkMode(raw.locations.join(' | '), text);
    if (m) {
      mode = m.mode;
      prov.work_mode = { status: 'inferred', source: m.from === 'location' ? 'location text' : 'job description' };
    } else prov.work_mode = { status: 'unconfirmed', source: 'job text', detail: 'not stated' };
  }

  // Employment type.
  let emp = mapEmploymentType(raw.employmentTypeRaw);
  if (emp) prov.employment_type = { status: 'verified', source: 'job board field' };
  else {
    emp = inferEmploymentType(raw.title);
    prov.employment_type = emp ? { status: 'inferred', source: 'job title' } : { status: 'unconfirmed', source: 'job board', detail: 'not stated' };
  }

  // Sponsorship wording in the job's own text. Never derived from the register.
  const sp = text ? sponsorshipSignal(text) : { signal: 'unmentioned' as const, snippet: null };
  prov.sponsorship = !text
    ? { status: 'unconfirmed', source: 'job text', detail: 'description not available' }
    : sp.signal === 'unmentioned'
      ? { status: 'unconfirmed', source: 'job text', detail: 'the posting does not mention sponsorship' }
      : sp.signal === 'unclear'
        ? { status: 'inferred', source: 'job text', detail: 'the posting contains conflicting wording' }
        : { status: 'verified', source: 'job text', detail: 'quoted from the posting' };

  const seniority = classifySeniority(raw.title);
  if (seniority) prov.seniority = { status: 'inferred', source: 'job title' };
  const years = text ? extractYears(text) : null;
  if (years != null) prov.years_experience = { status: 'inferred', source: 'job text' };

  const location_raw = raw.locations.join(' | ').slice(0, 300) || 'Not stated';
  const hash = createHash('sha1')
    .update([raw.title, location_raw, text.slice(0, 20000), salary ? `${salary.min}-${salary.max}` : ''].join('\u0001'))
    .digest('hex');

  return {
    source: undefined as never, // set by the caller
    external_id: raw.externalId,
    title: raw.title,
    role_family: family,
    seniority,
    location_raw,
    city: ukCity(raw.locations),
    work_mode: mode,
    employment_type: emp,
    salary_min: salary ? Math.round(salary.min) : null,
    salary_max: salary ? Math.round(salary.max) : null,
    salary_currency: salary?.currency ?? null,
    salary_period: salary?.period ?? null,
    department: raw.department,
    skills: text ? extractSkills(`${raw.title}\n${text}`) : extractSkills(raw.title),
    years_experience: years,
    degree_mentioned: text ? mentionsDegree(text) : null,
    apply_url: applyUrl,
    excerpt: text ? text.replace(/\s+/g, ' ').slice(0, 500) : null,
    sponsorship_signal: sp.signal,
    sponsorship_snippet: sp.snippet,
    posted_at: raw.postedAt && !Number.isNaN(raw.postedAt.getTime()) ? raw.postedAt : null,
    content_hash: hash,
    provenance: prov
  };
}
