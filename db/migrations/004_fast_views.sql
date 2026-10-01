-- org_names did a DISTINCT ON over every organisation per query. Look names up through the (name_key, id) index instead.
drop view if exists opportunities_view;
drop view if exists org_names;

create view opportunities_view as
select o.*, n.id as org_id, n.name as org_name, p.website, p.careers_url, p.ats_type,
       extract(day from now() - coalesce(o.posted_at, o.first_seen_at))::int as age_days,
       case when o.repost_count >= 2 then 'Reposted ' || o.repost_count || ' times'
            when now() - coalesce(o.posted_at, o.first_seen_at) > interval '90 days'
              then 'Live for over ' || (extract(day from now() - coalesce(o.posted_at, o.first_seen_at))::int) || ' days'
       end as stale_reason
from opportunities o
join org_profiles p on p.name_key = o.name_key
join lateral (select id, name from orgs where name_key = o.name_key order by id limit 1) n on true;
