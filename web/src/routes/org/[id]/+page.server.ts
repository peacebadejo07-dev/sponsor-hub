import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getOrg } from '$lib/server/orgs';
import { orgRoles, orgLastScan } from '$lib/server/opps';
import { SECTOR_LABELS } from '@sponsored/core';
import { savedOrgIds, marksFor } from '@sponsored/accounts';
import { sql } from '$lib/server/db';

const TABS = ['roles', 'sponsorship', 'locations'] as const;

export const load: PageServerLoad = async ({ params, setHeaders, locals, url }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) error(404, 'Organisation not found');
  const found = await getOrg(id);
  if (!found) error(404, 'Organisation not found');
  setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=300' });
  const [roles, lastScan] = await Promise.all([orgRoles(found.org.name_key), orgLastScan(found.org.name_key)]);
  const following = locals.user ? (await savedOrgIds(sql, locals.user.userId, [id])).has(id) : false;
  const marks = locals.user && roles.length ? Object.fromEntries(await marksFor(sql, locals.user.userId, roles.map((r) => r.id))) : {};
  const t = url.searchParams.get('tab');
  const tab = (TABS as readonly string[]).includes(t ?? '') ? (t as (typeof TABS)[number]) : 'roles';
  return { ...found, roles, lastScan, marks, tab, sectorLabels: SECTOR_LABELS, loggedIn: !!locals.user, following };
};
