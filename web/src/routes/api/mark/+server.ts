import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MARKS, setMark, type Mark } from '@sponsored/accounts';
import { sql } from '$lib/server/db';
import { safeNext } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, locals }) => {
  const f = await request.formData();
  const back = safeNext(String(f.get('return') ?? ''), '/opportunities');
  if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(back)}`);
  const mark = String(f.get('mark') ?? '');
  await setMark(sql, locals.user.userId, Number(f.get('opportunity_id')), (MARKS as string[]).includes(mark) ? (mark as Mark) : null);
  redirect(303, back);
};
