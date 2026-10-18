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
 if attempts_today >= 10 then return jsonb_build_object('status','daily_limit','attempted_today',attempts_today); end if;
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
