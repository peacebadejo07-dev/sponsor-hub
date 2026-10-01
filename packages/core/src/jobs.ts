/**
 * Pure job-normalisation helpers. Everything here works on text, so unless a value came from a
 * structured field in the job board's API, the scanner labels it INFERRED.
 */

export const ROLE_FAMILIES = ['software', 'product', 'design', 'ai_ml', 'data', 'cloud_devops', 'cybersecurity', 'it_support', 'adjacent'] as const;
export type RoleFamily = (typeof ROLE_FAMILIES)[number];

export const ROLE_LABELS: Record<RoleFamily, string> = {
  software: 'Software engineering',
  product: 'Product',
  design: 'UX / UI / product design',
  ai_ml: 'AI / machine learning',
  data: 'Data',
  cloud_devops: 'Cloud / DevOps',
  cybersecurity: 'Cybersecurity',
  it_support: 'IT / support',
  adjacent: 'Adjacent tech roles'
};

export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'flexible';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary';
export type Seniority = 'entry' | 'mid' | 'senior' | 'lead' | 'principal' | 'executive';
export type SponsorshipSignal = 'offered' | 'not_offered' | 'right_to_work' | 'unclear' | 'unmentioned';

// ---------- text helpers ----------

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', pound: '£', euro: '€', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', bull: '•', middot: '·', copy: '©'
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML (possibly entity-escaped twice, as Greenhouse returns it) to plain text. */
export function htmlToText(html: string): string {
  let s = html;
  if (/&lt;\s*(p|div|ul|li|br|h\d|strong|span)\b/i.test(s)) s = decodeEntities(s); // unescape escaped markup
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<\s*(br|\/p|\/div|\/li|\/h\d|\/tr)\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ');
  return decodeEntities(s).replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------- role family, seniority ----------

// Qualifiers that make a bare "engineer" a physical-engineering or non-software role.
const NON_SOFTWARE_ENGINEER = /\b(sales|solutions?|customer|support|mechanical|civil|electrical|electronics?|structural|field|process|manufacturing|production|maintenance|controls?|chemical|building|plant|hardware|network|systems?|applications?|service|commissioning|installation|thermal|hvac|automotive|materials|safety|quality|project|design|test|reliability|technical)\b.*\bengineer\b|\bengineer\b.*\b(mechanical|electrical|civil|maintenance)\b/i;
// A bare "engineer" is software only when the department says so (plain "Engineering" is not enough).
const TECH_DEPARTMENT = /\b(software|digital|technology|tech|platform|data|infrastructure|product|r&d|it|ai|ml|cloud|security|backend|frontend|mobile|web)\b/i;

const ROLE_RULES: { family: RoleFamily; re: RegExp }[] = [
  { family: 'ai_ml', re: /\b(machine learning|ml|mlops|ai|a\.i\.|artificial intelligence|deep learning|nlp|computer vision|llms?|generative|applied scientist|research (scientist|engineer))\b/i },
  { family: 'software', re: /\b(software (engineer|developer|architect)|engineering (manager|director|lead|head)|(head|director|vp)(?: of)? engineering|swe|(front|back)[- ]?end|full[- ]?stack|ios (engineer|developer)|android (engineer|developer)|mobile (engineer|developer)|web (engineer|developer)|sdet|qa engineer|test automation|firmware|embedded (software|engineer)|programmer)\b/i },
  { family: 'cybersecurity', re: /\b(cyber\w*|infosec|appsec|pentest\w*|penetration test\w*|devsecops|ciso|soc analyst|threat (intelligence|hunter|analyst)|vulnerability|incident response|(?:blue|red|purple) team)\b|\bsecurity (engineer|analyst|architect|researcher|specialist|consultant|manager|lead|head|officer|director|developer|tester|operations)\b|\b(head|director) of security\b|\b(information|application|cloud|product) security\b/i },
  { family: 'cloud_devops', re: /\b(devops|sre|site reliability|platform engineer|infrastructure engineer|cloud (engineer|architect|ops|platform)|kubernetes|release engineer|build engineer|observability|reliability engineer)\b/i },
  { family: 'data', re: /\b(data (engineer|scientist|science|analyst|architect|analytics|platform|product|governance|quality|steward)|(head|director|vp|chief)(?: of)? data|analytics engineer|business intelligence|bi (developer|analyst|engineer)|database|dba|etl|statistician|quantitative (analyst|researcher|developer))\b/i },
  { family: 'design', re: /\b(designer|ux|ui|user (experience|interface|research)|product design|interaction design|visual design|content design|design (lead|manager|system|ops|technologist))\b/i },
  { family: 'product', re: /\b(product (manager|owner|lead|director|operations|ops|analyst)|(head|director|vp|chief)(?: of)? product(?!\s+(marketing|sales))|head of product|chief product|vp(?: of)? product|group product|product management|apm)\b/i },
  { family: 'adjacent', re: /\b(forward[- ]deployed|solutions? (engineer|architect|consultant)|sales engineer|customer (engineer|success engineer)|technical (account manager|writer|support|program(me)?|project|recruiter|consultant|specialist|architect)|support engineer|implementation (engineer|consultant|specialist)|business analyst|(project|programme|delivery) manager|scrum master|agile coach|enterprise architect|developer (advocate|relations)|solution architect)\b/i },
  { family: 'it_support', re: /\b(it (support|analyst|technician|manager|engineer|operations|helpdesk)|end[- ]user (services|computing|support)|service desk|help ?desk|desktop support|systems? administrator|sysadmin|network engineer|infrastructure analyst|end[- ]user computing)\b/i },
  { family: 'software', re: /\b(developer|software|engineer)\b/i }
];

export function classifyRole(title: string, department?: string | null): RoleFamily | null {
  const t = title.replace(/\s+/g, ' ').trim();
  for (const { family, re } of ROLE_RULES) {
    if (!re.test(t)) continue;
    if (family === 'software' && re.source.includes('developer|software|engineer')) {
      // Generic fallback. "developer" / "software" alone are fine; a bare "engineer" needs a technical department
      // and no physical-engineering qualifier ("Electrical Maintenance Engineer", "Lead Engineer" at a manufacturer).
      if (!/\b(developer|software)\b/i.test(t)) {
        if (NON_SOFTWARE_ENGINEER.test(t)) continue;
        if (!department || !TECH_DEPARTMENT.test(department)) continue;
      }
    }
    return family;
  }
  return null;
}

export function classifySeniority(title: string): Seniority | null {
  if (/\b(intern|internship|placement|apprentice\w*|graduate|grad|junior|jr|entry[- ]level|trainee)\b/i.test(title)) return 'entry';
  if (/\b(chief|cto|cio|ciso|cpo|vp|vice president|svp|evp)\b/i.test(title)) return 'executive';
  if (/\b(principal|staff|distinguished|fellow)\b/i.test(title)) return 'principal';
  if (/\b(lead|head of|director|manager of|engineering manager)\b/i.test(title)) return 'lead';
  if (/\b(senior|sr\.?)\b/i.test(title)) return 'senior';
  if (/\b(mid[- ]level|intermediate|associate)\b/i.test(title)) return 'mid';
  return null;
}

// ---------- location ----------

const UK_CITIES = [
  'london', 'manchester', 'birmingham', 'edinburgh', 'glasgow', 'bristol', 'leeds', 'cambridge', 'oxford', 'cardiff', 'belfast',
  'liverpool', 'newcastle', 'sheffield', 'nottingham', 'southampton', 'reading', 'brighton', 'leicester', 'aberdeen', 'dundee',
  'exeter', 'bath', 'york', 'milton keynes', 'coventry', 'swansea', 'bournemouth', 'portsmouth', 'norwich', 'derby', 'plymouth',
  'stirling', 'inverness', 'durham', 'guildford', 'slough', 'luton', 'watford', 'swindon', 'cheltenham', 'gloucester', 'canterbury',
  'warwick', 'lancaster', 'salford', 'sunderland', 'wolverhampton', 'ipswich', 'peterborough', 'northampton', 'basingstoke',
  'crawley', 'maidenhead', 'harlow', 'bracknell', 'woking', 'hemel hempstead', 'st albans', 'chelmsford', 'colchester'
];
const UK_WORDS = /\b(united kingdom|u\.k\.|uk|gb|gbr|great britain|britain|england|scotland|wales|northern ireland)\b/i;
// US state / Canadian province codes after a comma ("Cambridge, MA"), and country words, rule a location out
// unless it also names the UK. Many UK city names exist elsewhere (Birmingham AL, Cambridge MA, New York).
const US_CA_REGION = /,\s*(A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY]|ON|QC|BC|AB|MB|NS|NB|SK)\b/;
const NOT_UK = /\b(canada|ontario|usa|united states|u\.s\.a?\.?|mexico|australia|india|singapore|germany|france|ireland|netherlands)\b/i;
const cityRe = (c: string) => new RegExp(c === 'york' ? '(?<!new )\\byork\\b' : `\\b${c}\\b`);

