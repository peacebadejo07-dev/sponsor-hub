import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { savedForUser } from '$lib/server/match';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(303, '/login?next=/saved');
  const { rows, orgs } = await savedForUser(locals.user.userId);
  return {
    saved: rows.filter((r) => r.mark === 'saved'),
    applied: rows.filter((r) => r.mark === 'applied'),
    dismissed: rows.filter((r) => r.mark === 'dismissed'),
    orgs
  };
};
