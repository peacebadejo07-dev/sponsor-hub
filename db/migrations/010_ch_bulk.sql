-- One row per Companies House bulk snapshot we have read, so the monthly file is only processed once.
create table if not exists ch_bulk_imports (
  snapshot_date date primary key,
  rows_read     integer not null,
  matched       integer not null,
  created       integer not null,   -- organisations that had no profile and now carry Companies House data
  updated       integer not null,
  imported_at   timestamptz not null default now()
);
