-- M4: accounts, profiles, saved items. Passwordless email sign-in; only HASHES of tokens are stored.
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,              -- always stored lowercased
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists login_tokens (
  id                bigserial primary key,
  email             text not null,
  token_hash        text not null unique,          -- sha256 of the emailed token
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  used_at           timestamptz,
  requested_ip_hash text                           -- keyed hash, for rate limiting only
);
create index if not exists login_tokens_email_idx on login_tokens (email, created_at desc);
create index if not exists login_tokens_ip_idx    on login_tokens (requested_ip_hash, created_at desc);

create table if not exists sessions (
  id           bigserial primary key,
  user_id      uuid not null references users(id) on delete cascade,
  token_hash   text not null unique,               -- sha256 of the cookie value
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent   text
);
create index if not exists sessions_user_idx on sessions (user_id);

-- What the user tells us, used only to rank and filter jobs for them.
create table if not exists user_profiles (
  user_id          uuid primary key references users(id) on delete cascade,
  roles            text[] not null default '{}',   -- role families they want
  locations        text[] not null default '{}',   -- UK towns / cities
  work_modes       text[] not null default '{}',   -- remote | hybrid | onsite
  employment_types text[] not null default '{}',
  level            text,                           -- their own level: entry | mid | senior | lead | principal | executive
  skills           text[] not null default '{}',
  years_experience integer,
  needs_sponsorship text,                          -- yes | no | unsure; null = prefers not to say
  min_salary       integer,                        -- GBP a year
  hide_refusals    boolean not null default true,  -- hide postings that say they do not sponsor
  updated_at       timestamptz not null default now()
);

create table if not exists opportunity_marks (
  user_id        uuid not null references users(id) on delete cascade,
  opportunity_id bigint not null references opportunities(id) on delete cascade,
  mark           text not null check (mark in ('saved', 'applied', 'dismissed')),
  created_at     timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);
create index if not exists opportunity_marks_user_idx on opportunity_marks (user_id, mark);

create table if not exists saved_orgs (
  user_id    uuid not null references users(id) on delete cascade,
  org_id     bigint not null references orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);
