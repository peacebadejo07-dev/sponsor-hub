import { describe, it, expect } from 'vitest';
import { canonicalRedirect } from './canonical.ts';

describe('canonicalRedirect', () => {
  it('sends www to the bare domain, keeping path and query', () => {
    const r = canonicalRedirect(new URL('https://www.sponsorhub.uk/org/12?x=1'), 'GET')!;
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('https://sponsorhub.uk/org/12?x=1');
  });
  it('keeps the method for non-GET requests', () => {
    expect(canonicalRedirect(new URL('https://www.sponsorhub.uk/login'), 'POST')!.status).toBe(308);
  });
  it('leaves the bare domain, other hosts and localhost alone', () => {
    for (const u of ['https://sponsorhub.uk/', 'https://sponsor-hub.workers.dev/', 'http://localhost:5173/']) expect(canonicalRedirect(new URL(u), 'GET')).toBeNull();
  });
});
