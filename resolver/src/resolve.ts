import * as cheerio from 'cheerio';
import { classifyName, type SectorTag } from '@sponsored/core';
import { fetchPage, hostResolves } from './http.ts';
import { domainCandidates, verifyHomepage, coreName, labelOf, BOT_CHALLENGE, type Verdict } from './names.ts';
import { detectAts, extractCareersLinks, COMMON_CAREER_PATHS, type AtsHit } from './ats.ts';
import { wikidataLookup, sizeBand, type WikidataInfo } from './wikidata.ts';
import { companiesHouseLookup, sicToTags, type CompanyInfo } from './companieshouse.ts';

export interface OrgInput {
  name: string;
  town?: string;
  county?: string;
}

export interface Provenance {
  status: 'verified' | 'inferred' | 'unconfirmed';
  source: string;
  confidence?: number;
  detail?: string;
  checked_at: string;
}

export interface ProfileResult {
  status: 'resolved' | 'candidate' | 'not_found' | 'error';
  website: string | null;
  websiteConfidence: number | null;
  websiteSource: string | null;
  websiteCandidate: string | null;
  careersUrl: string | null;
  ats: AtsHit | null;
  wikidata: WikidataInfo | null;
  company: CompanyInfo | null;
  sectorTags: SectorTag[];
  siteTitle: string | null;
  siteDescription: string | null;
  provenance: Record<string, Provenance>;
}

const ACCEPT = 0.6;
const CANDIDATE = 0.4;

/** Sectors we trust a homepage description to indicate (name-style 'digital'/'consulting' are too noisy in prose). */
const TEXT_TAGS = new Set<SectorTag>(['software', 'ai', 'data', 'cloud', 'cybersecurity', 'it_services', 'fintech', 'design', 'games', 'telecoms', 'electronics']);

export function sectorsFromText(text: string): SectorTag[] {
  const tags = classifyName(text).filter((t) => TEXT_TAGS.has(t));
  if (tags.length) tags.push('tech');
  return [...new Set(tags)];
}

interface Candidate {
  url: string;
  html: string;
  verdict: Verdict;
  blocked?: boolean;
}

async function tryDomain(domain: string, org: OrgInput): Promise<Candidate | null> {
  let url = /^https?:\/\//.test(domain) ? domain : `https://${domain}`;
  // Only fetch hosts that resolve; fall back to the www. host when the bare domain does not.
  const host = new URL(url).hostname;
  if (!(await hostResolves(host))) {
    if (host.startsWith('www.') || !(await hostResolves(`www.${host}`))) return null;
    url = url.replace('://', '://www.');
  }
  const page = await fetchPage(url);
  if (!page) return null;
  if ((page.status === 403 || page.status === 429 || page.status === 503) && BOT_CHALLENGE.test(page.text.slice(0, 20_000))) {
    return { url: page.url, html: '', blocked: true, verdict: { confidence: 0, reasons: ['site blocks automated access'], title: '', description: '', hasUkSignal: false } };
  }
  if (page.status >= 400 || !/html|xml/i.test(page.contentType || 'html')) return null;
  return { url: page.url, html: page.text, verdict: verifyHomepage(page.text, page.url, org) };
}

async function findCareers(home: Candidate): Promise<{ careersUrl: string | null; ats: AtsHit | null }> {
  let ats = detectAts(home.html);
  const links = extractCareersLinks(home.html, home.url, 4);
  let careersUrl: string | null = null;
  for (const link of links) {
    const direct = detectAts(link);
    if (direct) {
      ats ??= direct;
      careersUrl ??= link;
      continue;
    }
    const page = await fetchPage(link);
    if (!page || page.status >= 400) continue;
    careersUrl ??= page.url;
    ats ??= detectAts(page.url) ?? detectAts(page.text);
    if (ats) break;
  }
  if (!careersUrl) {
    for (const p of COMMON_CAREER_PATHS.slice(0, 3)) {
      const page = await fetchPage(new URL(p, home.url).toString());
      if (!page || page.status >= 400 || !/html/i.test(page.contentType)) continue;
      const $ = cheerio.load(page.text);
      const heading = ($('title').text() + ' ' + $('h1').first().text()).toLowerCase();
      if (/career|jobs|vacanc|join/.test(heading)) {
        careersUrl = page.url;
        ats ??= detectAts(page.text);
        break;
      }
    }
  }
  return { careersUrl, ats };
}

