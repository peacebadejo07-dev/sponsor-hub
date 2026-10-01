import { fetchJson } from '@sponsored/http';
import { htmlToText, type Salary } from '@sponsored/core';
import type { Adapter, RawJob, RawWorkMode } from '../types.ts';

interface LvJob {
  id: string;
  text: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  country?: string;
  workplaceType?: string;
  categories?: { commitment?: string; location?: string; team?: string; department?: string; allLocations?: string[] };
  descriptionPlain?: string;
  additionalPlain?: string;
  lists?: { text?: string; content?: string }[];
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

const WORK: Record<string, RawWorkMode> = { remote: 'remote', hybrid: 'hybrid', onsite: 'onsite', 'on-site': 'onsite' };

function leverSalary(s: LvJob['salaryRange']): Salary | null {
  if (!s || !s.min || !s.max || !s.currency) return null;
  const cur = s.currency.toUpperCase();
  if (cur !== 'GBP' && cur !== 'USD' && cur !== 'EUR') return null;
  const iv = (s.interval ?? '').toLowerCase();
  const period = iv.includes('hour') ? 'hour' : iv.includes('month') ? 'month' : iv.includes('day') ? 'day' : 'year';
  return { min: s.min, max: s.max, currency: cur, period };
}

export function mapLever(j: LvJob): RawJob {
  const locs = j.categories?.allLocations?.length ? j.categories.allLocations : [j.categories?.location].filter((x): x is string => !!x);
  const text = [j.descriptionPlain, ...(j.lists ?? []).map((l) => `${l.text ?? ''}\n${htmlToText(l.content ?? '')}`), j.additionalPlain].filter(Boolean).join('\n');
  return {
    externalId: j.id,
    title: j.text.trim(),
    locations: locs,
    countryCodes: j.country ? [j.country] : [],
    applyUrl: j.applyUrl ?? j.hostedUrl ?? null,
    postedAt: j.createdAt ? new Date(j.createdAt) : null,
    department: j.categories?.department ?? j.categories?.team ?? null,
    employmentTypeRaw: j.categories?.commitment ?? null,
    workMode: j.workplaceType ? (WORK[j.workplaceType.toLowerCase()] ?? null) : null,
    descriptionText: text || null,
    salary: leverSalary(j.salaryRange)
  };
}

export const lever: Adapter = {
  source: 'lever',
  async fetchBoard(slug) {
    const s = encodeURIComponent(slug);
    let r = await fetchJson<LvJob[]>(`https://api.lever.co/v0/postings/${s}?mode=json`);
    if (r.status === 404) r = await fetchJson<LvJob[]>(`https://api.eu.lever.co/v0/postings/${s}?mode=json`);
    if (!r.ok || !Array.isArray(r.data)) return { ok: false, status: r.status, jobs: [] };
    return { ok: true, status: 200, jobs: r.data.map(mapLever) };
  }
};
