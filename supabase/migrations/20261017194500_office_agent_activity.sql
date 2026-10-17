create table if not exists public.office_agent_activity(
 agent_id text primary key check(agent_id in ('futebol','noticias','filmes','series','seo')),
 status text not null check(status in ('working','waiting','completed','error')),
 task text not null check(char_length(task) between 3 and 300),
 next_task text check(next_task is null or char_length(next_task)<=300),
 evidence_url text,
 updated_at timestamptz not null default now(),
 expires_at timestamptz
);
alter table public.office_agent_activity enable row level security;
revoke all on public.office_agent_activity from anon, authenticated;
grant select, insert, update on public.office_agent_activity to service_role;
create index if not exists office_agent_activity_updated_idx on public.office_agent_activity(updated_at desc);