export function isUkLocation(locations: string[], countryCodes: string[] = []): boolean {
  if (countryCodes.some((c) => /^(gb|uk|gbr)$/i.test(c))) return true;
  return locations.some((loc) => {
    const l = loc.toLowerCase();
    if (UK_WORDS.test(l)) return true;
    if (US_CA_REGION.test(loc) || NOT_UK.test(l)) return false;
    return UK_CITIES.some((c) => cityRe(c).test(l));
  });
}

export function ukCity(locations: string[]): string | null {
  for (const loc of locations) {
    const l = loc.toLowerCase();
    let best: { city: string; at: number } | null = null;
    for (const c of UK_CITIES) {
      const at = l.search(cityRe(c));
      if (at >= 0 && (!best || at < best.at)) best = { city: c, at };
    }
    if (best) return best.city.replace(/\b\w/g, (m) => m.toUpperCase());
  }
  return null;
}

// ---------- work mode, employment type ----------

export function inferWorkMode(locationText: string, descriptionText = ''): { mode: WorkMode; from: 'location' | 'text' } | null {
  const loc = locationText.toLowerCase();
  const hasRemote = /\bremote\b/.test(loc);
  if (/\bhybrid\b/.test(loc)) return { mode: 'hybrid', from: 'location' };
  if (hasRemote) {
    const stripped = loc.replace(/\bremote\b|\(|\)|,|\buk\b|united kingdom|\bor\b|-|–|\s/g, '');
    return { mode: stripped.length === 0 ? 'remote' : 'flexible', from: 'location' };
  }
  const d = descriptionText.slice(0, 6000).toLowerCase();
  if (/\bhybrid\b/.test(d)) return { mode: 'hybrid', from: 'text' };
  if (/\b(fully remote|100% remote|remote[- ]first|work from anywhere|remote[- ]only)\b/.test(d)) return { mode: 'remote', from: 'text' };
  // Only wording about the role itself; "on-site parking" in a benefits list says nothing about where you work.
  if (/\b(on[- ]?site (role|position|basis|working|presence|only)|(this|the) (role|position) is (fully )?(on[- ]?site|office[- ]based)|office[- ]based|based (on[- ]?site|in (our|the) office)|fully on[- ]?site|100% on[- ]?site|(5|five) days (a week )?(in|at) the office)\b/.test(d)) return { mode: 'onsite', from: 'text' };
  return null;
}

