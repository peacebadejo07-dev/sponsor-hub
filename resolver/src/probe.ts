import { fetchJson } from '@sponsored/http';
import { coreName, isGeneric, normaliseText } from './names.ts';

export type ProbeAts = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters';

export interface ProbeHit {
  ats: ProbeAts;
  slug: string;
  evidence: string; // why we believe the board belongs to this organisation
}

export interface ProbeOrg {
  name: string;
  website?: string | null;
  /** How sure we are that `website` is really this organisation's. A weak guess must not vouch for a board. */
  websiteConfidence?: number | null;
}

/** Below this, the website is not trusted as corroboration (brand-only matches such as elastic.io for "Elastic Path"). */
export const TRUSTED_WEBSITE = 0.8;

const websiteTrusted = (org: ProbeOrg) => !!org.website && (org.websiteConfidence ?? 0) >= TRUSTED_WEBSITE;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,40}$/;

/** Likely board slugs for an organisation, best first. The domain's first label is the strongest hint. */
export function slugCandidates(org: ProbeOrg, limit = 5): string[] {
  const { tokens, brand } = coreName(org.name);
  const out: string[] = [];
  const add = (s: string | null | undefined) => {
    if (s && SLUG_RE.test(s) && !out.includes(s)) out.push(s);
  };
  if (org.website) {
    try {
      add(new URL(org.website).hostname.replace(/^www\./, '').split('.')[0]);
    } catch {
      /* ignore */
    }
  }
  add(tokens.join(''));
  add(tokens.join('-'));
  if (brand.length >= 4) add(brand);
  if (tokens.length >= 2) add(tokens.slice(0, 2).join(''));
  return out.slice(0, limit);
}

/** Does a board's own company name plausibly name this organisation? Pure; used for Greenhouse, Workable, SmartRecruiters. */
export function boardNameMatches(boardName: string | undefined | null, org: ProbeOrg): boolean {
  if (!boardName) return false;
  const b = coreName(boardName);
  const o = coreName(org.name);
  if (!b.phrase || !o.phrase) return false;
  const same = b.phrase === o.phrase;
  const prefix = o.phrase.startsWith(b.phrase + ' ') || b.phrase.startsWith(o.phrase + ' ');
  if (!same && !prefix) return false;
  const shared = b.tokens.length <= o.tokens.length ? b : o;
  const websiteAgrees = domainLabelIs(org.website, shared.phrase.replace(/ /g, ''), org) || domainLabelIs(org.website, shared.tokens.join('-'), org);
  // A name made only of generic words ("AI Tech", "Smart", "Delta") names many unrelated companies.
  if (shared.tokens.every((t) => isGeneric(t))) return websiteAgrees;
  if (same) return true;
  // The board name is only the start of the organisation's name ("Atlantis" vs "Atlantis Technology Solutions").
  // Many unrelated companies share a first word, even uncommon-looking ones, so the website's domain must agree.
  return websiteAgrees;
}

function domainLabelIs(website: string | null | undefined, label: string, org?: ProbeOrg): boolean {
  if (!website || (org && !websiteTrusted(org))) return false;
  try {
    return new URL(website).hostname.replace(/^www\./, '').split('.')[0] === label;
  } catch {
    return false;
  }
}

/** Does job text mention the organisation by name? Used for Lever and Ashby, whose APIs give no company name. */
export function textMentionsOrg(texts: string[], org: ProbeOrg): boolean {
  const o = coreName(org.name);
  if (!o.phrase) return false;
  const joined = ` ${normaliseText(texts.join(' ').slice(0, 30_000))} `;
  if (joined.includes(` ${o.phrase} `)) return true;
  // Brand alone is accepted only when it is a distinctive word and the domain agrees.
  return o.brand.length >= 5 && !isGeneric(o.brand) && joined.includes(` ${o.brand} `) && domainLabelIs(org.website, o.brand, org);
}

async function probeOne(ats: ProbeAts, slug: string, org: ProbeOrg): Promise<ProbeHit | null> {
  const s = encodeURIComponent(slug);
  switch (ats) {
    case 'greenhouse': {
      const r = await fetchJson<{ name?: string }>(`https://boards-api.greenhouse.io/v1/boards/${s}`);
      return r.ok && boardNameMatches(r.data?.name, org) ? { ats, slug, evidence: `Greenhouse board named "${r.data!.name}"` } : null;
    }
    case 'workable': {
      const r = await fetchJson<{ name?: string; jobs?: unknown[] }>(`https://apply.workable.com/api/v1/widget/accounts/${s}`);
      return r.ok && boardNameMatches(r.data?.name, org) ? { ats, slug, evidence: `Workable account named "${r.data!.name}"` } : null;
    }
    case 'smartrecruiters': {
      const r = await fetchJson<{ totalFound?: number; content?: { company?: { name?: string } }[] }>(`https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=1`);
      const name = r.data?.content?.[0]?.company?.name;
      return r.ok && (r.data?.totalFound ?? 0) > 0 && boardNameMatches(name, org) ? { ats, slug, evidence: `SmartRecruiters company "${name}"` } : null;
    }
    case 'lever': {
      let r = await fetchJson<{ descriptionPlain?: string; text?: string }[]>(`https://api.lever.co/v0/postings/${s}?mode=json&limit=3`);
      if (r.status === 404) r = await fetchJson(`https://api.eu.lever.co/v0/postings/${s}?mode=json&limit=3`);
      const jobs = Array.isArray(r.data) ? r.data : [];
      return r.ok && jobs.length && textMentionsOrg(jobs.map((j) => `${j.text ?? ''} ${j.descriptionPlain ?? ''}`), org) ? { ats, slug, evidence: 'Lever job text names the organisation' } : null;
    }
    case 'ashby': {
      const r = await fetchJson<{ jobs?: { title?: string; descriptionPlain?: string }[] }>(`https://api.ashbyhq.com/posting-api/job-board/${s}`);
      const jobs = r.data?.jobs?.slice(0, 3) ?? [];
      return r.ok && jobs.length && textMentionsOrg(jobs.map((j) => `${j.title ?? ''} ${j.descriptionPlain ?? ''}`), org) ? { ats, slug, evidence: 'Ashby job text names the organisation' } : null;
    }
  }
}

const ORDER: ProbeAts[] = ['greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters'];

/** Probe the public job-board APIs for boards belonging to this organisation. Stops at the first verified hit. */
export async function probeBoards(org: ProbeOrg): Promise<ProbeHit | null> {
  for (const slug of slugCandidates(org)) {
    for (const ats of ORDER) {
      const hit = await probeOne(ats, slug, org).catch(() => null);
      if (hit) return hit;
    }
  }
  return null;
}
