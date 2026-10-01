import { fetchJson } from '@sponsored/http';
import { htmlToText } from '@sponsored/core';
import type { Adapter, RawJob } from '../types.ts';

interface WkJob {
  title: string;
  shortcode: string;
  employment_type?: string | null;
  telecommuting?: boolean;
  department?: string | null;
  url?: string;
  application_url?: string;
  published_on?: string | null;
  created_at?: string | null;
  country?: string | null;
  city?: string | null;
  locations?: { country?: string; countryCode?: string; city?: string; region?: string; hidden?: boolean }[];
  description?: string;
}

export function mapWorkable(j: WkJob): RawJob {
  const locs = (j.locations?.length ? j.locations : [{ city: j.city ?? undefined, country: j.country ?? undefined }])
    .filter((l) => !l.hidden)
    .map((l) => [l.city, l.region, l.country].filter(Boolean).join(', '))
    .filter(Boolean);
  const posted = j.published_on ?? j.created_at;
  return {
    externalId: j.shortcode,
    title: j.title.trim(),
    locations: locs,
    countryCodes: (j.locations ?? []).map((l) => l.countryCode).filter((x): x is string => !!x),
    applyUrl: j.application_url ?? j.url ?? null,
    postedAt: posted ? new Date(posted) : null,
    department: j.department ?? null,
    employmentTypeRaw: j.employment_type ?? null,
    workMode: j.telecommuting ? 'remote' : null, // only a positive flag is reliable; false does not mean onsite
    descriptionText: j.description ? htmlToText(j.description) : null,
    salary: null
  };
}

export const workable: Adapter = {
  source: 'workable',
  async fetchBoard(slug) {
    const r = await fetchJson<{ jobs?: WkJob[] }>(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}?details=true`);
    if (!r.ok || !r.data) return { ok: false, status: r.status, jobs: [] };
    return { ok: true, status: 200, jobs: (r.data.jobs ?? []).map(mapWorkable) };
  }
};
