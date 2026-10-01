import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ contact: env.CONTACT_EMAIL ?? null });
