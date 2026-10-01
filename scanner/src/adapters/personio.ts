import * as cheerio from 'cheerio';
import { fetchPage } from '@sponsored/http';
import { htmlToText } from '@sponsored/core';
import type { Adapter, RawJob } from '../types.ts';

/** Personio publishes an XML feed of open positions: https://{slug}.jobs.personio.com/xml (some tenants only on .de). */

const COUNTRY: Record<string, string> = { uk: 'GB', gb: 'GB' };

export function parsePersonioFeed(xml: string, slug: string): RawJob[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const jobs: RawJob[] = [];
  $('position').each((_, el) => {
    const p = $(el);
    const id = p.children('id').text().trim();
    const title = p.children('name').text().trim();
    if (!id || !title) return;
    const office = p.children('office').text().trim();
    const code = office.match(/\(([A-Za-z]{2})\)\s*$/)?.[1]?.toLowerCase();
    const description = p
      .find('jobDescription')
      .map((_, d) => `${$(d).children('name').text().trim()}\n${htmlToText($(d).children('value').text())}`)
      .get()
      .join('\n');
    const created = new Date(p.children('createdAt').text().trim());
    const schedule = p.children('schedule').text().trim();
    const kind = p.children('employmentType').text().trim();
    jobs.push({
      externalId: id,
      title,
      locations: office ? [office.replace(/\s*\([A-Za-z]{2}\)\s*$/, '')] : [],
      countryCodes: code ? [COUNTRY[code] ?? code.toUpperCase()] : [],
      applyUrl: `https://${slug}.jobs.personio.com/job/${encodeURIComponent(id)}`,
      postedAt: Number.isNaN(created.getTime()) ? null : created,
      department: p.children('department').text().trim() || null,
      employmentTypeRaw: [schedule, kind].filter(Boolean).join(' ') || null,
      workMode: null, // the feed does not state it
      descriptionText: description || null,
      salary: null
    });
  });
  return jobs;
}

export const personio: Adapter = {
  source: 'personio',
  async fetchBoard(slug) {
    if (!/^[a-z0-9-]+$/i.test(slug)) return { ok: false, status: 404, jobs: [] };
    let status = 0;
    for (const tld of ['com', 'de']) {
      const page = await fetchPage(`https://${slug}.jobs.personio.${tld}/xml`, { skipRobots: true }, { Accept: 'application/xml, text/xml' });
      if (!page) continue;
      status = page.status;
      if (page.status === 200 && /<workzag-jobs[\s>]/i.test(page.text)) {
        const jobs = parsePersonioFeed(page.text, slug);
        // An empty feed on .com may just mean the tenant lives on .de; try that before concluding there are no jobs.
        if (jobs.length || tld === 'de') return { ok: true, status: 200, jobs };
      }
    }
    return { ok: false, status: status === 200 ? 404 : status, jobs: [] };
  }
};
