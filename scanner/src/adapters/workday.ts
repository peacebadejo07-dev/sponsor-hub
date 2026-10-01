import { fetchJson, hostResolves } from '@sponsored/http';
import { htmlToText, isUkLocation } from '@sponsored/core';
import type { Adapter, BoardResult, RawJob, RawWorkMode } from '../types.ts';

/** Workday's public job-site API ("CXS"). The slug is `tenant.wdN/site`, e.g. `arcticwolf.wd1/External`. */

interface WdPosting {
  title: string;
  externalPath: string;
  locationsText?: string;
  timeType?: string;
  postedOn?: string;
  bulletFields?: string[];
}
interface WdFacetValue {
  descriptor?: string;
  id?: string;
  count?: number;
  facetParameter?: string;
  values?: WdFacetValue[];
}
interface WdList {
  total?: number;
  jobPostings?: WdPosting[];
  facets?: WdFacetValue[];
}
interface WdDetail {
  jobPostingInfo?: {
    jobDescription?: string;
    location?: string;
    additionalLocations?: string[];
    startDate?: string;
    timeType?: string;
    remoteType?: string;
    externalUrl?: string;
    country?: { descriptor?: string };
  };
}

const PAGE = 20; // Workday caps the page size
const MAX_PAGES = 25;
const HOST_GUESSES = ['wd1', 'wd3', 'wd5', 'wd12', 'wd2', 'wd4', 'wd10', 'wd102', 'wd103', 'wd501', 'wd502', 'wd503'];

export function parseSlug(slug: string): { tenant: string; wd: string | null; site: string } | null {
  const [hostPart, site] = slug.split('/');
  if (!hostPart || !site) return null;
  const m = hostPart.match(/^(.+)\.(wd\d+)$/i);
  return m ? { tenant: m[1], wd: m[2].toLowerCase(), site } : { tenant: hostPart, wd: null, site };
}

/**
 * Find the UK location filter in a first-page response. Returns the facet parameter and the ids of every
 * UK location, so the board can be listed with UK jobs only. null = the board offers no location facet.
 */
export function ukLocationFacet(facets: WdFacetValue[] | undefined): { param: string; ids: string[]; any: boolean } | null {
  const groups: { param: string; values: WdFacetValue[] }[] = [];
  const walk = (list: WdFacetValue[]) => {
    for (const f of list) {
      if (f.facetParameter && /location/i.test(f.facetParameter) && f.values?.some((v) => v.id)) groups.push({ param: f.facetParameter, values: f.values });
      if (f.values?.length) walk(f.values);
    }
  };
  walk(facets ?? []);
  if (!groups.length) return null;
  // Prefer a country-level facet, then the finer-grained one.
  groups.sort((a, b) => Number(/country/i.test(b.param)) - Number(/country/i.test(a.param)));
  for (const g of groups) {
    const ids = g.values.filter((v) => v.id && v.descriptor && isUkLocation([v.descriptor])).map((v) => v.id!);
    if (ids.length) return { param: g.param, ids, any: true };
  }
  return { param: groups[0].param, ids: [], any: false }; // facet exists, but no UK location on this board
}

/** "Posted Today", "Posted Yesterday", "Posted 3 Days Ago", "Posted 30+ Days Ago" -> approximate date. */
export function parsePostedOn(text: string | undefined, now = new Date()): Date | null {
  if (!text) return null;
  const t = text.toLowerCase();
  let days: number | null = null;
  if (/today/.test(t)) days = 0;
  else if (/yesterday/.test(t)) days = 1;
  else {
    const m = t.match(/(\d+)\+?\s*days?/);
    if (m) days = parseInt(m[1], 10);
  }
  return days == null ? null : new Date(now.getTime() - days * 86_400_000);
}

const WORK: [RegExp, RawWorkMode][] = [
  [/^remote/i, 'remote'],
  [/hybrid/i, 'hybrid'],
  [/on[- ]?site|office/i, 'onsite']
];

