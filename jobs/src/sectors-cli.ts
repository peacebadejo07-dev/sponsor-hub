import { connect } from '@sponsored/db';
import { refreshSectors } from './sectors.ts';

const sql = connect(1);
try {
  console.log(JSON.stringify(await refreshSectors(sql)));
} finally {
  await sql.end();
}
