// After `vite build`: move the adapter's worker aside and put our entry point in front of it.
//
// We cannot point wrangler's `main` at our own file: the adapter deletes and rewrites whatever `main` names. So the adapter writes
// its worker to the default place, and this script wraps it. It then CHECKS the result, and fails the build if the wrapper
// is not in place, because without it signed-in visitors could be served logged-out pages from the edge cache.
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync, appendFileSync } from 'node:fs';

const dir = '.svelte-kit/cloudflare';
const worker = `${dir}/_worker.js`;
const aside = `${dir}/_adapter-worker.js`;

if (!existsSync(worker)) throw new Error(`${worker} not found: run \`vite build\` first`);
if (readFileSync(worker, 'utf8').includes('sh_session=')) throw new Error('The adapter worker already looks wrapped; run a clean build.');

renameSync(worker, aside);
copyFileSync('edge/entry.js', worker);
// Keep both files out of the static assets that Cloudflare serves publicly.
const ignore = `${dir}/.assetsignore`;
const current = existsSync(ignore) ? readFileSync(ignore, 'utf8') : '';
if (!current.includes('_adapter-worker.js')) appendFileSync(ignore, `${current.endsWith('\n') || !current ? '' : '\n'}_adapter-worker.js\n`);

// Guard.
const out = readFileSync(worker, 'utf8');
if (!out.includes('sh_session=') || !out.includes("'no-cache'") || !out.includes('./_adapter-worker.js') || !existsSync(aside)) {
  throw new Error('Worker wrapper is not in place: refusing to produce a build that could cache signed-in pages.');
}
console.log('Worker wrapped: signed-in requests bypass the edge cache.');
