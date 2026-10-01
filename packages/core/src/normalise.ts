const SMALL_WORDS = new Set(['upon', 'on', 'in', 'under', 'the', 'of', 'le', 'de', 'cum', 'with', 'by']);

export function clean(s: string | undefined | null): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

/** Conservative dedupe key: case/whitespace/quote-insensitive, nothing more aggressive. */
export function key(s: string | undefined | null): string {
  return clean(s).toLowerCase().replace(/[“”"]/g, '').replace(/[‘’]/g, "'");
}

export function titleCase(s: string): string {
  const out = clean(s)
    .toLowerCase()
    .split(' ')
    .map((w, i) =>
      i > 0 && SMALL_WORDS.has(w)
        ? w
        : w.replace(/(^|[-'(])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())
    )
    .join(' ');
  return out.replace(/\bSt\b(?!\.)/g, 'St');
}

export type Rating = 'A_PREMIUM' | 'A_SME_PLUS' | 'A' | 'B' | 'PROVISIONAL' | 'UNKNOWN';
export type WorkerType = 'worker' | 'temporary_worker';

const RATING_RANK: Record<Rating, number> = {
  A_PREMIUM: 5,
  A_SME_PLUS: 4,
  A: 3,
  B: 2,
  PROVISIONAL: 1,
  UNKNOWN: 0
};

export function betterRating(a: Rating, b: Rating): Rating {
  return RATING_RANK[a] >= RATING_RANK[b] ? a : b;
}

/** "Worker (A rating)", "Temporary Worker (A (Premium))", "Worker (UK Expansion Worker: Provisional )" ... */
export function parseTypeAndRating(raw: string): { workerType: WorkerType; rating: Rating } {
  const s = clean(raw);
  const workerType: WorkerType = /^temporary worker/i.test(s) ? 'temporary_worker' : 'worker';
  let rating: Rating = 'UNKNOWN';
  if (/provisional/i.test(s)) rating = 'PROVISIONAL';
  else if (/premium/i.test(s)) rating = 'A_PREMIUM';
  else if (/sme\+/i.test(s)) rating = 'A_SME_PLUS';
  else if (/\(a rating\)/i.test(s)) rating = 'A';
  else if (/\(b rating\)/i.test(s)) rating = 'B';
  return { workerType, rating };
}