export function mapWorkday(p: WdPosting, base: string, siteUrl: string, ukFiltered: boolean, now = new Date()): RawJob {
  const reqId = p.bulletFields?.[0] ?? p.externalPath.match(/_([A-Za-z0-9-]+)$/)?.[1] ?? p.externalPath;
  return {
    externalId: reqId,
    title: p.title.trim(),
    locations: p.locationsText ? [p.locationsText] : [],
    // The list is filtered to UK locations, so each job has at least one UK site even when it says "2 Locations".
    countryCodes: ukFiltered ? ['GB'] : [],
    applyUrl: `${siteUrl}${p.externalPath}`,
    postedAt: parsePostedOn(p.postedOn, now),
    department: null,
    employmentTypeRaw: p.timeType ?? null,
    workMode: null,
    descriptionText: null,
    salary: null,
    ref: JSON.stringify({ base, path: p.externalPath })
  };
}

async function listPage(base: string, offset: number, facet: Record<string, string[]>) {
  return fetchJson<WdList>(`${base}/jobs`, {
    method: 'POST',
    body: JSON.stringify({ appliedFacets: facet, limit: PAGE, offset, searchText: '' })
  });
}

export const workday: Adapter = {
  source: 'workday',
  async fetchBoard(slug): Promise<BoardResult> {
    const parsed = parseSlug(slug);
    if (!parsed) return { ok: false, status: 0, jobs: [] };
    const guesses = parsed.wd ? [parsed.wd] : HOST_GUESSES;
    let first: Awaited<ReturnType<typeof listPage>> | null = null;
    let foundWd = '';
    let base = '';
    let siteUrl = '';
    let lastStatus = 0;
    for (const wd of guesses) {
      const host = `${parsed.tenant}.${wd}.myworkdayjobs.com`;
      if (!(await hostResolves(host))) continue;
      const b = `https://${host}/wday/cxs/${parsed.tenant}/${parsed.site}`;
      const r = await listPage(b, 0, {});
      lastStatus = r.status || lastStatus;
      if (r.ok && r.data?.jobPostings) {
        first = r;
        foundWd = wd;
        base = b;
        siteUrl = `https://${host}/${parsed.site}`;
        break;
      }
    }
    if (!first?.data) return { ok: false, status: lastStatus, jobs: [] };

    const canonical = `${parsed.tenant}.${foundWd}/${parsed.site}`;
    const facet = ukLocationFacet(first.data.facets);
    if (facet && !facet.any) return { ok: true, status: 200, jobs: [], slug: canonical }; // no UK location at all
    const applied = facet ? { [facet.param]: facet.ids } : {};
    const ukFiltered = !!facet;

    // Re-list with the UK filter; with no filter available, page through everything (capped).
    const postings: WdPosting[] = [];
    let total = Infinity;
    for (let page = 0; page < MAX_PAGES && postings.length < total; page++) {
      const r = page === 0 && !facet ? first : await listPage(base, page * PAGE, applied);
      if (!r.ok || !r.data?.jobPostings) return { ok: page > 0, status: r.status, jobs: postings.map((p) => mapWorkday(p, base, siteUrl, ukFiltered)), slug: canonical };
      if (page === 0 || facet) total = r.data.total ?? total;
      if (!r.data.jobPostings.length) break;
      postings.push(...r.data.jobPostings);
    }
    return { ok: true, status: 200, jobs: postings.map((p) => mapWorkday(p, base, siteUrl, ukFiltered)), slug: canonical };
  },

  async enrich(_slug, job) {
    if (!job.ref) return null;
    const { base, path } = JSON.parse(job.ref) as { base: string; path: string };
    const r = await fetchJson<WdDetail>(`${base}${path}`);
    const info = r.data?.jobPostingInfo;
    if (!r.ok || !info) return null;
    const remote = info.remoteType ? WORK.find(([re]) => re.test(info.remoteType!))?.[1] : undefined;
    const start = info.startDate ? new Date(info.startDate) : null;
    return {
      descriptionText: htmlToText(info.jobDescription ?? ''),
      applyUrl: info.externalUrl ?? null,
      locations: [info.location, ...(info.additionalLocations ?? [])].filter((x): x is string => !!x),
      workMode: remote ?? null,
      postedAt: start && !Number.isNaN(start.getTime()) ? start : null,
      employmentTypeRaw: info.timeType ?? null
    };
  }
};
