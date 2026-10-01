import type { Actions, PageServerLoad } from './$types';
import { setDigest, verifyUnsubscribeToken } from '@sponsored/accounts';
import { sql } from '$lib/server/db';
import { authSecret } from '$lib/server/auth';

// Like the sign-in link, the email link only SHOWS a button; email scanners fetch links automatically and must not
// switch anyone's emails off on a pre-fetch.
export const load: PageServerLoad = async ({ url, setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
  const token = url.searchParams.get('token') ?? '';
  return { token, valid: verifyUnsubscribeToken(token, authSecret()) !== null };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const token = String((await request.formData()).get('token') ?? '');
    const id = verifyUnsubscribeToken(token, authSecret());
    if (!id) return { done: false };
    await setDigest(sql, id, false);
    return { done: true };
  }
};
