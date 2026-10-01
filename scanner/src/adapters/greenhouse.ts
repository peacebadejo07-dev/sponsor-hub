import { fetchJson } from '@sponsored/http';
import { htmlToText } from '@sponsored/core';
import type { Adapter, RawJob } from '../types.ts';

interface GhJob {
  id: number;
  title: string;
  absolute_url?: string;
  location?: { name?: string };
  offices?: { name?: string }[];
  departments?: { name?: string }[];
  first_published?: string;
  updated_at?: string;
  content?: string;
}

export function mapGreenhouse(j: GhJob): RawJob {
  const locs = [j.location?.name, ...(j.offices ?? []).map((o) => o.name)].filter((x): x is string => !!x);
  const posted = j.first_published ?? j.updated_at;
  return {
    externalId: String(j.id),
    title: j.title.trim(),
    locations: [...new Set(locs)],
    countryCodes: [],
    applyUrl: j.absolute_url ?? null,
    postedAt: posted ? new Date(posted) : null,
    department: j.departments?.[0]?.name ?? null,
    employmentTypeRaw: null, // Greenhouse's public API does not say
    workMode: null,
    descriptionText: j.content ? htmlToText(j.content) : null,
    salary: null // Greenhouse's public API has no structured pay; the scanner parses it from the text (inferred)
  };
}

export const greenhouse: Adapter = {
  source: 'greenhouse',
  async fetchBoard(slug) {
    const r = await fetchJson<{ jobs?: GhJob[] }>(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`);
    if (!r.ok || !r.data) return { ok: false, status: r.status, jobs: [] };
    return { ok: true, status: 200, jobs: (r.data.jobs ?? []).map(mapGreenhouse) };
  }
};
