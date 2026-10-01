import postgres from 'postgres';
import { env } from '$env/dynamic/private';

const url = env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/sponsored';

// Supabase's transaction pooler needs prepared statements off; harmless locally.
export const sql = postgres(url, { max: 5, prepare: false, idle_timeout: 20, onnotice: () => {} });
