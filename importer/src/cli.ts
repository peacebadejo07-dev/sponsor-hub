import { fileURLToPath } from 'node:url';
import { connect } from '@sponsored/db';
import { downloadLatest, localSource } from './source.ts';
import { importRegister } from './import.ts';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const sql = connect(1);
try {
  const file = opt('file');
  const src = file ? localSource(file, opt('published')) : await downloadLatest(fileURLToPath(new URL('../../data/', import.meta.url)));
  console.log(`Register: ${src.label} (published ${src.publishedOn})`);
  const r = await importRegister(sql, src, { force: flag('force') });
  if (r.skipped) console.log('Already imported. Use --force to re-run.');
  else console.log(`Imported ${r.rowCount} rows -> ${r.orgCount} organisations. added=${r.added} changed=${r.changed} removed=${r.removed}`);
  console.log('SUMMARY ' + JSON.stringify({ step: 'register', published: src.publishedOn, skipped: r.skipped, added: r.added, changed: r.changed, removed: r.removed }));
} finally {
  await sql.end();
}
