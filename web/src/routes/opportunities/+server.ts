import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Opportunities moved to the home page. Keep old links (and their filters) working.
export const GET: RequestHandler = ({ url }) => redirect(301, `/${url.search}`);