export async function resolveOrg(org: OrgInput, opts: { companiesHouseKey?: string } = {}): Promise<ProfileResult> {
  const now = new Date().toISOString();
  const prov: Record<string, Provenance> = {};
  const result: ProfileResult = {
    status: 'not_found', website: null, websiteConfidence: null, websiteSource: null, websiteCandidate: null,
    careersUrl: null, ats: null, wikidata: null, company: null, sectorTags: [], siteTitle: null, siteDescription: null, provenance: prov
  };

  const [wd, ch] = await Promise.all([
    wikidataLookup(org.name).catch(() => null),
    opts.companiesHouseKey ? companiesHouseLookup(org.name, org.town, opts.companiesHouseKey).catch(() => null) : Promise.resolve(null)
  ]);
  result.wikidata = wd;
  result.company = ch;
  if (wd) {
    prov.wikidata = { status: 'inferred', source: 'wikidata', detail: wd.id, checked_at: now };
    if (sizeBand(wd.employees)) prov.size_band = { status: 'inferred', source: 'wikidata', checked_at: now };
  }
  const tags = new Set<SectorTag>();
  if (ch) {
    prov.companies_house = { status: 'verified', source: 'companies_house', detail: ch.number, checked_at: now };
    sicToTags(ch.sic).forEach((t) => tags.add(t));
  }

  // Website: Wikidata's official-website claim first, then domain guessing.
  let best: Candidate | null = null;
  let blocked: Candidate | null = null;
  let source = '';
  const tried = new Set<string>();
  if (wd?.website) {
    const c = await tryDomain(wd.website, org);
    if (c) {
      best = { ...c, verdict: { ...c.verdict, confidence: Math.max(c.verdict.confidence, 0.85), reasons: ['official website claim on Wikidata', ...c.verdict.reasons] } };
      source = 'wikidata';
    }
  }
  if (!best) {
    const guesses = domainCandidates(org.name);
    // Resolve all candidates' DNS up front, in parallel, so dead names cost nothing.
    const live = new Set<string>();
    await Promise.all(guesses.map(async (d) => { if ((await hostResolves(d)) || (await hostResolves(`www.${d}`))) live.add(d); }));
    const deadline = Date.now() + 45_000;
    for (const domain of guesses.filter((d) => live.has(d))) {
      if (Date.now() > deadline) break;
      if (tried.has(domain)) continue;
      tried.add(domain);
      const c = await tryDomain(domain, org);
      if (!c) continue;
      if (c.blocked) {
        // Only remember a blocked site if its domain is the organisation's own name.
        const core = coreName(org.name);
        const l = labelOf(c.url);
        if (!blocked && (l === core.tokens.join('') || (l === core.brand && core.brand.length >= 7))) blocked = c;
        continue;
      }
      if (!best || c.verdict.confidence > best.verdict.confidence) {
        best = c;
        source = 'domain_guess';
      }
      if (c.verdict.confidence >= 0.8) break;
    }
  }

  if ((!best || best.verdict.confidence < CANDIDATE) && blocked) {
    result.status = 'candidate';
    result.websiteCandidate = new URL(blocked.url).origin;
    prov.website = { status: 'unconfirmed', source: 'domain_guess', detail: 'domain matches the name but the site blocks automated access, so it could not be verified', checked_at: now };
  } else if (!best || best.verdict.confidence < CANDIDATE) {
    result.status = 'not_found';
    prov.website = { status: 'unconfirmed', source: 'domain_guess', detail: 'no verified website found', checked_at: now };
  } else if (best.verdict.confidence < ACCEPT) {
    result.status = 'candidate';
    result.websiteCandidate = best.url;
    prov.website = { status: 'unconfirmed', source, confidence: best.verdict.confidence, detail: `low-confidence candidate: ${best.verdict.reasons.join('; ')}`, checked_at: now };
  } else {
    result.status = 'resolved';
    result.website = new URL(best.url).origin;
    result.websiteConfidence = best.verdict.confidence;
    result.websiteSource = source;
    result.siteTitle = best.verdict.title.slice(0, 200) || null;
    result.siteDescription = best.verdict.description.slice(0, 400) || null;
    prov.website = { status: 'inferred', source, confidence: best.verdict.confidence, detail: best.verdict.reasons.join('; '), checked_at: now };
    sectorsFromText(`${best.verdict.title} ${best.verdict.description}`).forEach((t) => tags.add(t));
    if (tags.size) prov.sector_tags = { status: 'inferred', source: ch ? 'companies_house+website_text' : 'website_text', checked_at: now };

    const { careersUrl, ats } = await findCareers(best);
    result.careersUrl = careersUrl;
    result.ats = ats;
    const trusted = best.verdict.confidence >= 0.85;
    if (careersUrl) {
      prov.careers_url = { status: trusted ? 'verified' : 'inferred', source: 'link on organisation website', checked_at: now, ...(trusted ? {} : { detail: 'website match is not high-confidence' }) };
    } else {
      prov.careers_url = { status: 'unconfirmed', source: 'link on organisation website', detail: 'no careers page found', checked_at: now };
    }
    if (ats) prov.ats = { status: 'verified', source: 'link or embed on careers page', detail: `${ats.ats}:${ats.slug}`, checked_at: now };
  }
  result.sectorTags = [...tags];
  return result;
}
