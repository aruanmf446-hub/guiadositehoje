-- Luna: distinguir coleta de catálogo de publicação editorial SEO.
create table if not exists public.luna_editorial_runs (
 id bigint generated always as identity primary key,
 title_id uuid not null references public.watch_titles(id),
 slot_key text not null unique,
 state text not null check (state in ('running','published','needs_review','error')),
 source_url text not null,model text,
 started_at timestamptz not null default now(),finished_at timestamptz,
 word_count int,detail text
);
create index if not exists luna_editorial_runs_started_idx on public.luna_editorial_runs(started_at desc);
alter table public.luna_editorial_runs enable row level security;
revoke all on public.luna_editorial_runs from anon,authenticated;
grant select,insert,update on public.luna_editorial_runs to service_role;
grant usage,select on sequence public.luna_editorial_runs_id_seq to service_role;
insert into public.agent_configuration(name,token)
 values('luna_editor',encode(gen_random_bytes(32),'hex'))
 on conflict(name) do nothing;
-- Coleta às 06:00 e 18:00, importação às 06:15 e 18:15, redação às 06:35 e 18:35.
select cron.schedule('guia-de-hoje-luna-editorial','35 9,21 * * *',
 $$select net.http_post(
 url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/luna-editorial',
 headers:=jsonb_build_object('Content-Type','application/json',
 'x-luna-cron',(select token from public.agent_configuration where name='luna_editor')),
 body:='{}'::jsonb,timeout_milliseconds:=115000)$$);
