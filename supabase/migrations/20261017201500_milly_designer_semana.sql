create table if not exists public.design_audits (
 id uuid primary key default gen_random_uuid(),run_id bigint not null unique,
 week_key text not null,status text not null check (status in ('capturing','analyzing','completed','error')),
 started_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 finished_at timestamptz,report text,findings jsonb not null default '[]'::jsonb,
 observations jsonb not null default '[]'::jsonb,artifact_url text,error_message text);
create unique index if not exists design_audit_scheduled_week on public.design_audits(week_key)
 where week_key like 'scheduled:%';
create index if not exists design_audits_started_desc on public.design_audits(started_at desc);
alter table public.design_audits enable row level security;
revoke all on public.design_audits from anon,authenticated;
grant all on public.design_audits to service_role;
