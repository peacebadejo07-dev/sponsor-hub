-- M5: record every daily run, and let people opt in to a weekly email digest.
create table if not exists scan_runs (
  id          bigserial primary key,
  run_date    date not null,                       -- the UK calendar date the run belongs to
  trigger     text not null default 'schedule',    -- schedule | manual
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running' check (status in ('running', 'ok', 'partial', 'failed')),
  steps       jsonb not null default '[]',         -- one entry per step: name, status, seconds, counts
  summary     jsonb not null default '{}',
  error       text
);
-- At most one completed run per UK day, however many times the scheduler fires (it fires twice to cover BST/GMT).
create unique index if not exists scan_runs_one_per_day on scan_runs (run_date) where status in ('ok', 'partial');
create index if not exists scan_runs_recent on scan_runs (started_at desc);

alter table users add column if not exists digest_opt_in boolean not null default false;
alter table users add column if not exists last_digest_at timestamptz;
