import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exportUserData } from '@sponsored/accounts';
import { sql } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) error(401, 'Sign in to download your data');
  const data = await exportUserData(sql, locals.user.userId);
  if (!data) error(404, 'Not found');
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="sponsor-hub-my-data.json"', 'cache-control': 'private, no-store' }
  });
};
