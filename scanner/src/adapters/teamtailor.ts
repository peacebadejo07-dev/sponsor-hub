import * as cheerio from 'cheerio';
import { fetchPage } from '@sponsored/http';
import { htmlToText } from '@sponsored/core';
import type { Adapter, RawJob, RawWorkMode } from '../types.ts';

/** Teamtailor publishes every board as an RSS feed: https://{slug}.teamtailor.com/jobs.rss (descriptions included). */

const WORK: Record<string, RawWorkMode> = { remote: 'remote', hybrid: 'hybrid', onsite: 'onsite', 'on-site': 'onsite' };
const COUNTRY_CODE: Record<string, string> = { 'united kingdom': 'GB', uk: 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB' };

export function parseTeamtailorFeed(xml: string): RawJob[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const jobs: RawJob[] = [];
  $('item').each((_, el) => {
    const item = $(el);
    const title = item.children('title').text().trim();
    const id = item.children('guid').text().trim() || item.children('link').text().trim();
    if (!title || !id) return;
    const locations: string[] = [];
    const countryCodes: string[] = [];
    item.find('tt\\:location').each((_, l) => {
      const loc = $(l);
      const city = loc.children('tt\\:city').text().trim() || loc.children('tt\\:name').text().trim();
      const country = loc.children('tt\\:country').text().trim();
      const text = [city, country].filter(Boolean).join(', ');
      if (text) locations.push(text);
      const code = COUNTRY_CODE[country.toLowerCase()] ?? (/^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null);
      if (code) countryCodes.push(code);
    });
    const posted = new Date(item.children('pubDate').text().trim());
    const desc = item.children('description').text();
    const mode = item.children('remoteStatus').text().trim().toLowerCase();
    jobs.push({
      externalId: id,
      title,
      locations,
      countryCodes,
      applyUrl: item.children('link').text().trim() || null,
      postedAt: Number.isNaN(posted.getTime()) ? null : posted,
      department: item.children('tt\\:department').text().trim() || null,
      employmentTypeRaw: null, // the feed does not carry it; normalisation reads the description instead
      workMode: WORK[mode] ?? null, // "none" and "" mean unstated
      descriptionText: desc ? htmlToText(desc) : null,
      salary: null
    });
  });
  return jobs;
}

export const teamtailor: Adapter = {
  source: 'teamtailor',
  async fetchBoard(slug) {
    if (!/^[a-z0-9-]+$/i.test(slug)) return { ok: false, status: 404, jobs: [] };
    const page = await fetchPage(`https://${slug}.teamtailor.com/jobs.rss`, { skipRobots: true }, { Accept: 'application/rss+xml, application/xml, text/xml' });
    if (!page) return { ok: false, status: 0, jobs: [] };
    if (page.status !== 200 || !/<rss[\s>]/i.test(page.text)) return { ok: false, status: page.status === 200 ? 404 : page.status, jobs: [] };
    return { ok: true, status: 200, jobs: parseTeamtailorFeed(page.text) };
  }
};
