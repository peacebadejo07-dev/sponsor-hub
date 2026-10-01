import * as cheerio from 'cheerio';

const LEGAL = new Set([
  'limited', 'ltd', 'plc', 'llp', 'llc', 'lp', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company',
  'cic', 'cio', 'uk', 'gb', 'europe', 'emea', 'holdings', 'group', 'international', 'intl', 'the', 'and'
]);

/**
 * Foreign legal forms and branch-location words. They are only dropped from the END of a name, and only when at least
 * two other words remain, because elsewhere they can be the name itself ("Software AG", "Kingdom Technologies",
 * "Pacific Green Technologies").
 */
const TRAILING = new Set([
  'gmbh', 'ag', 'bv', 'nv', 'sa', 'sas', 'sarl', 'srl', 'spa', 'pty', 'pvt', 'private', 'oy', 'ab', 'kk', 'ltda', 'kg', 'ug', 'sl', 'sro',
  'united', 'kingdom', 'britain', 'canada', 'usa', 'america', 'americas', 'ireland', 'scotland', 'wales', 'england', 'apac', 'asia', 'pacific'
]);

/** Words too common to identify a company on their own. */
const GENERIC = new Set([
  'global', 'digital', 'smart', 'first', 'alpha', 'delta', 'prime', 'apex', 'blue', 'green', 'red', 'london', 'british',
  'national', 'united', 'premier', 'advanced', 'applied', 'general', 'direct', 'express', 'future', 'modern', 'new',
  'north', 'south', 'east', 'west', 'central', 'royal', 'star', 'sun', 'pro', 'one', 'net', 'web', 'tech', 'data',
  'systems', 'solutions', 'services', 'consulting', 'software', 'cyber', 'cloud', 'ai', 'labs', 'studio', 'media',
  'technology', 'technologies', 'expert', 'experts', 'innovation', 'innovations', 'enterprise', 'enterprises', 'network',
  'networks', 'computing', 'computers', 'information', 'business', 'communications', 'engineering', 'management',
  'research', 'security', 'secure', 'online', 'mobile', 'internet', 'creative', 'industrial', 'electronics', 'electronic',
  'automation', 'robotics', 'analytics', 'insights', 'insight', 'partners', 'resources', 'logic', 'dynamics', 'concepts'
]);

export function normaliseText(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Trading name if present ("X t/a Y" -> Y), else the name. */
export function tradingName(name: string): string {
  const m = name.match(/\b(?:t\/a|trading as)\b\s*(.+)$/i);
  return m ? m[1] : name;
}

export interface CoreName {
  tokens: string[]; // distinctive words, legal/geographic suffixes removed
  phrase: string; // tokens joined by space
  brand: string; // first token
}

export function coreName(name: string): CoreName {
  const words = normaliseText(tradingName(name).replace(/\(.*?\)/g, ' ')).split(' ').filter(Boolean);
  let tokens = words.filter((w) => !LEGAL.has(w));
  if (tokens.length === 0) tokens = words;
  while (tokens.length >= 3 && TRAILING.has(tokens[tokens.length - 1])) tokens = tokens.slice(0, -1);
  return { tokens, phrase: tokens.join(' '), brand: tokens[0] ?? '' };
}

/** Words that appear in countless company names and say nothing about what the company does. */
/** Everyday English words that appear on any page, so they prove nothing about who owns it. */
const STOP = new Set(['it', 'of', 'at', 'in', 'on', 'by', 'to', 'as', 'be', 'is', 'or', 'an', 'if', 'my', 'we', 'us', 'no', 'so', 'do', 'go', 'up', 'me', 'he', 'am', 'the', 'and', 'for']);

const FILLER = new Set(['solutions', 'services', 'systems', 'consulting', 'consultancy', 'consultants', 'limited', 'company', 'trading', 'enterprises', 'associates', 'partners']);

export const isGeneric = (w: string) => GENERIC.has(w) || w.length < 4;

const TLDS = ['co.uk', 'com', 'uk', 'io', 'ai', 'tech', 'net', 'org', 'org.uk'];

/** Likely domains for an organisation, most specific first. */
export function domainCandidates(name: string, limit = 16): string[] {
  const { tokens } = coreName(name);
  if (tokens.length === 0) return [];
  const variants: string[] = [];
  const add = (v: string) => v && v.length >= 3 && v.length <= 40 && !variants.includes(v) && variants.push(v);
  if (tokens.length <= 3) add(tokens.join(''));
  if (tokens.length >= 2) add(tokens.slice(0, 2).join(''));
  if (tokens[0].length >= 4 || tokens.length === 1) add(tokens[0]);
  if (tokens.length >= 2 && tokens.length <= 3) add(tokens.join('-'));
  // TLD-major so the most common patterns (name.co.uk, name.com) are tried before rarer TLDs.
  const out: string[] = [];
  for (const t of TLDS) for (const v of variants) out.push(`${v}.${t}`);
  return out.slice(0, limit);
}

export interface Verdict {
  confidence: number; // 0..1
  reasons: string[];
  title: string;
  description: string;
  hasUkSignal: boolean;
}

/** Bot-protection interstitials: we do not try to get past these. */
export const BOT_CHALLENGE = /just a moment|attention required|checking your browser|cf-chl|captcha|access denied|enable javascript and cookies/i;

export function labelOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '').split('.')[0].replace(/-/g, '');
}

const PARKED = /domain (is )?for sale|buy this domain|this domain (may be|is) for sale|parked (free|domain)|sedo\.com|hugedomains|godaddy\.com\/forsale|domain has expired|account suspended/i;
const UK_SIGNAL = /united kingdom|\bengland\b|\bscotland\b|\bwales\b|registered in (england|scotland|wales)|\bcompany (number|no)\b|\b[a-z]{1,2}\d[a-z\d]? ?\d[a-z]{2}\b|\+44|\b0[12378]\d{2,3} ?\d{3} ?\d{3,4}\b|£/i;