export function mapEmploymentType(raw: string | null | undefined): EmploymentType | null {
  if (!raw) return null;
  const r = raw.toLowerCase().replace(/[\s_-]/g, '');
  if (/^(fulltime|permanent|regular)/.test(r)) return 'full_time';
  if (/^parttime/.test(r)) return 'part_time';
  if (/^(contract|contractor|fixedterm|freelance)/.test(r)) return 'contract';
  if (/^(intern|internship|placement|apprentice)/.test(r)) return 'internship';
  if (/^(temp|temporary|seasonal)/.test(r)) return 'temporary';
  return null;
}

export function inferEmploymentType(title: string): EmploymentType | null {
  if (/\b(intern|internship|placement|apprentice\w*)\b/i.test(title)) return 'internship';
  if (/\b(contract|contractor|fixed[- ]term|ftc|freelance)\b/i.test(title)) return 'contract';
  if (/\bpart[- ]time\b/i.test(title)) return 'part_time';
  if (/\btemporary\b/i.test(title)) return 'temporary';
  return null;
}

// ---------- salary ----------

export interface Salary {
  min: number;
  max: number;
  currency: 'GBP' | 'USD' | 'EUR';
  period: 'year' | 'month' | 'day' | 'hour';
}

const CUR: Record<string, Salary['currency']> = { '£': 'GBP', $: 'USD', '€': 'EUR' };
const AMOUNT = String.raw`(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(k)?`;
const RANGE = new RegExp(String.raw`([£$€])\s?${AMOUNT}\s*(?:-|–|—|to|and)\s*(?:[£$€]\s?)?${AMOUNT}`, 'gi');

function num(v: string, k?: string): number {
  const n = parseFloat(v.replace(/,/g, ''));
  return k ? n * 1000 : n;
}

