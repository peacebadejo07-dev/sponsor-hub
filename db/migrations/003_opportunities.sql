-- M3: live opportunities discovered on organisations' job boards, plus scan history.
-- Full job descriptions are NOT stored (free-tier size): only a short excerpt and the extracted fields.
create table if not exists opportunities (
  id                bigserial primary key,
  name_key          text not null references org_profiles(name_key),
  source            text not null,                    -- greenhouse | lever | ashby | workable | smartrecruiters
  external_id       text not null,
  title             text not null,
  role_family       text not null,
  seniority         text,
  location_raw      text not null,
  city              text,
  work_mode         text,                             -- remote | hybrid | onsite | flexible
  employment_type   text,                             -- full_time | part_time | contract | internship | temporary
  salary_min        integer,
  salary_max        integer,
  salary_currency   text,
  salary_period     text,
  department        text,
  skills            text[] not null default '{}',
  years_experience  integer,
  degree_mentioned  boolean,
  apply_url         text not null,
  excerpt           text,
  sponsorship_signal text not null default 'unmentioned',  -- offered | not_offered | right_to_work | unclear | unmentioned
  sponsorship_snippet text,
  posted_at         timestamptz,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),   -- "last verified"
  changed_at        timestamptz,
  expired_at        timestamptz,
  status            text not null default 'live',         -- live | expired
  missed_scans      integer not null default 0,
  repost_count      integer not null default 0,
  content_hash      text not null,
  provenance        jsonb not null default '{}',          -- field -> verified | inferred (source says which)
  unique (source, name_key, external_id)
);
create index if not exists opps_status_idx   on opportunities (status, last_seen_at desc);
create index if not exists opps_org_idx      on opportunities (name_key);
create index if not exists opps_family_idx   on opportunities (role_family) where status = 'live';
create index if not exists opps_city_idx     on opportunities (city) where status = 'live';
create index if not exists opps_first_idx    on opportunities (first_seen_at desc) where status = 'live';
create index if not exists opps_repost_idx   on opportunities (name_key, lower(title), lower(location_raw));

create table if not exists org_scans (
  id           bigserial primary key,
  name_key     text not null,
  source       text not null,
  slug         text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ok           boolean not null default false,
  http_status  integer,
  jobs_found   integer not null default 0,    -- all jobs on the board
  jobs_kept    integer not null default 0,    -- UK + tech/adjacent
  added        integer not null default 0,
  changed      integer not null default 0,
  expired      integer not null default 0,
  error        text
);
create index if not exists org_scans_org_idx on org_scans (name_key, started_at desc);

-- One display name and link target per organisation name.
create or replace view org_names as
select distinct on (name_key) name_key, id as org_id, name from orgs order by name_key, id;

create or replace view opportunities_view as
select o.*, n.org_id, n.name as org_name, p.website, p.careers_url, p.ats_type,
       extract(day from now() - coalesce(o.posted_at, o.first_seen_at))::int as age_days,
       case when o.repost_count >= 2 then 'Reposted ' || o.repost_count || ' times'
            when now() - coalesce(o.posted_at, o.first_seen_at) > interval '90 days'
              then 'Live for over ' || (extract(day from now() - coalesce(o.posted_at, o.first_seen_at))::int) || ' days'
       end as stale_reason
from opportunities o
join org_names n on n.name_key = o.name_key
join org_profiles p on p.name_key = o.name_key;
