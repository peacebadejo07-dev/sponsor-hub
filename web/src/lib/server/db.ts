import postgres from 'postgres';
import { building, dev } from '$app/environment';
import { env } from '$env/dynamic/private';

// `building` is true while SvelteKit analyses the app at build time, when no database is (or should be) configured.
// At runtime in production a missing DATABASE_URL is a hard error, never a silent fallback to localhost.
const url = env.DATABASE_URL ?? (dev ? 'postgres://postgres:postgres@localhost:54329/sponsored' : '');
if (!url && !building) throw new Error('DATABASE_URL must be set in production');

// Production talks to a hosted database over the internet: insist on TLS. Supabase's pooler needs prepared statements off.
// postgres() connects lazily, so the placeholder used during the build never opens a connection.
export const sql = postgres(url || 'postgres://build:build@localhost/build', { max: 5, prepare: false, idle_timeout: 20, onnotice: () => {}, ssl: dev ? false : 'require' });
