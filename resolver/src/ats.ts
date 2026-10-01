import * as cheerio from 'cheerio';

export type AtsType =
  | 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters' | 'teamtailor'
  | 'recruitee' | 'personio' | 'bamboohr' | 'workday' | 'unknown';

export interface AtsHit {
  ats: AtsType;
  slug: string;
  boardUrl: string;
}

const RESERVED = new Set(['embed', 'jobs', 'careers', 'api', 'v1', 'j', 'widget', 'www', 'static', 'assets', 'job', 'apply', 'en', 'en-us', 'app', 'career', 'support', 'help', 'company', 'cdn', 'login']);

const PATTERNS: { ats: AtsType; re: RegExp; board: (m: RegExpMatchArray) => string; slug: (m: RegExpMatchArray) => string }[] = [
  {
    ats: 'greenhouse',
    re: /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)|boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9_-]+)/i,
    slug: (m) => m[1] ?? m[2],
    board: (m) => `https://boards.greenhouse.io/${m[1] ?? m[2]}`
  },
  { ats: 'lever', re: /jobs(?:\.eu)?\.lever\.co\/([a-z0-9_-]+)/i, slug: (m) => m[1], board: (m) => `https://jobs.lever.co/${m[1]}` },
  { ats: 'ashby', re: /jobs\.ashbyhq\.com\/([a-z0-9._%-]+)/i, slug: (m) => m[1], board: (m) => `https://jobs.ashbyhq.com/${m[1]}` },
  { ats: 'workable', re: /apply\.workable\.com\/([a-z0-9_-]+)/i, slug: (m) => m[1], board: (m) => `https://apply.workable.com/${m[1]}` },
  {
    ats: 'smartrecruiters',
    re: /(?:careers|jobs)\.smartrecruiters\.com\/([A-Za-z0-9_-]+)/i,
    slug: (m) => m[1],
    board: (m) => `https://careers.smartrecruiters.com/${m[1]}`
  },
  { ats: 'teamtailor', re: /([a-z0-9-]+)\.teamtailor\.com/i, slug: (m) => m[1], board: (m) => `https://${m[1]}.teamtailor.com` },
  { ats: 'recruitee', re: /([a-z0-9-]+)\.recruitee\.com/i, slug: (m) => m[1], board: (m) => `https://${m[1]}.recruitee.com` },
  { ats: 'personio', re: /([a-z0-9-]+)\.jobs\.personio\.(?:de|com)/i, slug: (m) => m[1], board: (m) => `https://${m[1]}.jobs.personio.com` },
  { ats: 'bamboohr', re: /([a-z0-9-]+)\.bamboohr\.com\/(?:careers|jobs)/i, slug: (m) => m[1], board: (m) => `https://${m[1]}.bamboohr.com/careers` },
  {
    ats: 'workday',
    re: /([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/i,
    // The host number (wd1, wd5 ...) is needed to call the API, so it is part of the slug: tenant.wdN/site
    slug: (m) => `${m[1]}.${m[2].toLowerCase()}/${m[3]}`,
    board: (m) => m[0].startsWith('http') ? m[0] : `https://${m[0]}`
  }
];

/** Find a known ATS in a blob of HTML or a URL list. Returns the first credible hit. */
export function detectAts(haystack: string): AtsHit | null {
  for (const p of PATTERNS) {
    for (const m of haystack.matchAll(new RegExp(p.re.source, 'gi'))) {
      const slug = p.slug(m);
      if (!slug || RESERVED.has(slug.toLowerCase())) continue;
      return { ats: p.ats, slug, boardUrl: p.board(m) };
    }
  }
  return null;
}

const CAREER_TEXT = /career|\bjobs?\b|vacanc|join (us|the team|our team)|work (with|for) us|opportunit|we.?re hiring|recruit/i;
const CAREER_HREF = /career|\/jobs?\b|vacanc|join-us|work-(with|for)-us|recruit|opportunit/i;
const NOISE = /blog|news|press|investor|privacy|terms|cookie|login|signin|\.pdf$|mailto:|tel:/i;

/** Candidate careers links on a page, best first. Same-site links and known ATS links only. */
export function extractCareersLinks(html: string, baseUrl: string, limit = 5): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const siteRoot = base.hostname.replace(/^www\./, '').split('.').slice(-3).join('.');
  const scored = new Map<string, number>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!href || href.startsWith('#') || NOISE.test(href)) return;
    let abs: URL;
    try {
      abs = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (!/^https?:$/.test(abs.protocol)) return;
    const isAts = detectAts(abs.toString()) !== null;
    const sameSite = abs.hostname.replace(/^www\./, '').endsWith(siteRoot) || siteRoot.endsWith(abs.hostname.replace(/^www\./, ''));
    if (!isAts && !sameSite) return;
    let score = 0;
    if (isAts) score += 6;
    if (CAREER_HREF.test(abs.pathname + abs.hostname)) score += 3;
    if (CAREER_TEXT.test(text) && text.length < 60) score += 2;
    if (score < 2 || (!isAts && score < 3 && !CAREER_HREF.test(abs.pathname))) return;
    abs.hash = '';
    const url = abs.toString();
    scored.set(url, Math.max(scored.get(url) ?? 0, score));
  });
  return [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([u]) => u);
}

export const COMMON_CAREER_PATHS = ['/careers', '/jobs', '/careers/', '/join-us', '/about/careers', '/company/careers'];
