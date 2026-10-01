import * as cheerio from 'cheerio';
import { fetchPage } from '@sponsored/http';
import { decodeEntities, htmlToText, mapEmploymentType, type Salary } from '@sponsored/core';
import type { Adapter, RawJob } from '../types.ts';

/**
 * Fallback for careers pages with no job-board API: read schema.org JobPosting structured data (JSON-LD), which
 * employers publish for Google for Jobs. The slug is the careers page URL.
 */

type Json = any; // JSON-LD is loosely typed by nature

const MAX_JOB_PAGES = 30;
const GIVE_UP_AFTER = 8; // job pages fetched with no structured data at all

function walk(node: Json, out: Json[]) {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, out));
  if (!node || typeof node !== 'object') return;
  const type = node['@type'];
  const types: string[] = Array.isArray(type) ? type : type ? [type] : [];
  if (types.includes('JobPosting')) out.push(node);
  if (node['@graph']) walk(node['@graph'], out);
  if (node.itemListElement) walk(node.itemListElement, out);
  if (node.item) walk(node.item, out);
  if (node.mainEntity) walk(node.mainEntity, out);
}

/** Every JobPosting object in the page's JSON-LD blocks. Tolerates broken JSON in one block. */
export function extractJobPostings(html: string): Json[] {
  const $ = cheerio.load(html);
  const out: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    for (const candidate of [raw, raw.replace(/<!--|-->/g, '').replace(/,\s*([}\]])/g, '$1')]) {
      try {
        walk(JSON.parse(candidate), out);
        return;
      } catch {
        /* try the next, more lenient form */
      }
    }
  });
  return out;
}

const str = (v: Json): string => (typeof v === 'string' ? v : typeof v?.name === 'string' ? v.name : '').trim();

function locationParts(loc: Json): { text: string; country: string | null } {
  if (!loc) return { text: '', country: null };
  const addr = loc.address ?? loc;
  if (typeof addr === 'string') return { text: addr, country: null };
  const country = str(addr.addressCountry);
  const text = [str(addr.streetAddress) && '', str(addr.addressLocality), str(addr.addressRegion), country].filter(Boolean).join(', ');
  return { text, country: country || null };
}

function unit(u: string | undefined): Salary['period'] | null {
  switch ((u ?? '').toUpperCase()) {
    case 'YEAR': return 'year';
    case 'MONTH': return 'month';
    case 'DAY': return 'day';
    case 'HOUR': return 'hour';
    default: return null;
  }
}

export function jsonLdSalary(base: Json): Salary | null {
  const cur = String(base?.currency ?? '').toUpperCase();
  const v = base?.value;
  if (!v || !['GBP', 'USD', 'EUR'].includes(cur)) return null;
  const min = Number(v.minValue);
  const max = Number(v.maxValue);
  const period = unit(v.unitText);
  if (!(min > 0) || !(max >= min) || !period) return null; // a single figure or unknown unit is not a range we can trust
  return { min, max, currency: cur as Salary['currency'], period };
}

/** One JobPosting to our raw job shape, or null if it has expired or lacks the essentials. */
export function mapJobPosting(p: Json, pageUrl: string, now = new Date()): RawJob | null {
  const title = decodeEntities(str(p.title)).trim();
  if (!title) return null;
  if (p.validThrough) {
    const until = new Date(p.validThrough);
    if (!Number.isNaN(until.getTime()) && until < now) return null; // the employer says it has closed
  }
  const locs: { text: string; country: string | null }[] = (Array.isArray(p.jobLocation) ? p.jobLocation : p.jobLocation ? [p.jobLocation] : []).map(locationParts);
  const remote = String(p.jobLocationType ?? '').toUpperCase() === 'TELECOMMUTE';
  const applicant = (Array.isArray(p.applicantLocationRequirements) ? p.applicantLocationRequirements : p.applicantLocationRequirements ? [p.applicantLocationRequirements] : []).map(str);
  const locations = [...locs.map((l) => l.text), ...(remote ? ['Remote', ...applicant] : [])].filter(Boolean);
  const url = typeof p.url === 'string' && p.url ? new URL(p.url, pageUrl).toString() : pageUrl;
  const id = typeof p.identifier === 'string' ? p.identifier : p.identifier?.value != null ? String(p.identifier.value) : null;
  const emp = Array.isArray(p.employmentType) ? p.employmentType[0] : p.employmentType;
  const posted = p.datePosted ? new Date(p.datePosted) : null;
  return {
    externalId: id ?? new URL(url).pathname + new URL(url).search,
    title,
    locations,
    countryCodes: locs.map((l) => l.country).filter((c): c is string => !!c && /^[A-Za-z]{2,3}$/.test(c)),
    applyUrl: url,
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    department: str(p.occupationalCategory) || null,
    employmentTypeRaw: typeof emp === 'string' ? emp : null,
    workMode: remote ? 'remote' : null,
    descriptionText: p.description ? htmlToText(String(p.description)) : null,
    salary: jsonLdSalary(p.baseSalary)
  };
}

const JOB_PATH = /\/(jobs?|vacanc(y|ies)|positions?|openings?|roles?|careers?)\/[^/?#]+/i;
const NOT_JOB = /\/(category|categories|tag|page|location|locations|team|teams|department|departments|search|apply|login|blog|news)\b|\.(pdf|jpg|png|zip)$|^mailto:|^tel:/i;

/** Links that look like individual job pages, best first. Same site only. */
export function jobLinks(html: string, pageUrl: string, limit = MAX_JOB_PAGES): string[] {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const host = base.hostname.replace(/^www\./, '');
  const scored = new Map<string, number>();
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').trim();
    if (!href || href.startsWith('#') || NOT_JOB.test(href)) return;
    let u: URL;
    try {
      u = new URL(href, pageUrl);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, '') !== host) return;
    u.hash = '';
    const here = base.pathname.replace(/\/$/, '');
    if (u.pathname.replace(/\/$/, '') === here) return;
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    let score = 0;
    if (JOB_PATH.test(u.pathname)) score += 3;
    if (u.pathname.startsWith(here + '/') && u.pathname.length > here.length + 3) score += 2; // a child of the listing
    if (text.length >= 5 && text.length <= 120) score += 1;
    if (score >= 3) scored.set(u.toString(), Math.max(scored.get(u.toString()) ?? 0, score));
  });
  return [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([u]) => u);
}

export const jsonld: Adapter = {
  source: 'jsonld',
  async fetchBoard(careersUrl) {
    const page = await fetchPage(careersUrl); // robots.txt respected, 1 request/second/host
    if (!page || page.status >= 400) return { ok: false, status: page?.status ?? 0, jobs: [] };

    const jobs = new Map<string, RawJob>();
    const add = (postings: Json[], at: string) => {
      for (const p of postings) {
        const j = mapJobPosting(p, at);
        if (j) jobs.set(j.externalId, j);
      }
    };
    add(extractJobPostings(page.text), page.url);
    if (jobs.size > 0) return { ok: true, status: 200, jobs: [...jobs.values()] };

    // No structured data on the listing: try the individual job pages it links to.
    let fetched = 0;
    let withData = 0;
    for (const link of jobLinks(page.text, page.url)) {
      if (withData === 0 && fetched >= GIVE_UP_AFTER) break; // this site does not publish structured data
      const jp = await fetchPage(link);
      fetched++;
      if (!jp || jp.status >= 400) continue;
      const postings = extractJobPostings(jp.text);
      if (postings.length) withData++;
      add(postings, jp.url);
    }
    return { ok: true, status: 200, jobs: [...jobs.values()] };
  }
};
