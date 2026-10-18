-- Agente de imagens: fotos verificadas e créditos em campo próprio.
-- Não confundir capa editorial gerada pelo site com fotografia licenciada.
alter table public.news_articles add column if not exists image_credit text;
alter table public.news_articles add column if not exists image_credit_url text;
alter table public.watch_titles add column if not exists poster_credit text;
alter table public.watch_titles add column if not exists poster_credit_url text;

create table if not exists public.agent_image_runs (
 kind text not null check(kind in ('noticia','midia')),
 item_id uuid not null,
 title text not null,
 status text not null default 'processing'
  check(status in ('processing','done','not_found','error')),
 attempts integer not null default 0 check(attempts >= 0),
 image_url text,
 credit text,
 credit_url text,
 detail text,
 attempted_at timestamptz not null default now(),
 primary key (kind,item_id)
);
create index if not exists agent_image_runs_recent on public.agent_image_runs(attempted_at desc);
alter table public.agent_image_runs enable row level security;
revoke all on public.agent_image_runs from public,anon,authenticated;
grant select,insert,update on public.agent_image_runs to service_role;

-- Completar créditos das imagens TVmaze preexistentes, sem atribuir falsa autoria ao portal.
update public.watch_titles set
 poster_credit='Imagem disponibilizada via TVmaze; direitos dos respectivos titulares',
 poster_credit_url=source_url
where poster_url like 'https://static.tvmaze.com/%'
 and poster_credit is null
 and source_url like 'https://%';

insert into public.agent_configuration(name,token)
values ('images_editor',encode(gen_random_bytes(24),'hex'))
on conflict(name) do nothing;

-- 06h42, 12h42, 18h42 horário de Brasília. Sem polling ou chamada em loop.
select cron.schedule('guia-de-hoje-imagens','42 9,15,21 * * *',
 $cron$
 select net.http_post(
   url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/agente-imagens',
   headers:=jsonb_build_object(
     'Content-Type','application/json',
     'x-image-cron',(select token from public.agent_configuration where name='images_editor')
   ),
   body:='{}'::jsonb,timeout_milliseconds:=90000
 );
 $cron$);

-- A publicação não depende da disponibilidade de foto. No site, cada matéria
-- ou evento recebe capa editorial identificada quando não há imagem verificável.
