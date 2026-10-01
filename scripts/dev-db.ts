import { fileURLToPath } from 'node:url';
// Starts a local Postgres (embedded binaries) on :54329 for development. No Docker needed.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';

const dir = fileURLToPath(new URL('../data/pgdata', import.meta.url));
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'postgres',
  password: 'postgres',
  port: 54329,
  persistent: true
});

if (!existsSync(`${dir}/PG_VERSION`)) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase('sponsored');
} catch {
  /* already exists */
}
console.log('Postgres ready: postgres://postgres:postgres@localhost:54329/sponsored');
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
