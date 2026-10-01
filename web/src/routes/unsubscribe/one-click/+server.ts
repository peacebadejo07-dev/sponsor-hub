import type { RequestHandler } from './$types';
import { setDigest, verifyUnsubscribeToken } from '@sponsored/accounts';
import { sql } from '$lib/server/db';
import { authSecret } from '$lib/server/auth';

// RFC 8058 one-click unsubscribe: mail providers POST here directly, with no browser and so no Origin header (hooks.server.ts
// exempts exactly this path from the same-site check). The token is the authentication. Unsubscribing is harmless to forge.
export const POST: RequestHandler = async ({ url }) => {
  const id = verifyUnsubscribeToken(url.searchParams.get('token') ?? '', authSecret());
  if (!id) return new Response('Invalid link', { status: 400, headers: { 'cache-control': 'no-store' } });
  await setDigest(sql, id, false);
  return new Response('Unsubscribed', { status: 200, headers: { 'cache-control': 'no-store' } });
};
