-- Fila de recuperação de matérias; publica apenas após redação com evidências verificadas.
create table if not exists public.news_backfill_publications (
 article_id uuid primary key references public.news_articles(id) on delete cascade,
 state text not null check(state in ('running','published','needs_review','error')),
 attempts integer not null default 0,
 detail text,
 last_attempt_at timestamptz not null default now(),
 finished_at timestamptz,
 word_count integer
);
create index if not exists news_backfill_publications_state_idx on public.news_backfill_publications(state,last_attempt_at);
alter table public.news_backfill_publications enable row level security;
revoke all on public.news_backfill_publications from anon,authenticated;
grant select,insert,update on public.news_backfill_publications to service_role;
insert into public.agent_configuration(name,token)
 values('backfill_news',encode(gen_random_bytes(32),'hex'))
 on conflict(name) do nothing;
-- Em retomadas sem supervisão, limite de 10 tentativas diárias no plano gratuito.
create or replace function public.news_backfill_claim()
returns jsonb language plpgsql security definer set search_path to ''
as $fn$
declare chosen public.news_articles%rowtype;
 facts text;
 attempts_today integer;
 start_br timestamptz;
 claimed integer;
begin
 start_br := ((now() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo');
 select count(*) into attempts_today from public.news_backfill_publications
 where last_attempt_at >= start_br;
 if attempts_today >= 10 then return jsonb_build_object('status','daily_limit','attempted_today',attempts_today); end if;
 select n.* into chosen from public.news_articles n
 join public.editorial_evidence e on e.article_id=n.id
 left join public.news_backfill_publications j on j.article_id=n.id
 where n.status='draft' and n.source_name in ('Agência Brasil','BBC News Brasil')
  and n.source_url ~ '^https://' and length(e.evidence)>=1800
  and (j.article_id is null or (j.attempts<3
   and j.state in ('error','needs_review')
   and j.last_attempt_at<now()-interval '40 minutes'))
 order by case when n.source_name='Agência Brasil' then 0 else 1 end,
   n.created_at desc limit 1 for update of n skip locked;
 if chosen.id is null then return jsonb_build_object('status','no_eligible_drafts'); end if;
 select e.evidence into facts from public.editorial_evidence e where e.article_id=chosen.id;
 insert into public.news_backfill_publications(article_id,state,attempts,last_attempt_at,detail)
 values(chosen.id,'running',1,now(),'Redação e verificação em andamento')
 on conflict(article_id) do update
 set attempts=public.news_backfill_publications.attempts+1,state='running',
 last_attempt_at=now(),detail='Tentativa de recuperação com fonte identificada',finished_at=null
 returning attempts into claimed;
 return jsonb_build_object('status','claimed','id',chosen.id,'slug',chosen.slug,
   'headline',chosen.headline,'source_name',chosen.source_name,
   'source_url',chosen.source_url,'category',chosen.category,
   'evidence',left(facts,6200),'attempt',claimed);
end;
$fn$;
revoke all on function public.news_backfill_claim() from public,anon,authenticated;
grant execute on function public.news_backfill_claim() to service_role;

create or replace function public.news_backfill_stop_when_done()
returns boolean language plpgsql security definer set search_path to ''
as $fn$
declare remaining int; jobid bigint;
begin
 select count(*) into remaining from public.news_articles n
 join public.editorial_evidence e on e.article_id=n.id
 left join public.news_backfill_publications j on j.article_id=n.id
 where n.status='draft' and length(e.evidence)>=1800
 and (j.article_id is null or (j.attempts<3 and j.state in ('error','needs_review')));
 if remaining=0 or now()> '2026-10-26 03:00:00+00'::timestamptz then
   select c.jobid into jobid from cron.job c where c.jobname='guia-de-hoje-backfill-publicar';
   if jobid is not null then perform cron.unschedule(jobid);end if;
   return true;
 end if;
 return false;
end;
$fn$;
revoke all on function public.news_backfill_stop_when_done() from public,anon,authenticated;
grant execute on function public.news_backfill_stop_when_done() to service_role;

-- Temporário, a cada meia hora, sem execução em segundos.
select cron.schedule('guia-de-hoje-backfill-publicar','17,47 * * * *',
 $$select net.http_post(url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/noticias-backfill',
 headers:=jsonb_build_object('Content-Type','application/json',
  'x-backfill-token',(select token from public.agent_configuration where name='backfill_news')),
 body:='{}'::jsonb, timeout_milliseconds:=110000)$$);
