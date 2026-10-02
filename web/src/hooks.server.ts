import type { Handle } from '@sveltejs/kit';
import { getSession } from '@sponsored/accounts';
import { sql, withRequestDb } from '$lib/server/db';
import { SESSION_COOKIE } from '$lib/server/auth';
import { canonicalRedirect } from '$lib/canonical';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const handle: Handle = ({ event, resolve }) => canonicalRedirect(event.url, event.request.method) ?? withRequestDb(() => handleRequest(event, resolve), event.platform?.context?.waitUntil?.bind(event.platform.context), event.platform?.env?.HYPERDRIVE?.connectionString);

const handleRequest = async (event: Parameters<Handle>[0]['event'], resolve: Parameters<Handle>[0]['resolve']) => {
  // CSRF: every state-changing request must come from this site. Browsers always send an Origin header on such requests.
  // SvelteKit does this too, but only in production builds; checking here makes it identical (and testable) everywhere.
  // The one exception: the mail-provider one-click unsubscribe (RFC 8058), which has no browser and so no Origin, and is
  // authenticated by its token.
  const oneClick = event.url.pathname === '/unsubscribe/one-click' && event.request.method === 'POST';
  if (!SAFE_METHODS.has(event.request.method) && !oneClick && event.request.headers.get('origin') !== event.url.origin) {
    return new Response('Cross-site requests are forbidden', { status: 403 });
  }

  const token = event.cookies.get(SESSION_COOKIE);
  event.locals.user = null;
  if (token) {
    try {
      event.locals.user = await getSession(sql, {}, token);
    } catch {
      // The database is unreachable: we do not know whether this session is valid. Never treat that as "signed out"
      // (which would delete everyone's cookie during a brief outage); ask the browser to retry.
      return new Response('Temporarily unavailable. Please try again in a moment.', { status: 503, headers: { 'retry-after': '30', 'cache-control': 'no-store' } });
    }
    if (!event.locals.user) event.cookies.delete(SESSION_COOKIE, { path: '/' }); // looked up fine; there is no such session
  }

  const resolved = await resolve(event);
  // On Cloudflare Workers the framework's response headers can be immutable, and a plain set() then silently does
  // nothing. Rebuilding the response gives mutable headers, so what we set below always takes effect.
  const res = new Response(resolved.body, resolved);

  // A signed-in response may contain that person's saves and profile, so it must never be stored by a shared cache.
  if (token) res.headers.set('cache-control', 'private, no-store');
  res.headers.append('vary', 'Cookie');
  res.headers.set('x-content-type-options', 'nosniff');
  res.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  res.headers.set('x-frame-options', 'DENY');
  res.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  return res;
};
