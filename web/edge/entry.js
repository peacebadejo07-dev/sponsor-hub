// Entry point for the Cloudflare Worker (installed in front of the adapter's worker by scripts/wrap-worker.mjs).
//
// The SvelteKit Cloudflare adapter's worker keeps an edge cache keyed by URL alone. It looks a page up BEFORE any of our
// code runs, and Cloudflare ignores `Vary: Cookie`. Left alone, a signed-in visitor would be served the cached
// logged-out copy of public pages (no saved marks, no personal sections). Responses for signed-in visitors are marked
// `private, no-store` by hooks.server.ts so they are never stored; this entry makes sure they are never served from
// the cache either, by telling the adapter's cache layer to skip the lookup when a session cookie is present.
import adapterWorker from './_adapter-worker.js';

const SESSION = /(?:^|;\s*)sh_session=/;

export default {
  async fetch(request, env, ctx) {
    if (SESSION.test(request.headers.get('cookie') ?? '')) {
      const headers = new Headers(request.headers);
      headers.set('cache-control', 'no-cache');
      request = new Request(request, { headers });
    }
    return adapterWorker.fetch(request, env, ctx);
  }
};
