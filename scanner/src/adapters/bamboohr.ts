import { fetchJson } from '@sponsored/http';
import { htmlToText } from '@sponsored/core';
import type { Adapter, RawJob, RawWorkMode } from '../types.ts';

/** BambooHR's careers page is backed by JSON: /careers/list, then /careers/{id}/detail for the description. */

interface BbJob {
  id: string | number;
  jobOpeningName: string;
  departmentLabel?: string | null;
  employmentStatusLabel?: string | null;
  location?: { city?: string | null; state?: string | null };
  atsLocation?: { country?: string | null; state?: string | null; province?: string | null; city?: string | null };
  isRemote?: boolean | null;
  locationType?: string | number | null; // 0 in office, 1 remote, 2 hybrid
}
interface BbDetail {
  result?: { jobOpening?: { jobOpeningShareUrl?: string; description?: string; datePosted?: string | null; jobOpeningStatus?: string } };
}

const COUNTRY_CODE: Record<string, string> = { 'united kingdom': 'GB', uk: 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB' };
const MODE: Record<string, RawWorkMode> = { '0': 'onsite', '1': 'remote', '2': 'hybrid' };

export function mapBambooHr(j: BbJob, slug: string): RawJob {
  const a = j.atsLocation ?? {};
  const l = j.location ?? {};
  const loc = [a.city ?? l.city, a.state ?? a.province ?? l.state, a.country].filter((x): x is string => !!x);
  const country = (a.country ?? '').trim().toLowerCase();
  const code = COUNTRY_CODE[country] ?? (/^[a-z]{2}$/.test(country) ? country.toUpperCase() : null);
  const id = String(j.id);
  return {
    externalId: id,
    title: j.jobOpeningName.trim(),
    locations: loc.length ? [loc.join(', ')] : [],
    countryCodes: code ? [code] : [],
    applyUrl: `https://${slug}.bamboohr.com/careers/${encodeURIComponent(id)}`,
    postedAt: null, // filled from the detail call
    department: j.departmentLabel ?? null,
    employmentTypeRaw: j.employmentStatusLabel ?? null,
    workMode: j.isRemote ? 'remote' : (MODE[String(j.locationType ?? '')] ?? null),
    descriptionText: null,
    salary: null
  };
}

export const bamboohr: Adapter = {
  source: 'bamboohr',
  async fetchBoard(slug) {
    if (!/^[a-z0-9-]+$/i.test(slug)) return { ok: false, status: 404, jobs: [] };
    const r = await fetchJson<{ result?: BbJob[] }>(`https://${slug}.bamboohr.com/careers/list`);
    if (!r.ok || !Array.isArray(r.data?.result)) return { ok: false, status: r.status, jobs: [] };
    return { ok: true, status: 200, jobs: r.data.result.filter((j) => j?.jobOpeningName).map((j) => mapBambooHr(j, slug)) };
  },
  async enrich(slug, job) {
    const r = await fetchJson<BbDetail>(`https://${slug}.bamboohr.com/careers/${encodeURIComponent(job.externalId)}/detail`);
    const o = r.data?.result?.jobOpening;
    if (!r.ok || !o?.description) return null;
    const posted = o.datePosted ? new Date(o.datePosted) : null;
    return { descriptionText: htmlToText(o.description), postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : job.postedAt };
  }
};
