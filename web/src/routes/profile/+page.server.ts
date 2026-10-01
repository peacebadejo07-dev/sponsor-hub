import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteAccount, endAllSessions, getProfile, sanitiseProfile, saveProfile, setDigest, splitList } from '@sponsored/accounts';
import { sql } from '$lib/server/db';
import { topCities } from '$lib/server/opps';
import { SESSION_COOKIE } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) redirect(303, '/login?next=/profile');
  const { profile, exists } = await getProfile(sql, locals.user.userId);
  const [{ digest_opt_in }] = await sql<{ digest_opt_in: boolean }[]>`select digest_opt_in from users where id = ${locals.user.userId}`;
  return { digest: digest_opt_in, profile, exists, welcome: url.searchParams.get('welcome') === '1', cities: await topCities(), email: locals.user.email };
};

export const actions: Actions = {
  save: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login?next=/profile');
    const f = await request.formData();
    const profile = sanitiseProfile({
      roles: f.getAll('roles'), locations: splitList(String(f.get('locations') ?? '')), workModes: f.getAll('workModes'),
      employmentTypes: f.getAll('employmentTypes'), level: f.get('level'), skills: splitList(String(f.get('skills') ?? '')),
      yearsExperience: f.get('yearsExperience'), needsSponsorship: f.get('needsSponsorship'), minSalary: f.get('minSalary'),
      hideRefusals: f.get('hideRefusals') === 'on'
    });
    await saveProfile(sql, locals.user.userId, profile);
    await setDigest(sql, locals.user.userId, f.get('digest') === 'on');
    return { saved: true };
  },

  signOutEverywhere: async ({ locals, cookies }) => {
    if (!locals.user) redirect(303, '/login');
    await endAllSessions(sql, locals.user.userId);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    redirect(303, '/login');
  },

  deleteAccount: async ({ request, locals, cookies }) => {
    if (!locals.user) redirect(303, '/login');
    const f = await request.formData();
    // Typing the word is a deliberate speed bump: this cannot be undone.
    if (String(f.get('confirm') ?? '').trim().toLowerCase() !== 'delete') return fail(400, { deleteError: 'Type the word delete to confirm.' });
    await deleteAccount(sql, locals.user.userId);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    redirect(303, '/?deleted=1');
  }
};
