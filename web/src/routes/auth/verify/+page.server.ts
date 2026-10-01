import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { peekLogin, safeNext, verifyLogin } from '@sponsored/accounts';
import { sql } from '$lib/server/db';
import { SESSION_COOKIE, sessionCookieOptions } from '$lib/server/auth';

// The link only SHOWS a button; the token is spent when the button is pressed. Email scanners and link
// previewers fetch links automatically, and would otherwise use up the single-use token before the person does.
export const load: PageServerLoad = async ({ url, setHeaders }) => {
  setHeaders({ 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' });
  const token = url.searchParams.get('token') ?? '';
  // Show WHICH account this link signs into. Without it, someone could send you a link for their own account and you
  // would unknowingly sign in as them, then type your own details into it.
  const who = await peekLogin(sql, token);
  return { token: who ? token : '', maskedEmail: who?.maskedEmail ?? null, next: safeNext(url.searchParams.get('next'), '') };
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const token = String(form.get('token') ?? '');
    const res = await verifyLogin(sql, {}, token, request.headers.get('user-agent') ?? '');
    if (!res.ok) return { failed: true };
    cookies.set(SESSION_COOKIE, res.sessionToken, sessionCookieOptions(res.expiresAt));
    redirect(303, res.isNew ? '/profile?welcome=1' : safeNext(String(form.get('next') ?? ''), '/for-you'));
  }
};
