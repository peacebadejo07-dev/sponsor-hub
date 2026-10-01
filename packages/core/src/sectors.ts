import { classifyName, type SectorTag } from './classify.ts';
import type { RoleFamily } from './jobs.ts';

/**
 * What sector is an organisation in? Evidence, strongest first:
 *   sic     Companies House SIC codes the company registered itself (official, but coarse and sometimes stale)
 *   website the organisation's own homepage title and description
 *   jobs    what it is hiring for right now (only used when nothing stronger exists: a bank hiring engineers is not a tech company)
 *   name    keywords in the organisation's name (last resort, the least reliable)
 * Every tag records which source produced it, so the page can show its evidence.
 */

export type SectorSource = 'sic' | 'website' | 'jobs' | 'name';
export interface SectorEvidence {
  tag: SectorTag;
  source: SectorSource;
  detail?: string; // e.g. "SIC 62012" or "5 software roles"
}
export interface SectorResult {
  tags: SectorTag[];
  basis: SectorSource | null; // strongest source that produced anything
  evidence: SectorEvidence[];
}

const TECHY = ['tech'] as const;

/** SIC 2007 codes (5 digits; matched by prefix) to sector tags. Order matters only for readability. */
const SIC_RULES: { prefix: string; tags: SectorTag[] }[] = [
  { prefix: '58210', tags: ['games', ...TECHY] },
  { prefix: '58290', tags: ['software', ...TECHY] },
  { prefix: '6201', tags: ['software', ...TECHY] }, // 62011 ready-made software, 62012 business software, 62013
  { prefix: '6202', tags: ['it_services', ...TECHY] }, // IT consultancy
  { prefix: '6203', tags: ['it_services', ...TECHY] }, // computer facilities management
  { prefix: '6209', tags: ['it_services', ...TECHY] },
  { prefix: '6311', tags: ['data', 'cloud', ...TECHY] }, // data processing, hosting
  { prefix: '6312', tags: ['digital', ...TECHY] }, // web portals
  { prefix: '61', tags: ['telecoms', ...TECHY] },
  { prefix: '261', tags: ['electronics', ...TECHY] }, // electronic components and boards
  { prefix: '262', tags: ['electronics', ...TECHY] }, // computers
  { prefix: '263', tags: ['electronics', 'telecoms', ...TECHY] }, // communication equipment
  { prefix: '264', tags: ['electronics', ...TECHY] },
  { prefix: '265', tags: ['electronics', ...TECHY] }, // measuring and navigation instruments
  { prefix: '268', tags: ['electronics', ...TECHY] },
  { prefix: '72190', tags: ['engineering'] }, // R&D, natural sciences and engineering
  { prefix: '72110', tags: ['healthcare'] }, // R&D, biotechnology
  { prefix: '71', tags: ['engineering'] }, // architecture and engineering activities, testing
  { prefix: '74100', tags: ['design'] }, // specialised design
  { prefix: '64110', tags: ['finance'] },
  { prefix: '6419', tags: ['finance'] },
  { prefix: '6491', tags: ['finance'] },
  { prefix: '6492', tags: ['finance'] },
  { prefix: '6499', tags: ['finance'] },
  { prefix: '65', tags: ['finance'] },
  { prefix: '66', tags: ['finance'] },
  { prefix: '6430', tags: ['finance'] },
  { prefix: '6630', tags: ['finance'] },
  { prefix: '86', tags: ['healthcare'] },
  { prefix: '21', tags: ['healthcare'] },
  { prefix: '85', tags: ['education'] }
];

/**
 * Codes that describe a kind of paperwork, not an industry: holding companies, head offices, "other" business
 * support, management consultancy, property, dormant. A company with only these has no sector from its SIC.
 */
export const GENERIC_SIC = [
  '64201', '64202', '64203', '64204', '64205', '64209', '64301', '64302', '64303', '64304', '64305', '64306', // holding companies and trusts
  '70100', '70210', '70221', '70229', '74901', '74902', '74909', '74990', '78101', '78109', '78200', '78300', // head offices, consultancy, agencies
  '82110', '82190', '82990', '68100', '68209', '68310', '68320', '96090', '98000', '98100', '99999', '99000'
];

