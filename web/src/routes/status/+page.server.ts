import type { PageServerLoad } from './$types';
import { coverage, lastRuns } from '$lib/server/today';
import { sql } from '$lib/server/db';

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=300' });
  const [runs, cov] = await Promise.all([lastRuns(14), coverage()]);
  // Only counts and step names are shown publicly, never error text.
  const [last] = await sql<{ hours: number | null }[]>`select (extract(epoch from now() - max(finished_at)) / 3600)::int as hours from scan_runs where status in ('ok', 'partial')`;
  return { staleHours: last?.hours ?? null, runs: runs.map((r) => ({ ...r, steps: r.steps.map((s) => ({ name: s.name, status: s.status, seconds: s.seconds })) })), cov };
};