/** Decide whether a fetched homepage plausibly belongs to the organisation. */
export function verifyHomepage(html: string, finalUrl: string, org: { name: string; town?: string; county?: string }): Verdict {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim();
  const description = ($('meta[name="description"]').attr('content') ?? $('meta[property="og:description"]').attr('content') ?? '').trim();
  const siteName = $('meta[property="og:site_name"]').attr('content') ?? '';
  const h1 = $('h1').slice(0, 3).map((_, e) => $(e).text()).get().join(' ');
  let ld = '';
  $('script[type="application/ld+json"]').each((_, e) => {
    const t = $(e).text();
    for (const m of t.matchAll(/"(?:legalName|name)"\s*:\s*"([^"]{2,120})"/g)) ld += ' ' + m[1];
  });
  $('script,style,noscript').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ');
  const footer = bodyText.slice(-1500);
  const head = normaliseText([title, siteName, h1, ld].join(' '));
  const foot = normaliseText(footer);
  const all = normaliseText(bodyText.slice(0, 20000));

  const core = coreName(org.name);
  const host = new URL(finalUrl).hostname.replace(/^www\./, '');
  const label = host.split('.')[0].replace(/-/g, '');
  const reasons: string[] = [];
  let c = 0;

  if (PARKED.test(html.slice(0, 50_000)) || bodyText.length < 80) {
    return { confidence: 0, reasons: ['parked or empty page'], title, description, hasUkSignal: false };
  }

  const phraseInHead = core.phrase.length >= 3 && ` ${head} `.includes(` ${core.phrase} `);
  const phraseInFoot = core.phrase.length >= 3 && ` ${foot} `.includes(` ${core.phrase} `);
  const brandInHead = core.brand.length >= 3 && ` ${head} `.includes(` ${core.brand} `);
  const brandInFoot = core.brand.length >= 3 && ` ${foot} `.includes(` ${core.brand} `);
  const labelMatches = label === core.tokens.join('') || label === core.brand || label === core.tokens.slice(0, 2).join('');

  const allTokensInHead = core.tokens.length > 1 && core.tokens.every((t) => ` ${head} `.includes(` ${t} `));
  const joinedLabel = label === core.tokens.join('');
  const brandOnPage = brandInHead || brandInFoot;
  // A brand-only match is trusted only when the brand is a long, uncommon word (worldline, pinewood),
  // not a short or common one (epic, smart, technology) that many unrelated companies share.
  const distinctiveBrand = core.brand.length >= 7 && !GENERIC.has(core.brand);

  if (phraseInHead) { c = 0.85; reasons.push('full name in title/heading'); }
  else if (phraseInFoot) { c = 0.8; reasons.push('full name in footer'); }
  else if (labelMatches && allTokensInHead) { c = 0.75; reasons.push('all name words in title/heading'); }
  else if (labelMatches && joinedLabel && brandOnPage) { c = 0.7; reasons.push('domain is the full name; brand on page'); }
  else if (labelMatches && distinctiveBrand && brandOnPage) { c = 0.65; reasons.push('distinctive brand matches domain and page'); }
  else if (labelMatches && brandOnPage) { c = 0.5; reasons.push('brand matches domain but is a common word'); }
  else if (labelMatches && ` ${all} `.includes(` ${core.brand} `)) { c = 0.45; reasons.push('domain matches brand; brand in body only'); }

  // Brand-only matches must be corroborated: another word from the name has to appear on the page,
  // otherwise "Bluecube Cyber Security" would match an unrelated "Bluecube" AI company.
  // Short tokens count too: "AI" is what tells Clarity AI apart from an air-quality company called Clarity.
  const others = core.tokens.slice(1).filter((t) => t.length >= 2 && !FILLER.has(t) && !STOP.has(t));
  // The rest of the name must show up on the page. Generic words do not count as evidence when the name has a
  // distinctive one: "Elastic Path Software" is not confirmed by a page that merely says "software".
  const distinctive = others.filter((t) => !isGeneric(t));
  const pool = distinctive.length ? distinctive : others;
  const brandOnly = c > 0 && c < 0.75 && !phraseInHead && !phraseInFoot && !allTokensInHead && !joinedLabel;
  if (brandOnly && pool.length > 0 && !pool.some((t) => ` ${all} `.includes(` ${t} `))) {
    c = Math.min(c, 0.5);
    reasons.push('no distinctive word from the name appears on the page');
  }

  if (c > 0 && core.tokens.length === 1 && isGeneric(core.brand)) { c = Math.min(c, 0.55); reasons.push('generic single-word name'); }

  const townNorm = normaliseText(org.town ?? '');
  const countyNorm = normaliseText(org.county ?? '');
  const hasUkSignal =
    /\.(uk|co\.uk|org\.uk|scot|wales|london)$/.test(host) ||
    UK_SIGNAL.test(bodyText.slice(0, 30000)) ||
    (townNorm.length >= 4 && ` ${all} `.includes(` ${townNorm} `)) ||
    (countyNorm.length >= 4 && ` ${all} `.includes(` ${countyNorm} `));
  if (c > 0) {
    if (hasUkSignal) { c = Math.min(1, c + 0.05); reasons.push('UK signal'); }
    else { c = Math.min(c, core.tokens.length > 1 ? 0.7 : 0.5); reasons.push('no UK signal'); }
  }
  return { confidence: Math.round(c * 100) / 100, reasons, title, description, hasUkSignal };
}
