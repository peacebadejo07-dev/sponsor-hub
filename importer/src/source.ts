import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const CONTENT_API =
  'https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers';

export interface RegisterSource {
  path: string;
  label: string;
  publishedOn: string; // YYYY-MM-DD
}

/** Published date from a file name, e.g. "..._2026-09-30.csv" or "Sept 30 2026". */
export function publishedFromName(name: string): string | null {
  const iso = name.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const m = name.match(/([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})/);
  if (m) {
    const mi = months.indexOf(m[1].toLowerCase());
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}

export function localSource(file: string, publishedOverride?: string): RegisterSource {
  const path = resolve(process.env.INIT_CWD ?? process.cwd(), file);
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);
  const publishedOn = publishedOverride ?? publishedFromName(basename(path));
  if (!publishedOn) throw new Error('Cannot infer the register date from the file name. Pass --published YYYY-MM-DD.');
  return { path, label: basename(path), publishedOn };
}

/** Download the latest register CSV via the GOV.UK content API (Open Government Licence). */
export async function downloadLatest(dataDir: string): Promise<RegisterSource> {
  const meta = (await (await fetch(CONTENT_API, { headers: { 'user-agent': 'sponsored-jobs-importer' } })).json()) as {
    details?: { attachments?: { url: string; content_type?: string }[] };
  };
  const att = meta.details?.attachments?.find((a) => a.url.toLowerCase().endsWith('.csv'));
  if (!att) throw new Error('No CSV attachment found on the GOV.UK register page.');
  const name = decodeURIComponent(att.url.split('/').pop()!);
  const publishedOn = publishedFromName(name);
  if (!publishedOn) throw new Error(`Cannot infer date from ${name}`);
  mkdirSync(dataDir, { recursive: true });
  const path = resolve(dataDir, name);
  if (!existsSync(path)) {
    const res = await fetch(att.url, { headers: { 'user-agent': 'sponsored-jobs-importer' } });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return { path, label: name, publishedOn };
}
