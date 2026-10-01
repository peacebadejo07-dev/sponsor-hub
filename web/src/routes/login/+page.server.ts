import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requestLogin } from '@sponsored/accounts';
import { sql } from '$lib/server/db';
import { authConfig, safeNext } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.user) redirect(303, safeNext(url.searchParams.get('next'), '/for-you'));
  return { next: safeNext(url.searchParams.get('next'), '') };
};

export const actions: Actions = {
  default: async ({ request, url, getClientAddress }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '');
    const next = safeNext(String(form.get('next') ?? ''), '');
    const res = await requestLogin(sql, authConfig(url.origin), email, getClientAddress(), { next });
    if (!res.ok) return fail(400, { email, error: 'Please enter a valid email address.' });
    // Same answer whether or not the address has an account, and whether or not an email was actually sent.
    return { sent: true, email };
  }
};
