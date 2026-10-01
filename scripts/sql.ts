import { connect } from '@sponsored/db';
const sql = connect(1);
const rows = await sql.unsafe(process.argv[2]);
console.table(rows);
await sql.end();
