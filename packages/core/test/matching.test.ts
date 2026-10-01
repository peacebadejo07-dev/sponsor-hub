import { describe, it, expect } from 'vitest';
import { scoreMatch, annualGbp, maxPossible, EMPTY_PROFILE, type UserProfile, type MatchableJob } from '../src/index.ts';

const NOW = new Date('2026-10-20T12:00:00Z');
const job = (over: Partial<MatchableJob> = {}): MatchableJob => ({
  role_family: 'data', seniority: 'senior', city: 'London', location_raw: 'London', work_mode: 'hybrid', employment_type: 'full_time',
  salary_min: 70000, salary_max: 90000, salary_currency: 'GBP', salary_period: 'year', skills: ['Python', 'SQL', 'AWS', 'Airflow'],
  years_experience: 5, sponsorship_signal: 'unmentioned', first_seen_at: '2026-10-01T00:00:00Z', changed_at: null, stale_reason: null, ...over
});
const me = (over: Partial<UserProfile> = {}): UserProfile => ({ ...EMPTY_PROFILE, ...over });

describe('scoreMatch: sparse profiles', () => {
  it('gives a neutral score and no penalties when the user has said nothing', () => {
    const r = scoreMatch(me(), job(), NOW);
    expect(r.score).toBe(50);
    expect(r.hidden).toBe(false);
    expect(r.reasons.every((x) => x.points >= 0)).toBe(true);
  });
  it('never penalises a missing preference', () => {
    const r = scoreMatch(me({ roles: ['data'] }), job({ city: null, work_mode: null, employment_type: null, seniority: null }), NOW);
    expect(r.reasons.filter((x) => x.kind === '-')).toHaveLength(0);
  });
});

describe('scoreMatch: scores are not saturated', () => {
  const full = me({ roles: ['data'], locations: ['London'], workModes: ['hybrid'], employmentTypes: ['full_time'], level: 'senior', skills: ['python', 'sql', 'aws', 'airflow'], yearsExperience: 6, needsSponsorship: 'yes', minSalary: 60000 });
  const perfect = job({ sponsorship_signal: 'offered', first_seen_at: '2026-10-19T00:00:00Z' });
  it('gives only a genuinely perfect fit 100, and separates strong from merely good', () => {
    expect(scoreMatch(full, perfect, NOW).score).toBe(100);
    const good = scoreMatch(full, { ...perfect, skills: ['Python'], seniority: 'mid', sponsorship_signal: 'unmentioned', work_mode: 'onsite' }, NOW).score;
    expect(good).toBeLessThan(100);
    expect(good).toBeGreaterThan(50);
    expect(scoreMatch(full, perfect, NOW).score).toBeGreaterThan(good);
  });
  it('measures against only what the person answered', () => {
    expect(maxPossible(me())).toBe(40); // the floor
    expect(maxPossible(full)).toBe(3 + 35 + 25 + 15 + 5 + 15 + 5 + 5 + 20 + 5);
    expect(maxPossible(me({ roles: ['data'] }))).toBe(40);
  });
  it('a one-question profile does not inflate small differences', () => {
    const p = me({ roles: ['data'] });
    expect(scoreMatch(p, job({ first_seen_at: '2026-10-19T00:00:00Z' }), NOW).score).toBeLessThan(100);
  });
});

describe('scoreMatch: ranking', () => {
  const profile = me({ roles: ['data', 'ai_ml'], locations: ['London'], workModes: ['hybrid', 'remote'], level: 'senior', skills: ['python', 'sql'], needsSponsorship: 'yes' });
  it('puts a strong match well above a weak one', () => {
    const good = scoreMatch(profile, job({ sponsorship_signal: 'offered' }), NOW);
    const bad = scoreMatch(profile, job({ role_family: 'design', city: 'Glasgow', location_raw: 'Glasgow', work_mode: 'onsite', seniority: 'entry', skills: ['Figma'], sponsorship_signal: 'right_to_work' }), NOW);
    expect(good.score).toBeGreaterThan(bad.score + 40);
  });
  it('keeps scores between 0 and 100', () => {
    const best = scoreMatch(profile, job({ sponsorship_signal: 'offered' }), NOW);
    const worst = scoreMatch(profile, job({ role_family: 'design', city: 'Glasgow', location_raw: 'Glasgow', work_mode: 'onsite', seniority: 'executive', employment_type: 'internship', skills: [], sponsorship_signal: 'not_offered', stale_reason: 'Reposted 3 times' }), NOW);
    expect(best.score).toBeLessThanOrEqual(100);
    expect(worst.score).toBeGreaterThanOrEqual(0);
  });
  it('explains every point: reasons add up to the score', () => {
    const r = scoreMatch(profile, job({ sponsorship_signal: 'offered' }), NOW);
    const sum = r.reasons.reduce((n, x) => n + x.points, 0);
    expect(r.score).toBe(Math.max(0, Math.min(100, Math.round(50 + (50 * sum) / maxPossible(profile)))));
    expect(r.reasons.every((x) => x.text.length > 5)).toBe(true);
  });
});

