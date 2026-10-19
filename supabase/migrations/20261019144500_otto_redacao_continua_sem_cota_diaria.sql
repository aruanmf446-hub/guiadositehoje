-- Otto: fila contínua, sem turnos de expediente nem limite diário de matérias.
-- Mantém validação factual e até três tentativas por pauta reprovada.
CREATE OR REPLACE FUNCTION public.news_backfill_claim()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare chosen public.news_articles%rowtype;
 facts text;
 attempts_today integer;
 start_br timestamptz;
 claimed integer;
begin
 start_br := ((now() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo');
 select coalesce(sum(attempts),0)::int into attempts_today from public.news_backfill_publications
 where last_attempt_at >= start_br;
 -- Sem teto diário: o Otto trabalha enquanto houver pautas verificadas.
 -- Conserva no máximo três revisões da mesma pauta para evitar erros infinitos.
 select n.* into chosen from public.news_articles n
 join public.editorial_evidence e on e.article_id=n.id
 left join public.news_backfill_publications j on j.article_id=n.id
 where n.status='draft' and n.source_name in ('Agência Brasil','BBC News Brasil')
  and n.source_url ~ '^https://' and length(e.evidence)>=1800
  and (j.article_id is null or (j.attempts<3
   and j.state in ('error','needs_review')
   and j.last_attempt_at<now()-interval '40 minutes'))
 order by coalesce(j.attempts,0),length(e.evidence) desc,n.created_at desc
 limit 1 for update of n skip locked;
 if chosen.id is null then return jsonb_build_object('status','no_eligible_drafts'); end if;
 select e.evidence into facts from public.editorial_evidence e where e.article_id=chosen.id;
 insert into public.news_backfill_publications(article_id,state,attempts,last_attempt_at,detail)
 values(chosen.id,'running',1,now(),'Redação e verificação em andamento')
 on conflict(article_id) do update
 set attempts=public.news_backfill_publications.attempts+1,state='running',
 last_attempt_at=now(),detail='Tentativa de recuperação com fonte identificada',finished_at=null
 where public.news_backfill_publications.attempts<3
   and public.news_backfill_publications.state in ('error','needs_review')
   and public.news_backfill_publications.last_attempt_at < now()-interval '40 minutes'
 returning attempts into claimed;
 if claimed is null then return jsonb_build_object('status','claim_conflict'); end if;
 return jsonb_build_object('status','claimed','id',chosen.id,'slug',chosen.slug,
   'headline',chosen.headline,'source_name',chosen.source_name,
   'source_url',chosen.source_url,'category',chosen.category,
   'evidence',left(facts,6200),'attempt',claimed);
end;
$function$
;
-- Desativa três disparadores antigos com cotas e horários fixos.
do $$
declare name text; id bigint;
begin
 foreach name in array array[
  'guia-de-hoje-redator-seo',
  'guia-de-hoje-redator-recuperar',
  'guia-de-hoje-backfill-publicar',
  'guia-de-hoje-verificar-redacao',
  'guia-de-hoje-verificar-redacao-final'
 ] loop
  select j.jobid into id from cron.job j where j.jobname=name;
  if id is not null then
   perform cron.unschedule(id);
   id:=null;
  end if;
 end loop;
end
$$;
-- O cron só faz POST quando existe material verificável que possa ser processado
-- ou revisado após intervalo de espera. Sem requisições de IA com fila vazia.
select cron.schedule(
 'guia-de-hoje-otto-redacao','*/20 * * * *',
 $job$
 select net.http_post(
  url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/redator-seo',
  headers:=jsonb_build_object('Content-Type','application/json',
   'x-editor-cron',(select token from public.agent_configuration where name='seo_editor')),
  body:='{}'::jsonb,timeout_milliseconds:=115000
 )
 where exists (
  select 1 from public.news_articles n
  join public.editorial_evidence e on e.article_id=n.id
  left join public.news_backfill_publications b on b.article_id=n.id
  where n.status='draft'
  and n.source_name in ('Agência Brasil','BBC News Brasil')
  and n.source_url ~ '^https://'
  and length(e.evidence)>=1800
  and (b.article_id is null or
    (b.attempts<3 and b.state in ('error','needs_review')
     and b.last_attempt_at<now()-interval '40 minutes'))
 );
 $job$
);
