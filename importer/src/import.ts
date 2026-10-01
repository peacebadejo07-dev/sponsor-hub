import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import type { Sql } from 'postgres';
import { aggregateRegister, type OrgRecord, type RegisterRow } from '@sponsored/core';
import type { RegisterSource } from './source.ts';

const BATCH = 5000;

export interface ImportResult {
  importId: number;
  rowCount: number;
  orgCount: number;
  added: number;
  removed: number;
  changed: number;
  skipped: boolean;
}

export function readRegister(path: string): { rows: number; orgs: OrgRecord[] } {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const rows = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true }) as RegisterRow[];
  return { rows: rows.length, orgs: aggregateRegister(rows) };
}

export async function importRegister(sql: Sql, src: RegisterSource, opts: { force?: boolean } = {}): Promise<ImportResult> {
  const { rows, orgs } = readRegister(src.path);
  if (orgs.length < 1000) throw new Error(`Refusing to import: only ${orgs.length} organisations parsed.`);

  const [existing] = await sql`select id from register_imports where published_on = ${src.publishedOn}`;
  if (existing && !opts.force) {
    return { importId: Number(existing.id), rowCount: rows, orgCount: orgs.length, added: 0, removed: 0, changed: 0, skipped: true };
  }

  return sql.begin(async (tx) => {
    if (existing) {
      // Re-import of the same publication date: reuse the import row.
      await tx`update register_imports set source = ${src.label}, row_count = ${rows}, org_count = ${orgs.length}, started_at = now(), finished_at = null where id = ${existing.id}`;
    }
    const importId = existing
      ? Number(existing.id)
      : Number(
          (
            await tx`insert into register_imports (source, published_on, row_count, org_count)
                     values (${src.label}, ${src.publishedOn}, ${rows}, ${orgs.length}) returning id`
          )[0].id
        );

    let added = 0;
    let changed = 0;
    for (let i = 0; i < orgs.length; i += BATCH) {
      const chunk = orgs.slice(i, i + BATCH).map((o) => ({
        name_key: o.nameKey,
        town_key: o.townKey,
        name: o.name,
        town: o.town,
        county: o.county,
        rating: o.rating,
        ratings: o.ratings,
        worker_types: o.workerTypes,
        routes: o.routes,
        sector_tags: o.sectorTags
      }));
      const res = await tx`
        with src as (
          select * from jsonb_to_recordset(${tx.json(chunk)}::jsonb) as t(
            name_key text, town_key text, name text, town text, county text, rating text,
            ratings jsonb, worker_types jsonb, routes jsonb, sector_tags jsonb)
        ), conv as (
          select name_key, town_key, name, town, county, rating,
            array(select jsonb_array_elements_text(ratings)) as ratings,
            array(select jsonb_array_elements_text(worker_types)) as worker_types,
            array(select jsonb_array_elements_text(routes)) as routes,
            array(select jsonb_array_elements_text(sector_tags)) as sector_tags
          from src
        )
        insert into orgs as o (name_key, town_key, name, town, county, rating, ratings, worker_types, routes,
                               sector_tags, first_import_id, last_import_id)
        select name_key, town_key, name, town, county, rating, ratings, worker_types, routes,
               sector_tags, ${importId}, ${importId} from conv
        on conflict (name_key, town_key) do update set
          name = excluded.name, town = excluded.town, county = excluded.county,
          rating = excluded.rating, ratings = excluded.ratings, worker_types = excluded.worker_types,
          routes = excluded.routes, sector_tags = excluded.sector_tags,
          status = 'active', removed_at = null, last_import_id = ${importId},
          updated_at = case when o.rating is distinct from excluded.rating
                              or o.routes is distinct from excluded.routes
                              or o.status <> 'active' then now() else o.updated_at end
        returning (xmax = 0) as inserted`;
      for (const r of res) {
        if (r.inserted) added++;
      }
    }

    // Orgs that existed before this import and had rating/routes changed or came back onto the register.
    const [ch] = await tx`select count(*)::int as n from orgs where last_import_id = ${importId} and first_import_id <> ${importId} and updated_at >= (select started_at from register_imports where id = ${importId})`;
    changed = ch.n;

    const gone = await tx`
      update orgs set status = 'removed', removed_at = now(), updated_at = now()
      where status = 'active' and last_import_id <> ${importId}
      returning id`;

    await tx`update register_imports set added = ${added}, removed = ${gone.length}, changed = ${changed}, finished_at = now() where id = ${importId}`;
    return { importId, rowCount: rows, orgCount: orgs.length, added, removed: gone.length, changed, skipped: false };
  });
}
