import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getOrg } from '$lib/server/orgs';
import { SECTOR_LABELS } from '@sponsored/core';
import { savedOrgIds } from '@sponsored/accounts';
import { sql } from '$lib/server/db';

export const load: PageServerLoad = async ({ params, setHeaders, locals }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) error(404, 'Organisation not found');
  const found = await getOrg(id);
  if (!found) error(404, 'Organisation not found');
  setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=300' });
  const following = locals.user ? (await savedOrgIds(sql, locals.user.userId, [id])).has(id) : false;
  return { ...found, sectorLabels: SECTOR_LABELS, loggedIn: !!locals.user, following };
};
