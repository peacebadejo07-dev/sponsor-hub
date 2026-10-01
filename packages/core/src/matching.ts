import { ROLE_LABELS, type EmploymentType, type RoleFamily, type Seniority, type SponsorshipSignal, type WorkMode } from './jobs.ts';

/** What a user tells us. Every field is optional: no answer means "no preference", never a penalty. */
export interface UserProfile {
  roles: RoleFamily[];
  locations: string[]; // town / city names
  workModes: ('remote' | 'hybrid' | 'onsite')[];
  employmentTypes: EmploymentType[];
  level: Seniority | null;
  skills: string[];
  yearsExperience: number | null;
  needsSponsorship: 'yes' | 'no' | 'unsure' | null;
  minSalary: number | null; // GBP a year
  hideRefusals: boolean;
}

export const EMPTY_PROFILE: UserProfile = {
  roles: [], locations: [], workModes: [], employmentTypes: [], level: null, skills: [], yearsExperience: null,
  needsSponsorship: null, minSalary: null, hideRefusals: true
};

/** The parts of an opportunity that matching looks at. */
export interface MatchableJob {
  role_family: RoleFamily;
  seniority: Seniority | null;
  city: string | null;
  location_raw: string;
  work_mode: WorkMode | null;
  employment_type: EmploymentType | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  skills: string[];
  years_experience: number | null;
  sponsorship_signal: SponsorshipSignal;
  posted_at?: Date | string | null;
  first_seen_at: Date | string;
  changed_at: Date | string | null;
  stale_reason: string | null;
}

export interface Reason {
  /** + helped the match, - counted against it, = neutral note. */
  kind: '+' | '-' | '=';
  text: string;
  points: number;
}

export interface MatchResult {
  score: number; // 0..100
  reasons: Reason[];
  hidden: boolean; // excluded outright for this user (e.g. the posting refuses sponsorship and they asked to hide those)
}

const LEVEL_RANK: Record<Seniority, number> = { entry: 0, mid: 1, senior: 2, lead: 3, principal: 3, executive: 4 };
const LEVEL_NAME: Record<Seniority, string> = { entry: 'entry level', mid: 'mid level', senior: 'senior', lead: 'lead', principal: 'staff / principal', executive: 'executive' };
const MODE_NAME: Record<string, string> = { remote: 'remote', hybrid: 'hybrid', onsite: 'on-site', flexible: 'remote or office' };

/** Yearly GBP salary range, or null when it cannot be compared (other currency, unknown period). */
export function annualGbp(j: Pick<MatchableJob, 'salary_min' | 'salary_max' | 'salary_currency' | 'salary_period'>): { min: number; max: number } | null {
  if (j.salary_min == null || j.salary_currency !== 'GBP') return null;
  const mult = { year: 1, month: 12, day: 220, hour: 1650 }[j.salary_period ?? 'year'];
  if (!mult) return null;
  return { min: j.salary_min * mult, max: (j.salary_max ?? j.salary_min) * mult };
}

const norm = (s: string) => s.toLowerCase().trim();

/**
 * The most points a job could earn for this particular profile: only the questions the person answered count.
 * Scores are measured against this, so a perfect fit is 100 and one that gets half the available points is about 75,
 * however much or little the person filled in. (A floor stops a nearly-empty profile from inflating tiny differences.)
 */
export function maxPossible(p: UserProfile): number {
  let m = 3; // freshness
  if (p.roles.length) m += 35;
  if (p.skills.length) m += 25;
  if (p.level) m += 15;
  if (p.yearsExperience != null) m += 5;
  if (p.locations.length) m += 15;
  if (p.workModes.length) m += 5;
  if (p.employmentTypes.length) m += 5;
  if (p.needsSponsorship === 'yes' || p.needsSponsorship === 'unsure') m += 20;
  if (p.minSalary != null) m += 5;
  return Math.max(40, m);
}

/**
 * Score one job for one user. Transparent by design: every point comes with a reason a person can read,
 * and nothing is inferred about the person beyond what they typed in.
 */
