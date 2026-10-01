import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setSavedOrg } from '@sponsored/accounts';
import { sql } from '$lib/server/db';
import { safeNext } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, locals }) => {
  const f = await request.formData();
  const back = safeNext(String(f.get('return') ?? ''), '/');
  if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(back)}`);
  await setSavedOrg(sql, locals.user.userId, Number(f.get('org_id')), f.get('saved') === '1');
  redirect(303, back);
};
