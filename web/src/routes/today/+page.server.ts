import type { PageServerLoad } from './$types';
import { getProfile, marksFor, rankForUser } from '@sponsored/accounts';
import { sql } from '$lib/server/db';
import { followedOrgsNewRoles, myWatchlistChanges, newRoles, todaySummary, updatedRoles } from '$lib/server/today';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
  setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=300' });
  const [summary, fresh, updated] = await Promise.all([todaySummary(), newRoles(), updatedRoles()]);
  let mine: { top: Awaited<ReturnType<typeof rankForUser>>['items']; watch: Awaited<ReturnType<typeof myWatchlistChanges>>; followed: Awaited<ReturnType<typeof followedOrgsNewRoles>>; hasPrefs: boolean } | null = null;
  let marks: Record<number, string> = {};
  if (locals.user) {
    const { profile, exists } = await getProfile(sql, locals.user.userId);
    const hasPrefs = exists && (profile.roles.length + profile.locations.length + profile.skills.length + profile.workModes.length > 0 || profile.level != null);
    const [top, watch, followed] = await Promise.all([
      hasPrefs ? rankForUser(sql, locals.user.userId, profile, 1, { sinceHours: 72, minScore: 60 }) : Promise.resolve({ items: [] }),
      myWatchlistChanges(locals.user.userId),
      followedOrgsNewRoles(locals.user.userId)
    ]);
    mine = { top: top.items.slice(0, 5), watch, followed, hasPrefs };
    const ids = [...fresh, ...updated, ...top.items.map((i) => i.row), ...watch, ...followed].map((r) => r.id);
    marks = Object.fromEntries(await marksFor(sql, locals.user.userId, [...new Set(ids)]));
  }
  return { summary, fresh, updated, mine, marks, loggedIn: !!locals.user };
};
