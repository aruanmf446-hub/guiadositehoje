-- Quadro de saúde só deve sinalizar como erro o que permanece sem recuperação.
CREATE OR REPLACE FUNCTION public.office_agents_check_collect(p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 br_time timestamp := now() at time zone 'America/Sao_Paulo';
 br_day date := (now() at time zone 'America/Sao_Paulo')::date;
 br_hour integer := extract(hour from now() at time zone 'America/Sao_Paulo')::integer;
 br_slot text := case when extract(hour from now() at time zone 'America/Sao_Paulo')::integer<12 then 'manha' else 'noite' end;
 slotstart timestamptz;
 slotkey text;
 a text;
 k text;
 request_ok integer;
 request_err integer;
 request_pending integer;
 new_records integer;
 rec record;
 retried integer:=0;
 status_name text;
 report jsonb:='[]'::jsonb;
 editorial_kind text[];
begin
 -- Manual "dry run" não cria pedidos; cron só está autorizado nos dois turnos.
 if not p_dry_run and br_hour not in (7,19) then
  return jsonb_build_object('status','outside_scheduled_window');
 end if;
 slotkey:=br_day::text||'/'||br_slot;
 slotstart:=((br_day::timestamp + case when br_slot='manha' then interval '5 hours'
   else interval '17 hours' end) at time zone 'America/Sao_Paulo');
 if not p_dry_run then
  -- Operações idempotentes: se o pg_cron das 6h/18h não iniciou, faz a rodada.
  perform public.office_collect_football_batch();
  perform public.office_collect_editorial_batch();
  perform public.office_collect_luna_batch();
  -- Recuperar uma vez erros já processados, sem repetir solicitações indefinidamente.
  for rec in select r.kind,r.request_key from public.agent_editorial_requests r
    where r.requested_at>=slotstart and r.status='error'
     and r.request_key not like '%/auto-retry' order by r.requested_at limit 5
  loop
   perform public.editorial_request(rec.kind,rec.request_key||'/auto-retry');
   retried:=retried+1;
  end loop;
  for rec in select r.request_key,r.source_kind,r.query_date,r.league_id
    from public.agent_fixture_requests r
    where r.requested_at>=slotstart and r.status='error'
     and r.request_key not like '%/auto-retry' order by r.requested_at limit 10
  loop
   perform public.agent_request_fixtures(rec.query_date,rec.source_kind,
      rec.league_id,rec.request_key||'/auto-retry');
   retried:=retried+1;
  end loop;
 end if;
 for a in select unnest(array['futebol','noticias','filmes','series']) loop
  request_ok:=0;request_err:=0;request_pending:=0;new_records:=0;
  if a='futebol' then
   select count(*) filter(where status='ok'),count(*) filter(where status='error'),
    count(*) filter(where status='pending'),coalesce(sum(items_written),0)
   into request_ok,request_err,request_pending,new_records
   from public.agent_fixture_requests r where r.requested_at>=slotstart
    and not (r.status='error' and exists (
      select 1 from public.agent_fixture_requests recovery
      where recovery.request_key=r.request_key||'/auto-retry' and recovery.status='ok'));
  else
   editorial_kind:=case a when 'noticias' then array['agencia','bbc']
    when 'filmes' then array['filmes'] else array['tv_br','tv_web'] end;
   select count(*) filter(where status='ok'),count(*) filter(where status='error'),
    count(*) filter(where status='pending'),coalesce(sum(result_count),0)
   into request_ok,request_err,request_pending,new_records
   from public.agent_editorial_requests
   where requested_at>=slotstart and kind=any(editorial_kind)
    and not (status='error' and exists (
     select 1 from public.agent_editorial_requests recovery
     where recovery.request_key=public.agent_editorial_requests.request_key||'/auto-retry'
       and recovery.status='ok'));
  end if;
  status_name:=case
   when request_err>0 then 'retrying'
   when request_ok=0 and request_pending=0 then 'missed'
   when request_pending>0 then 'processing'
   when new_records=0 then 'no_new_content'
   else 'collected' end;
  if not p_dry_run then
   perform public.office_agent_health_write(a,slotkey,'coleta',status_name,
    'Respostas verificadas: '||request_ok||'; pendentes: '||request_pending||
    '; falhas: '||request_err||'; novos registros: '||new_records,request_ok,request_err);
  end if;
  report:=report||jsonb_build_array(jsonb_build_object('agent',a,'status',status_name,
   'ok',request_ok,'pending',request_pending,'errors',request_err,'new',new_records));
 end loop;
 -- A Luna precisa de uma ficha SEO verdadeira, além das séries coletadas.
 select count(*) filter(where state='published'),
   count(*) filter(where state in ('error','needs_review')),
   count(*) filter(where state='running')
 into request_ok,request_err,request_pending
 from public.luna_editorial_runs where slot_key like slotkey||'%';
 status_name:=case
  when request_ok>0 then 'published'
  when request_pending>0 then 'processing'
  when request_err>0 then 'needs_review'
  else 'not_published' end;
 if not p_dry_run then
  perform public.office_agent_health_write('series',slotkey,'publicacao',
   status_name,'Publicações SEO: '||request_ok||'; revisão/erro: '||request_err,
   request_ok,request_err);
  -- A publicação das 06h/18h pode ter sido pulada inteiramente: reenvia UMA vez.
  if request_ok=0 and request_err=0 and request_pending=0
   and not exists(select 1 from public.office_agent_health h
    where h.agent_id='series' and h.slot_key=slotkey and h.phase='resgate')
  then
   perform net.http_post(
    url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/luna-editorial',
    headers:=jsonb_build_object('Content-Type','application/json',
     'x-luna-cron',(select token from public.agent_configuration where name='luna_editor')),
    body:='{}'::jsonb,timeout_milliseconds:=115000
   );
   perform public.office_agent_health_write('series',slotkey,'resgate',
    'dispatched','Publicação não iniciou no horário; reenviada uma vez',0,0);
  end if;
 end if;
 report:=report||jsonb_build_array(jsonb_build_object('agent','series_editorial','status',status_name,
  'published',request_ok,'needs_review',request_err));
 -- Milly roda no GitHub Actions. Auditar no fim da segunda, sem inventar atividade.
 if extract(isodow from br_day)=1 and br_hour>=19 then
  select count(*) into request_ok from public.design_audits
   where status='completed' and finished_at>=
    ((br_day::timestamp+interval '10 hours') at time zone 'America/Sao_Paulo');
  if not p_dry_run then
   perform public.office_agent_health_write('design',slotkey,'semanal',
    case when request_ok>0 then 'published' else 'missed' end,
    case when request_ok>0 then 'Auditoria semanal entregue com evidências'
     else 'GitHub Actions não entregou auditoria nesta semana' end,request_ok,
    case when request_ok>0 then 0 else 1 end);
  end if;
 end if;
 return jsonb_build_object('slot',slotkey,'dry_run',p_dry_run,'retries',retried,'agents',report);
end
$function$
;
CREATE OR REPLACE FUNCTION public.office_agents_check_writer(p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 br_day date:=(now() at time zone 'America/Sao_Paulo')::date;
 br_hour int:=extract(hour from now() at time zone 'America/Sao_Paulo')::int;
 slotkey text;
 slotstart timestamptz;
 successful int:=0; rejected int:=0; running int:=0; backlog int:=0; dispatched int:=0;
 state_name text;
begin
 if not p_dry_run and br_hour not in (9,10,21,22) then
  return jsonb_build_object('status','outside_scheduled_window');
 end if;
 slotkey:=br_day::text||'/'||case when br_hour<12 then 'manha' else 'noite' end;
 slotstart:=((br_day::timestamp+case when br_hour<12 then interval '8 hours'
  else interval '20 hours' end) at time zone 'America/Sao_Paulo');
 select count(*) filter(where state='published'),
  count(*) filter(where state in ('error','needs_review')),
  count(*) filter(where state='running')
 into successful,rejected,running
 from public.editorial_ai_runs
 where created_at>=slotstart and model not like 'news-backfill%';
 select count(*) into backlog
 from public.news_articles n join public.editorial_evidence e on e.article_id=n.id
 where n.status='draft' and n.source_name='Agência Brasil' and length(e.evidence)>=1800
  and not exists(select 1 from public.editorial_ai_runs r where r.article_id=n.id);
 state_name:=case when successful>0 then 'published'
  when running>0 then 'processing'
  when backlog=0 then 'no_verified_source'
  when rejected>0 then 'needs_review' else 'missed' end;
 if not p_dry_run then
  perform public.office_agent_health_write('seo',slotkey,'publicacao',state_name,
   'Matérias publicadas por Otto: '||successful||'; falhas/revisão: '||rejected||
   '; pautas elegíveis: '||backlog,successful,rejected);
  if state_name='missed' and not exists(select 1 from public.office_agent_health
    where agent_id='seo' and slot_key=slotkey and phase='resgate')
  then
   perform net.http_post(
    url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/redator-seo',
    headers:=jsonb_build_object('Content-Type','application/json',
      'x-editor-cron',(select token from public.agent_configuration where name='seo_editor')),
    body:='{}'::jsonb,timeout_milliseconds:=120000);
   perform public.office_agent_health_write('seo',slotkey,'resgate',
    'dispatched','Redator não iniciou apesar das pautas verificadas; recuperação única',0,0);
   dispatched:=1;
  end if;
 end if;
 return jsonb_build_object('slot',slotkey,'status',state_name,'published',successful,
  'rejected',rejected,'active',running,'eligible_backlog',backlog,'recovered',dispatched);
end $function$
;
-- Verifica novamente após a última drenagem de pendências.
select cron.schedule('guia-de-hoje-verificar-coletas','10,45 10,22 * * *',
 'select public.office_agents_check_collect(false);');
select cron.schedule('guia-de-hoje-verificar-redacao-final','10 1,13 * * *',
 'select public.office_agents_check_writer(false);');
-- Backfill é temporário: até 10 tentativas diárias, no máximo 1 por hora
-- (não uma requisição a cada meia hora indefinidamente).
select cron.schedule('guia-de-hoje-backfill-publicar','17 10-19 * * *',
 (select command from cron.job where jobname='guia-de-hoje-backfill-publicar'));
