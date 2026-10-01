import { fetchJson } from '@sponsored/http';
import { htmlToText } from '@sponsored/core';
import type { Adapter, RawJob } from '../types.ts';

interface SrJob {
  id: string;
  name: string;
  releasedDate?: string;
  location?: { city?: string; region?: string; country?: string; remote?: boolean; hybrid?: boolean; fullLocation?: string };
  department?: { label?: string };
  function?: { label?: string };
  typeOfEmployment?: { label?: string };
}
interface SrDetail {
  applyUrl?: string;
  postingUrl?: string;
  jobAd?: { sections?: Record<string, { text?: string }> };
}

export function mapSmartRecruiters(j: SrJob): RawJob {
  const l = j.location ?? {};
  return {
    externalId: j.id,
    title: j.name.trim(),
    locations: [l.fullLocation ?? [l.city, l.region, l.country].filter(Boolean).join(', ')].filter(Boolean),
    countryCodes: l.country ? [l.country] : [],
    applyUrl: null, // filled from the detail call
    postedAt: j.releasedDate ? new Date(j.releasedDate) : null,
    department: j.department?.label ?? j.function?.label ?? null,
    employmentTypeRaw: j.typeOfEmployment?.label ?? null,
    workMode: l.remote ? 'remote' : l.hybrid ? 'hybrid' : null,
    descriptionText: null,
    salary: null
  };
}

const PAGE = 100;
const MAX_PAGES = 5;

export const smartrecruiters: Adapter = {
  source: 'smartrecruiters',
  async fetchBoard(slug) {
    const s = encodeURIComponent(slug);
    const jobs: RawJob[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      // The API can filter by country, which keeps large employers (thousands of jobs worldwide) manageable.
      const r = await fetchJson<{ totalFound?: number; content?: SrJob[] }>(
        `https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=${PAGE}&offset=${page * PAGE}&country=gb`
      );
      if (!r.ok || !r.data) return { ok: page > 0, status: r.status, jobs };
      const items = r.data.content ?? [];
      jobs.push(...items.map(mapSmartRecruiters));
      if (items.length < PAGE || jobs.length >= (r.data.totalFound ?? 0)) break;
    }
    return { ok: true, status: 200, jobs };
  },
  async enrich(slug, job) {
    const r = await fetchJson<SrDetail>(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings/${encodeURIComponent(job.externalId)}`);
    if (!r.ok || !r.data) return null;
    const sections = Object.values(r.data.jobAd?.sections ?? {}).map((s) => htmlToText(s.text ?? ''));
    return { descriptionText: sections.join('\n'), applyUrl: r.data.postingUrl ?? r.data.applyUrl ?? null };
  }
};
