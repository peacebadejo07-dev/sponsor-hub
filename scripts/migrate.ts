import { fileURLToPath } from 'node:url';
import { connect } from '@sponsored/db';
import { readdirSync, readFileSync } from 'node:fs';

const sql = connect(1);
const dir = fileURLToPath(new URL('../db/migrations/', import.meta.url));

await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const [done] = await sql`select 1 from schema_migrations where name = ${f}`;
  if (done) continue;
  await sql.begin(async (tx) => {
    await tx.unsafe(readFileSync(dir + f, 'utf8'));
    await tx`insert into schema_migrations (name) values (${f})`;
  });
  console.log('applied', f);
}
await sql.end();
