import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProfile, marksFor } from '@sponsored/accounts';
import { sql } from '$lib/server/db';
import { FOR_YOU_PAGE, rankForUser } from '$lib/server/match';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) redirect(303, '/login?next=/for-you');
  const { profile, exists } = await getProfile(sql, locals.user.userId);
  const page = Math.max(1, Math.min(200, Number(url.searchParams.get('page')) || 1));
  const ranked = await rankForUser(locals.user.userId, profile, page);
  const marks = await marksFor(sql, locals.user.userId, ranked.items.map((i) => i.row.id));
  const hasPrefs = exists && (profile.roles.length + profile.locations.length + profile.skills.length + profile.workModes.length > 0 || profile.level != null || profile.needsSponsorship != null);
  return {
    exists, hasPrefs, profile, page, pages: Math.max(1, Math.ceil(ranked.total / FOR_YOU_PAGE)), total: ranked.total, hiddenCount: ranked.hiddenCount, capped: ranked.capped,
    items: ranked.items.map((i) => ({ ...i, mark: marks.get(i.row.id) ?? null }))
  };
};
