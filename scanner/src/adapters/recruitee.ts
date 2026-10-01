import { fetchJson } from '@sponsored/http';
import { htmlToText, type Salary } from '@sponsored/core';
import type { Adapter, RawJob, RawWorkMode } from '../types.ts';

/** Recruitee's public API: https://{slug}.recruitee.com/api/offers/ returns every published offer with its text. */

interface RcOffer {
  id: number | string;
  guid?: string;
  title: string;
  status?: string;
  department?: string | null;
  employment_type_code?: string | null;
  country_code?: string | null;
  location?: string | null;
  locations?: { city?: string; country?: string; country_code?: string }[];
  remote?: boolean | null;
  hybrid?: boolean | null;
  on_site?: boolean | null;
  careers_url?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  description?: string | null;
  requirements?: string | null;
  salary?: { min?: number | string | null; max?: number | string | null; currency?: string | null; period?: string | null } | null;
}

const PERIOD: Record<string, Salary['period']> = { year: 'year', yearly: 'year', annual: 'year', month: 'month', monthly: 'month', day: 'day', daily: 'day', hour: 'hour', hourly: 'hour' };

export function recruiteeSalary(s: RcOffer['salary']): Salary | null {
  if (!s) return null;
  const min = Number(s.min);
  const max = Number(s.max);
  const cur = (s.currency ?? '').toUpperCase();
  const period = PERIOD[(s.period ?? '').toLowerCase()];
  if (!(min > 0) || !(max >= min) || !period || !['GBP', 'USD', 'EUR'].includes(cur)) return null;
  return { min, max, currency: cur as Salary['currency'], period };
}

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(' UTC', 'Z').replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapRecruitee(o: RcOffer): RawJob {
  const locs = o.locations?.length
    ? o.locations.map((l) => [l.city, l.country].filter(Boolean).join(', '))
    : o.location ? [o.location] : [];
  const codes = [...(o.locations ?? []).map((l) => l.country_code), o.country_code].filter((c): c is string => !!c && /^[A-Za-z]{2}$/.test(c)).map((c) => c.toUpperCase());
  const mode: RawWorkMode | null = o.remote ? 'remote' : o.hybrid ? 'hybrid' : o.on_site ? 'onsite' : null;
  const text = [o.description, o.requirements].filter(Boolean).map((h) => htmlToText(h as string)).join('\n');
  return {
    externalId: String(o.guid ?? o.id),
    title: o.title.trim(),
    locations: locs.filter(Boolean),
    countryCodes: [...new Set(codes)],
    applyUrl: o.careers_url ?? null,
    postedAt: parseDate(o.published_at ?? o.created_at),
    department: o.department ?? null,
    employmentTypeRaw: o.employment_type_code ?? null,
    workMode: mode,
    descriptionText: text || null,
    salary: recruiteeSalary(o.salary)
  };
}

export const recruitee: Adapter = {
  source: 'recruitee',
  async fetchBoard(slug) {
    if (!/^[a-z0-9-]+$/i.test(slug)) return { ok: false, status: 404, jobs: [] };
    const r = await fetchJson<{ offers?: RcOffer[] }>(`https://${slug}.recruitee.com/api/offers/`);
    if (!r.ok || !Array.isArray(r.data?.offers)) return { ok: false, status: r.status, jobs: [] };
    return { ok: true, status: 200, jobs: r.data.offers.filter((o) => o?.title && (!o.status || o.status === 'published')).map(mapRecruitee) };
  }
};