describe('scoreMatch: role, skills, level', () => {
  it('rewards a chosen role type and counts a different one against it', () => {
    expect(scoreMatch(me({ roles: ['data'] }), job(), NOW).score).toBeGreaterThan(50);
    expect(scoreMatch(me({ roles: ['design'] }), job(), NOW).score).toBeLessThan(50);
  });
  it('names the skills that matched, ignoring case', () => {
    const r = scoreMatch(me({ skills: ['PYTHON', 'sql', 'rust'] }), job(), NOW);
    expect(r.reasons.find((x) => x.text.startsWith('Mentions 2'))?.text).toMatch(/Python, SQL/);
  });
  it('compares levels by distance', () => {
    const p = me({ level: 'mid' });
    expect(scoreMatch(p, job({ seniority: 'mid' }), NOW).score).toBeGreaterThan(scoreMatch(p, job({ seniority: 'senior' }), NOW).score);
    expect(scoreMatch(p, job({ seniority: 'senior' }), NOW).score).toBeGreaterThan(scoreMatch(p, job({ seniority: 'executive' }), NOW).score);
  });
  it('flags experience demands well above the user', () => {
    const r = scoreMatch(me({ yearsExperience: 1 }), job({ years_experience: 8 }), NOW);
    expect(r.reasons.some((x) => x.kind === '-' && /8\+ years/.test(x.text))).toBe(true);
  });
});

describe('scoreMatch: location and working pattern', () => {
  it('matches a place by city or by the raw location text', () => {
    expect(scoreMatch(me({ locations: ['london'] }), job(), NOW).reasons[0].kind).toBe('+');
    expect(scoreMatch(me({ locations: ['Cardiff'] }), job({ city: null, location_raw: 'Cardiff, London or Remote (UK)' }), NOW).reasons[0].kind).toBe('+');
  });
  it('counts a different city against it, unless the job is remote and the user is open to it', () => {
    expect(scoreMatch(me({ locations: ['Leeds'] }), job(), NOW).reasons[0].kind).toBe('-');
    const r = scoreMatch(me({ locations: ['Leeds'], workModes: ['remote'] }), job({ work_mode: 'remote' }), NOW);
    expect(r.reasons[0]).toMatchObject({ kind: '+', text: expect.stringMatching(/remotely/) });
  });
  it('treats "remote or office" as suiting either preference', () => {
    expect(scoreMatch(me({ workModes: ['remote'] }), job({ work_mode: 'flexible' }), NOW).reasons[0].kind).toBe('+');
    expect(scoreMatch(me({ workModes: ['onsite'] }), job({ work_mode: 'flexible' }), NOW).reasons[0].kind).toBe('+');
    expect(scoreMatch(me({ workModes: ['remote'] }), job({ work_mode: 'onsite' }), NOW).reasons[0].kind).toBe('-');
  });
  it('checks employment type', () => {
    expect(scoreMatch(me({ employmentTypes: ['full_time'] }), job({ employment_type: 'internship' }), NOW).reasons[0].kind).toBe('-');
  });
});

