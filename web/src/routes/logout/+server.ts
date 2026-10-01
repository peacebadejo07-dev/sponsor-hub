import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { endSession } from '@sponsored/accounts';
import { sql } from '$lib/server/db';
import { SESSION_COOKIE } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies }) => {
  await endSession(sql, cookies.get(SESSION_COOKIE));
  cookies.delete(SESSION_COOKIE, { path: '/' });
  redirect(303, '/');
};
