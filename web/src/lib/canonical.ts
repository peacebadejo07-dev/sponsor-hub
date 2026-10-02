/** `www.example.uk` is the same site: send it to the bare domain so there is one address (and one set of cookies). */
export const canonicalRedirect = (url: URL, method: string): Response | null => {
  if (!url.hostname.startsWith('www.')) return null;
  const to = new URL(url);
  to.hostname = url.hostname.slice(4);
  // 308 keeps the method for the rare non-GET; 301 is fine (and cacheable) for page views.
  return new Response(null, { status: method === 'GET' || method === 'HEAD' ? 301 : 308, headers: { location: to.toString() } });
};