/** First plausible salary range in free text. GBP preferred. Single figures are ignored (too ambiguous). */
export function parseSalary(text: string): Salary | null {
  const found: Salary[] = [];
  for (const m of text.matchAll(RANGE)) {
    const currency = CUR[m[1]];
    let min = num(m[2], m[3]);
    let max = num(m[4], m[5]);
    // "£60-80k" style: the k on the second number applies to both.
    if (!m[3] && m[5] && min < 1000 && max >= 1000) min *= 1000;
    if (min > max) continue;
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 40).toLowerCase();
    let period: Salary['period'] = 'year';
    if (/^\s*(per|a|\/)\s*(day|diem)|day rate/.test(after)) period = 'day';
    else if (/^\s*(per|an|\/)\s*(hour|hr)|hourly/.test(after)) period = 'hour';
    else if (/^\s*(per|a|\/)\s*month/.test(after)) period = 'month';
    else if (min < 1000) continue; // small bare numbers without a period are not salaries
    const ok =
      (period === 'year' && min >= 10_000 && max <= 1_000_000) ||
      (period === 'day' && min >= 80 && max <= 3000) ||
      (period === 'hour' && min >= 5 && max <= 500) ||
      (period === 'month' && min >= 800 && max <= 80_000);
    if (ok) found.push({ min, max, currency, period });
  }
  return found.find((s) => s.currency === 'GBP') ?? found[0] ?? null;
}

// ---------- sponsorship wording ----------

const NEGATIVE: RegExp[] = [
  /\b(unable|not able|cannot|can ?not|can[’']?t|won[’']?t|will not|do not|don[’']?t|does not|doesn[’']?t|are not|aren[’']?t|is not|isn[’']?t|not currently|no longer)\b[^.\n]{0,40}\b(offer|provide|support|sponsor|consider|accept)\w*[^.\n]{0,30}\b(visas?|sponsorship|sponsor|applicants? requiring)\b/i,
  /\bno (visa )?sponsorship\b/i,
  /\bsponsorship (is )?(not|unavailable)\b/i,
  /\b(without|not requiring|not require|no need for)\b[^.\n]{0,25}\b(visa )?sponsorship\b/i,
  /\bnot (eligible|available) for (visa )?sponsorship\b/i,
  /\b(we|company) (do|does) not sponsor\b/i,
  /\bcannot sponsor\b/i
];
const POSITIVE: RegExp[] = [
  /\bvisa sponsorship\b[^.\n]{0,40}\b(is |are )?(available|provided|offered|supported|possible)\b/i,
  /\b(we|company|employer)\b[^.\n]{0,30}\b(can|will|do|are able to|are happy to|may|are willing to|offer|provide)\b[^.\n]{0,30}\b(sponsor|sponsorship)\b/i,
  /\b(offer|provide|support)s? (visa )?sponsorship\b/i,
  /\bsponsor(ing)? (your|a|the) (skilled worker )?visa\b/i,
  /\bskilled worker (visa )?sponsorship\b/i,
  /\bvisa support\b/i,
  /\blicensed (visa )?sponsor\b/i
];
const RIGHT_TO_WORK = /\bright to work (in|within) the (uk|united kingdom)\b|\b(uk|united kingdom) right to work\b|\beligible to work in the (uk|united kingdom)\b/i;

function snippetAround(text: string, m: RegExpMatchArray): string {
  const i = m.index ?? 0;
  return text.slice(Math.max(0, i - 90), Math.min(text.length, i + m[0].length + 90)).replace(/\s+/g, ' ').trim();
}

function allMatches(text: string, res: RegExp[]): RegExpMatchArray[] {
  const out: RegExpMatchArray[] = [];
  for (const re of res) for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) out.push(m);
  return out.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

const overlaps = (a: RegExpMatchArray, b: RegExpMatchArray) => {
  const [a0, b0] = [a.index ?? 0, b.index ?? 0];
  return a0 < b0 + b[0].length && b0 < a0 + a[0].length;
};

