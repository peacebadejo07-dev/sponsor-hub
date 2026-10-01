-- M2: organisation profiles. One profile per organisation NAME (branches in several towns share it).
create table if not exists org_profiles (
  name_key            text primary key,
  resolve_status      text not null default 'pending',  -- pending | resolved | candidate | not_found | error
  website             text,
  website_confidence  real,
  website_source      text,                              -- wikidata | domain_guess | manual
  website_candidate   text,                              -- best low-confidence guess, never shown as fact
  careers_url         text,
  ats_type            text,                              -- greenhouse | lever | ashby | workable | ...
  ats_slug            text,
  wikidata_id         text,
  companies_house_no  text,
  ch_status           text,
  incorporated_on     date,
  sic_codes           text[] not null default '{}',
  size_band           text,
  industry            text[] not null default '{}',
  sector_tags         text[] not null default '{}',      -- inferred from website text and SIC codes
  site_title          text,
  site_description    text,
  provenance          jsonb not null default '{}',       -- field -> {status, source, confidence, checked_at}
  attempts            integer not null default 0,
  last_error          text,
  resolved_at         timestamptz,
  updated_at          timestamptz not null default now()
);
create index if not exists org_profiles_status_idx on org_profiles (resolve_status);
create index if not exists org_profiles_ats_idx    on org_profiles (ats_type);

-- Orgs joined with their profile; sector tags are the union of name-based and profile-based tags.
create or replace view orgs_enriched as
select o.*,
       p.resolve_status, p.website, p.website_confidence, p.careers_url, p.ats_type, p.size_band,
       p.site_description, p.provenance,
       (select coalesce(array_agg(distinct t order by t), '{}')
          from unnest(o.sector_tags || coalesce(p.sector_tags, '{}')) t) as all_sector_tags
from orgs o left join org_profiles p on p.name_key = o.name_key;