export function scoreMatch(profile: UserProfile, job: MatchableJob, now = new Date()): MatchResult {
  const reasons: Reason[] = [];
  const add = (kind: Reason['kind'], text: string, points: number) => reasons.push({ kind, text, points });
  let hidden = false;

  // --- Role type (the biggest signal) ---
  if (profile.roles.length) {
    if (profile.roles.includes(job.role_family)) add('+', `Role type: ${ROLE_LABELS[job.role_family]}, one of the types you chose`, 35);
    else add('-', `Role type is ${ROLE_LABELS[job.role_family]}, which is not one you chose`, -15);
  }

  // --- Skills ---
  if (profile.skills.length && job.skills.length) {
    const mine = new Set(profile.skills.map(norm));
    const hit = job.skills.filter((s) => mine.has(norm(s)));
    if (hit.length) {
      const pts = Math.min(25, Math.round((hit.length / Math.min(job.skills.length, 6)) * 25));
      add('+', `Mentions ${hit.length} of your skills: ${hit.slice(0, 4).join(', ')}`, pts);
    } else add('=', 'None of your listed skills appear in the posting', 0);
  }

  // --- Level ---
  if (profile.level && job.seniority) {
    const diff = LEVEL_RANK[job.seniority] - LEVEL_RANK[profile.level];
    if (diff === 0) add('+', `Level: ${LEVEL_NAME[job.seniority]}, matching yours`, 15);
    else if (Math.abs(diff) === 1) add('=', `Level: ${LEVEL_NAME[job.seniority]}, one step from yours`, 5);
    else if (diff > 1) add('-', `Level: ${LEVEL_NAME[job.seniority]}, well above yours`, -15);
    else add('-', `Level: ${LEVEL_NAME[job.seniority]}, well below yours`, -8);
  } else if (profile.level && !job.seniority) {
    add('=', 'The posting does not state a level', 3);
  }
  if (profile.yearsExperience != null && job.years_experience != null) {
    if (job.years_experience > profile.yearsExperience + 2) add('-', `Asks for ${job.years_experience}+ years of experience; you listed ${profile.yearsExperience}`, -8);
    else if (job.years_experience <= profile.yearsExperience) add('+', `Asks for ${job.years_experience}+ years of experience, within your ${profile.yearsExperience}`, 5);
  }

  // --- Location and working pattern ---
  const remoteFriendly = job.work_mode === 'remote' || job.work_mode === 'flexible';
  if (profile.locations.length) {
    const wanted = profile.locations.map(norm);
    const here = norm(job.city ?? '');
    const raw = norm(job.location_raw);
    const inPlace = wanted.some((w) => (here && (here === w || here.startsWith(w))) || raw.includes(w));
    if (inPlace) add('+', `Location: ${job.city ?? job.location_raw.split(' | ')[0]}, one of your places`, 15);
    else if (remoteFriendly && profile.workModes.includes('remote')) add('+', 'Can be done remotely, and you are open to remote work', 10);
    else add('-', `Location (${job.city ?? job.location_raw.split(' | ')[0]}) is not one of your places`, -20);
  }
  if (profile.workModes.length && job.work_mode) {
    const ok = profile.workModes.includes(job.work_mode as never) || (job.work_mode === 'flexible' && profile.workModes.some((m) => m === 'remote' || m === 'hybrid' || m === 'onsite'));
    if (ok) add('+', `Working pattern: ${MODE_NAME[job.work_mode]}, which suits you`, 5);
    else add('-', `Working pattern is ${MODE_NAME[job.work_mode]}, not one you chose`, -10);
  }
  if (profile.employmentTypes.length && job.employment_type) {
    if (profile.employmentTypes.includes(job.employment_type)) add('+', 'Employment type is one you chose', 5);
    else add('-', 'Employment type is not one you chose', -12);
  }

  // --- Sponsorship: only about the posting's own words. Every employer shown is a licensed sponsor already. ---
  if (profile.needsSponsorship === 'yes' || profile.needsSponsorship === 'unsure') {
    switch (job.sponsorship_signal) {
      case 'offered': add('+', 'The posting says it offers visa sponsorship', 20); break;
      case 'not_offered':
        add('-', 'The posting says it does not offer visa sponsorship', -40);
        if (profile.hideRefusals) hidden = true;
        break;
      case 'unclear': add('=', 'The posting has conflicting wording about sponsorship', 0); break;
      case 'right_to_work': add('-', 'The posting asks for UK right to work, which can rule out sponsored applicants', -10); break;
      default: add('=', 'The posting does not mention sponsorship (the employer is a licensed sponsor)', 0);
    }
  }

  // --- Salary ---
  if (profile.minSalary != null) {
    const pay = annualGbp(job);
    if (pay) {
      if (pay.max < profile.minSalary) add('-', `Pay tops out below your minimum (£${Math.round(pay.max).toLocaleString('en-GB')} a year)`, -15);
      else add('+', `Pay is within your minimum (up to £${Math.round(pay.max).toLocaleString('en-GB')} a year)`, 5);
    }
  }

  // --- Freshness ---
  const day = 86_400_000;
  // Use the employer's posting date when there is one: an old ad we only just discovered is not new.
  const when = job.posted_at ?? job.first_seen_at;
  const age = (now.getTime() - new Date(when).getTime()) / day;
  if (age <= 7) add('+', job.posted_at ? 'Posted in the last 7 days' : 'Found in the last 7 days', 3);
  if (job.stale_reason) add('-', `Possibly stale: ${job.stale_reason.toLowerCase()}`, -5);

  const raw = reasons.reduce((n, r) => n + r.points, 0);
  // 50 is neutral (nothing for or against); 100 is every available point; below 50 means more against than for.
  const score = Math.max(0, Math.min(100, Math.round(50 + (50 * raw) / maxPossible(profile))));
  return { score, reasons, hidden };
}
