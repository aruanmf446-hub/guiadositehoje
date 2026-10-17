alter table public.matches add column if not exists slug text;
alter table public.matches add column if not exists seo_description text;
alter table public.matches add column if not exists broadcaster_source text;
alter table public.matches add column if not exists broadcast_status text not null default 'unconfirmed';
alter table public.matches add column if not exists last_checked_at timestamptz;
alter table public.matches add column if not exists data_provider text not null default 'manual';
create unique index if not exists matches_slug_unique on public.matches (slug) where slug is not null;
create index if not exists matches_upcoming_public on public.matches (kickoff_at, league) where is_published = true;
create table if not exists public.agent_configuration (
  name text primary key, token text not null, created_at timestamptz not null default now()
);
alter table public.agent_configuration enable row level security;
revoke all on public.agent_configuration from anon, authenticated;
grant select on public.agent_configuration to service_role;
insert into public.agent_configuration (name,token)
values ('fixtures_agent',encode(sha256(gen_random_uuid()::text::bytea || clock_timestamp()::text::bytea),'hex'))
on conflict(name) do nothing;
create table if not exists public.agent_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','ok','partial','error')),
  games_found integer not null default 0, games_written integer not null default 0,
  broadcasts_verified integer not null default 0,
  errors jsonb not null default '[]'::jsonb
);
alter table public.agent_runs enable row level security;
revoke all on public.agent_runs from anon, authenticated;
grant select,insert,update on public.agent_runs to service_role;
grant usage,select on sequence public.agent_runs_id_seq to service_role;
