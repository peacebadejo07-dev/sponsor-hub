import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/sponsored', { max: 1 });
const rows = await sql.unsafe(process.argv[2]);
console.table(rows);
await sql.end();