/** What the job text itself says about sponsorship. Never infers it from the employer being on the register. */
export function sponsorshipSignal(text: string): { signal: SponsorshipSignal; snippet: string | null } {
  const negs = allMatches(text, NEGATIVE);
  // An "offer" phrase inside a refusal ("unable to offer visa sponsorship") is part of the refusal, not an offer.
  const poss = allMatches(text, POSITIVE).filter((p) => !negs.some((n) => overlaps(p, n)));
  if (negs.length && poss.length) return { signal: 'unclear', snippet: snippetAround(text, negs[0]) };
  if (negs.length) return { signal: 'not_offered', snippet: snippetAround(text, negs[0]) };
  if (poss.length) return { signal: 'offered', snippet: snippetAround(text, poss[0]) };
  const rtw = text.match(RIGHT_TO_WORK);
  if (rtw) return { signal: 'right_to_work', snippet: snippetAround(text, rtw) };
  return { signal: 'unmentioned', snippet: null };
}

// ---------- skills, experience, degree ----------

const SKILLS: [string, RegExp][] = [
  ['Python', /\bpython\b/i], ['JavaScript', /\bjavascript\b/i], ['TypeScript', /\btypescript\b/i], ['Java', /\bjava\b(?!script)/i],
  ['Kotlin', /\bkotlin\b/i], ['Swift', /\bswift\b/i], ['Go', /\b(golang|go (language|developer|engineer))\b/i], ['Rust', /\brust\b/i],
  ['C++', /\bc\+\+/i], ['C#', /\bc#|\.net\b/i], ['Ruby', /\bruby\b/i], ['PHP', /\bphp\b/i], ['Scala', /\bscala\b/i],
  ['React', /\breact(\.js|js)?\b/i], ['Vue', /\bvue(\.js)?\b/i], ['Angular', /\bangular\b/i], ['Node.js', /\bnode\.?js\b/i],
  ['Django', /\bdjango\b/i], ['AWS', /\baws\b|\bamazon web services\b/i], ['Azure', /\bazure\b/i], ['GCP', /\bgcp\b|\bgoogle cloud\b/i],
  ['Kubernetes', /\bkubernetes\b|\bk8s\b/i], ['Docker', /\bdocker\b/i], ['Terraform', /\bterraform\b/i], ['CI/CD', /\bci\/cd\b|\bcontinuous (integration|delivery)\b/i],
  ['SQL', /\bsql\b/i], ['PostgreSQL', /\bpostgres(ql)?\b/i], ['MongoDB', /\bmongo(db)?\b/i], ['Kafka', /\bkafka\b/i], ['Spark', /\b(apache )?spark\b/i],
  ['Airflow', /\bairflow\b/i], ['dbt', /\bdbt\b/i], ['Snowflake', /\bsnowflake\b/i], ['BigQuery', /\bbigquery\b/i], ['Tableau', /\btableau\b/i],
  ['Power BI', /\bpower ?bi\b/i], ['Looker', /\blooker\b/i], ['PyTorch', /\bpytorch\b/i], ['TensorFlow', /\btensorflow\b/i],
  ['Machine learning', /\bmachine learning\b/i], ['NLP', /\bnlp\b|\bnatural language processing\b/i], ['LLMs', /\bllms?\b|\blarge language models?\b/i],
  ['Figma', /\bfigma\b/i], ['User research', /\buser research\b/i], ['Prototyping', /\bprototyp\w+\b/i], ['Design systems', /\bdesign systems?\b/i],
  ['Agile', /\bagile\b/i], ['Scrum', /\bscrum\b/i], ['Jira', /\bjira\b/i], ['A/B testing', /\ba\/b test\w*|\bexperimentation\b/i], ['GraphQL', /\bgraphql\b/i],
  ['Microservices', /\bmicroservices?\b/i], ['Linux', /\blinux\b/i], ['Penetration testing', /\bpen(etration)?[- ]?test\w*/i], ['SIEM', /\bsiem\b/i],
  ['ISO 27001', /\biso ?27001\b/i], ['OWASP', /\bowasp\b/i], ['Splunk', /\bsplunk\b/i], ['Salesforce', /\bsalesforce\b/i], ['Excel', /\bexcel\b/i]
];

export function extractSkills(text: string, max = 15): string[] {
  const out: string[] = [];
  for (const [name, re] of SKILLS) if (re.test(text) && out.push(name) >= max) break;
  return out;
}

export function extractYears(text: string): number | null {
  const m = text.match(/\b(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*)?years?[’']?\s*(?:of\s+)?(?:[\w/-]+\s+){0,4}?experience/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 0 && n <= 25 ? n : null;
}

export function mentionsDegree(text: string): boolean {
  return /\b(bachelor|b\.?sc|m\.?sc|master[’']?s|degree|phd|doctorate)\b/i.test(text);
}