const clean = (c: string) => c.replace(/\D/g, '');

/** True when the company registered at least one specific (non-generic) code. */
export function hasSpecificSic(codes: string[]): boolean {
  return (codes ?? []).some((raw) => {
    const c = clean(raw).padEnd(5, '0').slice(0, 5);
    return clean(raw).length >= 4 && !GENERIC_SIC.includes(c) && !c.startsWith('68') && c !== '99999';
  });
}

export function sicEvidence(codes: string[]): SectorEvidence[] {
  const out: SectorEvidence[] = [];
  for (const raw of codes ?? []) {
    const c = clean(raw).padEnd(5, '0').slice(0, 5);
    if (c.length < 4 || GENERIC_SIC.includes(c)) continue;
    // The most specific rule wins: 72190 must not fall through to a broader prefix, 62012 to 6201 only.
    const rule = SIC_RULES.filter((r) => c.startsWith(r.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0];
    if (!rule) continue;
    for (const tag of rule.tags) out.push({ tag, source: 'sic', detail: `SIC ${clean(raw)}` });
  }
  return out;
}

/** Sectors we trust a homepage description to indicate (name-style 'digital'/'consulting' are too noisy in prose). */
const TEXT_TAGS = new Set<SectorTag>(['software', 'ai', 'data', 'cloud', 'cybersecurity', 'it_services', 'fintech', 'design', 'games', 'telecoms', 'electronics']);

export function sectorsFromText(text: string): SectorTag[] {
  const tags = classifyName(text).filter((t) => TEXT_TAGS.has(t));
  if (tags.length) tags.push('tech');
  return [...new Set(tags)];
}

/** Role family to sector, used only as a weak signal and only when an organisation has several such roles. */
const FAMILY_TAG: Partial<Record<RoleFamily, SectorTag>> = {
  software: 'software', ai_ml: 'ai', data: 'data', cloud_devops: 'cloud', cybersecurity: 'cybersecurity', design: 'design'
};
export const MIN_JOBS_FOR_SECTOR = 3;

export function jobEvidence(familyCounts: Partial<Record<RoleFamily, number>>): SectorEvidence[] {
  const out: SectorEvidence[] = [];
  for (const [family, tag] of Object.entries(FAMILY_TAG) as [RoleFamily, SectorTag][]) {
    const n = familyCounts[family] ?? 0;
    if (n >= MIN_JOBS_FOR_SECTOR) out.push({ tag, source: 'jobs', detail: `${n} live ${family.replace('_', '/')} roles` });
  }
  if (out.length) out.push({ tag: 'tech', source: 'jobs' });
  return out;
}

export interface SectorInputs {
  sic?: string[];
  websiteText?: string | null;
  jobFamilies?: Partial<Record<RoleFamily, number>>;
  name: string;
}

export function deriveSectors(i: SectorInputs): SectorResult {
  const strong: SectorEvidence[] = [
    ...sicEvidence(i.sic ?? []),
    ...(i.websiteText ? sectorsFromText(i.websiteText).map((tag): SectorEvidence => ({ tag, source: 'website' })) : [])
  ];
  // Jobs only speak when the official code and the website said nothing: hiring engineers does not make a bank a tech company.
  const evidence = strong.length ? strong : jobEvidence(i.jobFamilies ?? {});
  // The name is the last resort, and never overrides an official code: a company registered as a restaurant is not
  // a tech company because "Digital" is in its name.
  const final = evidence.length || hasSpecificSic(i.sic ?? []) ? evidence : classifyName(i.name).map((tag): SectorEvidence => ({ tag, source: 'name' }));

  const byTag = new Map<SectorTag, SectorEvidence>();
  const rank: Record<SectorSource, number> = { sic: 0, website: 1, jobs: 2, name: 3 };
  for (const e of final) {
    const have = byTag.get(e.tag);
    if (!have || rank[e.source] < rank[have.source]) byTag.set(e.tag, e);
  }
  const ev = [...byTag.values()];
  const basis = ev.length ? ev.reduce((a, e) => (rank[e.source] < rank[a] ? e.source : a), ev[0].source) : null;
  return { tags: ev.map((e) => e.tag), basis, evidence: ev };
}
