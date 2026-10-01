-- M1: register foundation. Runs unchanged on local Postgres and Supabase.
create extension if not exists pg_trgm;

create table if not exists register_imports (
  id            bigserial primary key,
  source        text not null,                 -- file name or URL
  published_on  date not null,                 -- date in the register file name
  row_count     integer not null,              -- raw CSV rows
  org_count     integer not null,              -- distinct org+town records
  added         integer not null default 0,
  removed       integer not null default 0,
  changed       integer not null default 0,    -- rating/routes changed
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  unique (published_on)
);

create table if not exists orgs (
  id              bigserial primary key,
  name_key        text not null,               -- normalised dedupe key
  town_key        text not null default '',
  name            text not null,
  town            text not null default '',
  county          text not null default '',
  rating          text not null,               -- A_PREMIUM | A_SME_PLUS | A | B | PROVISIONAL | UNKNOWN
  ratings         text[] not null default '{}',
  worker_types    text[] not null default '{}',
  routes          text[] not null default '{}',
  sector_tags     text[] not null default '{}',
  sector_source   text not null default 'name_rules',  -- provenance: inferred from name only
  status          text not null default 'active',      -- active | removed (left the register)
  first_import_id bigint not null references register_imports(id),
  last_import_id  bigint not null references register_imports(id),
  removed_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (name_key, town_key)
);

create index if not exists orgs_status_idx   on orgs (status);
create index if not exists orgs_town_idx     on orgs (town_key);
create index if not exists orgs_rating_idx   on orgs (rating);
create index if not exists orgs_routes_gin   on orgs using gin (routes);
create index if not exists orgs_sectors_gin  on orgs using gin (sector_tags);
create index if not exists orgs_name_trgm    on orgs using gin (name_key gin_trgm_ops);
create index if not exists orgs_name_sort    on orgs (name_key, id);
