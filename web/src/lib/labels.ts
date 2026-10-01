export const RATING_LABELS: Record<string, string> = {
  A_PREMIUM: 'A (Premium)',
  A_SME_PLUS: 'A (SME+)',
  A: 'A rating',
  B: 'B rating',
  PROVISIONAL: 'Provisional',
  UNKNOWN: 'Unknown'
};

export const RATING_HELP: Record<string, string> = {
  A_PREMIUM: 'A-rated sponsor with premium status',
  A_SME_PLUS: 'A-rated small or medium sponsor',
  A: 'Licence in good standing',
  B: 'Licence held, but the sponsor has been required to improve its compliance',
  PROVISIONAL: 'Provisional licence (UK Expansion Worker route)'
};

export const WORK_LABELS: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', flexible: 'Remote or office' };
export const EMP_LABELS: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship', temporary: 'Temporary' };
export const LEVEL_LABELS: Record<string, string> = { entry: 'Entry level', mid: 'Mid level', senior: 'Senior', lead: 'Lead / head', principal: 'Staff / principal', executive: 'Executive' };
export const SPONSOR_LABELS: Record<string, string> = {
  offered: 'Says it offers sponsorship',
  not_offered: 'Says it does not sponsor',
  right_to_work: 'Asks for UK right to work',
  unclear: 'Wording is conflicting',
  unmentioned: 'Does not mention sponsorship'
};
const PERIOD: Record<string, string> = { year: 'a year', month: 'a month', day: 'a day', hour: 'an hour' };
const SYMBOL: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };

export function money(o: { salary_min: number | null; salary_max: number | null; salary_currency: string | null; salary_period: string | null }): string | null {
  if (o.salary_min == null) return null;
  const f = (n: number) => n.toLocaleString('en-GB');
  const s = SYMBOL[o.salary_currency ?? ''] ?? '';
  return `${s}${f(o.salary_min)} – ${s}${f(o.salary_max ?? o.salary_min)} ${PERIOD[o.salary_period ?? 'year']}`;
}

export function ago(iso: string | Date | null): string {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 60 ? `${d} days ago` : `${Math.floor(d / 30)} months ago`;
}
