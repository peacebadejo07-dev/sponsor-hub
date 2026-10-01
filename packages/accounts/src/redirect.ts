/** Only ever redirect to a path on this site: blocks open redirects such as //evil.test or /\\evil.test. */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || /[\u0000-\u001f]/.test(next)) return fallback;
  try {
    const u = new URL(next, 'https://site.invalid');
    if (u.origin !== 'https://site.invalid') return fallback;
    // Return the parsed form: non-ASCII characters become %-escapes, which are safe in a Location header
    // (a raw "é" would make the redirect itself throw).
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
