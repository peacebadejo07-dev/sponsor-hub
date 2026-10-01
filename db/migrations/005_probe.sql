-- Track when an organisation's likely job-board addresses were last probed, so we do not re-probe every run.
alter table org_profiles add column if not exists ats_probed_at timestamptz;
alter table org_profiles add column if not exists jsonld_checked_at timestamptz;
create index if not exists org_profiles_probe_idx on org_profiles (ats_probed_at) where ats_type is null;
