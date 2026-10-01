-- Only a scheduled, complete run counts as "today's run". Manual runs and partial runs (--only / --skip) are recorded but
-- never stop the real scheduled scan from running, and can never collide with it on the unique index.
alter table scan_runs add column if not exists all_steps boolean not null default true;
drop index if exists scan_runs_one_per_day;
create unique index if not exists scan_runs_one_per_day on scan_runs (run_date) where status in ('ok', 'partial') and trigger = 'schedule' and all_steps;