describe('scoreMatch: sponsorship', () => {
  const need = me({ needsSponsorship: 'yes' });
  it('rewards a posting that says it offers sponsorship, only for people who need it', () => {
    expect(scoreMatch(need, job({ sponsorship_signal: 'offered' }), NOW).score).toBeGreaterThan(scoreMatch(need, job(), NOW).score);
    const no = me({ needsSponsorship: 'no' });
    // For someone who does not need sponsorship, the posting's wording must not move the score at all.
    expect(scoreMatch(no, job({ sponsorship_signal: 'offered' }), NOW).score).toBe(scoreMatch(no, job({ sponsorship_signal: 'unmentioned' }), NOW).score);
    expect(scoreMatch(no, job({ sponsorship_signal: 'not_offered' }), NOW).score).toBe(scoreMatch(no, job({ sponsorship_signal: 'unmentioned' }), NOW).score);
    // And the same for a user who left the question blank.
    expect(scoreMatch(me(), job({ sponsorship_signal: 'offered' }), NOW).score).toBe(scoreMatch(me(), job(), NOW).score);
  });
  it('does not mention sponsorship at all for someone who does not need it', () => {
    const r = scoreMatch(me({ needsSponsorship: 'no' }), job({ sponsorship_signal: 'not_offered' }), NOW);
    expect(r.hidden).toBe(false);
    expect(r.reasons.some((x) => /sponsor/i.test(x.text))).toBe(false);
  });
  it('hides a refusal for someone who needs sponsorship, unless they chose to see them', () => {
    expect(scoreMatch(need, job({ sponsorship_signal: 'not_offered' }), NOW).hidden).toBe(true);
    expect(scoreMatch({ ...need, hideRefusals: false }, job({ sponsorship_signal: 'not_offered' }), NOW).hidden).toBe(false);
    expect(scoreMatch(me({ needsSponsorship: 'unsure' }), job({ sponsorship_signal: 'not_offered' }), NOW).hidden).toBe(true);
  });
  it('never says a role is sponsored when the posting is silent', () => {
    const r = scoreMatch(need, job({ sponsorship_signal: 'unmentioned' }), NOW);
    const t = r.reasons.find((x) => /sponsor/i.test(x.text))!;
    expect(t.text).toMatch(/does not mention/);
    expect(t.points).toBe(0);
  });
  it('treats right-to-work wording as a mild negative, not a refusal', () => {
    const r = scoreMatch(need, job({ sponsorship_signal: 'right_to_work' }), NOW);
    expect(r.hidden).toBe(false);
    expect(r.reasons.find((x) => /right to work/.test(x.text))?.points).toBe(-10);
  });
});

describe('scoreMatch: salary and freshness', () => {
  it('annualises other pay periods and ignores other currencies', () => {
    expect(annualGbp({ salary_min: 400, salary_max: 500, salary_currency: 'GBP', salary_period: 'day' })).toEqual({ min: 88000, max: 110000 });
    expect(annualGbp({ salary_min: 5000, salary_max: 6000, salary_currency: 'GBP', salary_period: 'month' })).toEqual({ min: 60000, max: 72000 });
    expect(annualGbp({ salary_min: 80000, salary_max: 90000, salary_currency: 'USD', salary_period: 'year' })).toBeNull();
    expect(annualGbp({ salary_min: null, salary_max: null, salary_currency: null, salary_period: null })).toBeNull();
  });
  it('compares pay to the minimum, and says nothing when pay is unknown', () => {
    expect(scoreMatch(me({ minSalary: 100000 }), job(), NOW).reasons.some((x) => x.kind === '-' && /below your minimum/.test(x.text))).toBe(true);
    expect(scoreMatch(me({ minSalary: 60000 }), job(), NOW).reasons.some((x) => x.kind === '+' && /within your minimum/.test(x.text))).toBe(true);
    expect(scoreMatch(me({ minSalary: 60000 }), job({ salary_min: null, salary_max: null, salary_currency: null }), NOW).reasons).toHaveLength(0);
  });
  it('judges freshness by the posting date, not by when we discovered the ad', () => {
    const old = job({ first_seen_at: '2026-10-19T00:00:00Z', posted_at: '2024-05-01T00:00:00Z' });
    expect(scoreMatch(me(), old, NOW).reasons.some((x) => /last 7 days/.test(x.text))).toBe(false);
    const fresh = job({ first_seen_at: '2026-10-19T00:00:00Z', posted_at: '2026-10-18T00:00:00Z' });
    expect(scoreMatch(me(), fresh, NOW).reasons.find((x) => /last 7 days/.test(x.text))?.text).toBe('Posted in the last 7 days');
    expect(scoreMatch(me(), job({ first_seen_at: '2026-10-19T00:00:00Z' }), NOW).reasons.find((x) => /last 7 days/.test(x.text))?.text).toBe('Found in the last 7 days');
  });
  it('favours new roles and marks stale ones', () => {
    expect(scoreMatch(me(), job({ first_seen_at: '2026-10-18T00:00:00Z' }), NOW).score).toBeGreaterThan(scoreMatch(me(), job(), NOW).score);
    expect(scoreMatch(me(), job({ stale_reason: 'Live for over 120 days' }), NOW).reasons.some((x) => /stale/i.test(x.text))).toBe(true);
  });
});
