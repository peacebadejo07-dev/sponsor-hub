-- Sector tags now carry their evidence: which source produced each tag (sic | website | jobs | name).
alter table org_profiles
  add column if not exists sector_evidence    jsonb not null default '[]',
  add column if not exists sector_basis       text,          -- strongest source behind the tags, null = none found
  add column if not exists sectors_computed_at timestamptz;

-- Until an organisation's sectors have been computed, fall back to the name-based tags (labelled 'name').
-- Once computed, the profile's tags are the answer; the name is used inside that computation only as a last resort.
create or replace view orgs_enriched as
select o.*,
       p.resolve_status, p.website, p.website_confidence, p.careers_url, p.ats_type, p.size_band,
       p.site_description, p.provenance,
       case when p.sectors_computed_at is not null then coalesce(p.sector_tags, '{}')
            else (select coalesce(array_agg(distinct t order by t), '{}') from unnest(o.sector_tags) t) end as all_sector_tags,
       case when p.sectors_computed_at is not null then p.sector_basis
            when cardinality(o.sector_tags) > 0 then 'name' end as sector_basis,
       case when p.sectors_computed_at is not null then p.sector_evidence else '[]'::jsonb end as sector_evidence
from orgs o left join org_profiles p on p.name_key = o.name_key;
