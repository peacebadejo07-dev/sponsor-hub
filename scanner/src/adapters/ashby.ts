import { fetchJson } from '@sponsored/http';
import type { Salary } from '@sponsored/core';
import type { Adapter, RawJob, RawWorkMode } from '../types.ts';

interface AbComponent { compensationType?: string; interval?: string; currencyCode?: string | null; minValue?: number | null; maxValue?: number | null }
interface AbJob {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: { location?: string; address?: { postalAddress?: { addressCountry?: string } } }[];
  address?: { postalAddress?: { addressCountry?: string } };
  publishedAt?: string;
  isListed?: boolean;
  workplaceType?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  compensation?: { compensationTiers?: { components?: AbComponent[] }[] };
}

const WORK: Record<string, RawWorkMode> = { remote: 'remote', hybrid: 'hybrid', onsite: 'onsite' };

export function ashbySalary(c: AbJob['compensation']): Salary | null {
  const comps = (c?.compensationTiers ?? []).flatMap((t) => t.components ?? []).filter(
    (x) => x.compensationType === 'Salary' && x.minValue && x.maxValue && x.currencyCode
  );
  const pick = comps.find((x) => x.currencyCode === 'GBP') ?? comps[0];
  if (!pick || !['GBP', 'USD', 'EUR'].includes(pick.currencyCode!)) return null;
  const iv = (pick.interval ?? '').toLowerCase();
  const period = iv.includes('hour') ? 'hour' : iv.includes('month') ? 'month' : iv.includes('day') ? 'day' : 'year';
  return { min: pick.minValue!, max: pick.maxValue!, currency: pick.currencyCode as Salary['currency'], period };
}

export function mapAshby(j: AbJob): RawJob {
  const locs = [
    j.location,
    j.address?.postalAddress?.addressCountry,
    ...(j.secondaryLocations ?? []).flatMap((s) => [s.location, s.address?.postalAddress?.addressCountry])
  ].filter((x): x is string => !!x);
  return {
    externalId: j.id,
    title: j.title.trim(),
    locations: [...new Set(locs)],
    countryCodes: [],
    applyUrl: j.applyUrl ?? j.jobUrl ?? null,
    postedAt: j.publishedAt ? new Date(j.publishedAt) : null,
    department: j.department ?? j.team ?? null,
    employmentTypeRaw: j.employmentType ?? null,
    workMode: j.workplaceType ? (WORK[j.workplaceType.toLowerCase()] ?? null) : null,
    descriptionText: j.descriptionPlain ?? null,
    salary: ashbySalary(j.compensation)
  };
}

export const ashby: Adapter = {
  source: 'ashby',
  async fetchBoard(slug) {
    const r = await fetchJson<{ jobs?: AbJob[] }>(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`);
    if (!r.ok || !r.data) return { ok: false, status: r.status, jobs: [] };
    return { ok: true, status: 200, jobs: (r.data.jobs ?? []).filter((j) => j.isListed !== false).map(mapAshby) };
  }
};
