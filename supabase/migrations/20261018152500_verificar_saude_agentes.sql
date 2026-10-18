-- Guia de Hoje: verificação de resultados reais dos agentes e recuperação limitada.
-- Nunca confundir pg_cron "succeeded" com reportagem publicada.
create table if not exists public.office_agent_health (
 agent_id text not null,
 slot_key text not null,
 phase text not null,
 status text not null,
 detail text not null default '',
 successes integer not null default 0,
 failures integer not null default 0,
 checked_at timestamptz not null default now(),
 primary key (agent_id,slot_key,phase)
);
create index if not exists office_agent_health_recent_idx on public.office_agent_health(checked_at desc);
alter table public.office_agent_health enable row level security;
revoke all on public.office_agent_health from anon,authenticated;
grant select,insert,update on public.office_agent_health to service_role;

create or replace function public.office_agent_health_write(
 p_agent text,p_slot text,p_phase text,p_status text,
 p_detail text,p_successes integer,p_failures integer
) returns void
language plpgsql security definer set search_path to ''
as $f$
begin
 insert into public.office_agent_health(agent_id,slot_key,phase,status,detail,successes,failures)
 values(p_agent,p_slot,p_phase,p_status,left(p_detail,500),p_successes,p_failures)
 on conflict (agent_id,slot_key,phase) do update set
  status=excluded.status,detail=excluded.detail,successes=excluded.successes,
  failures=excluded.failures,checked_at=now();
end
$f$;
revoke all on function public.office_agent_health_write(text,text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.office_agent_health_write(text,text,text,text,text,integer,integer) to service_role;

-- Uma checagem depois de cada turno: 07h10 e 19h10 de Brasília.
-- A coleta faltante é recriada com a mesma chave; as falhas recebem uma ÚNICA
-- nova chave de recuperação; nenhum modelo de IA é chamado em loop.
create or replace function public.office_agents_check_collect(p_dry_run boolean default false)
returns jsonb language plpgsql security definer set search_path to ''
as $f$
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
   from public.agent_fixture_requests where requested_at>=slotstart;
  else
   editorial_kind:=case a when 'noticias' then array['agencia','bbc']
    when 'filmes' then array['filmes'] else array['tv_br','tv_web'] end;
   select count(*) filter(where status='ok'),count(*) filter(where status='error'),
    count(*) filter(where status='pending'),coalesce(sum(result_count),0)
   into request_ok,request_err,request_pending,new_records
   from public.agent_editorial_requests
   where requested_at>=slotstart and kind=any(editorial_kind);
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
$f$;
revoke all on function public.office_agents_check_collect(boolean) from public,anon,authenticated;
grant execute on function public.office_agents_check_collect(boolean) to service_role;

-- Verificação de redação depois de Otto (08h35 e 20h35 de Brasília).
create or replace function public.office_agents_check_writer(p_dry_run boolean default false)
returns jsonb language plpgsql security definer set search_path to ''
as $f$
declare
 br_day date:=(now() at time zone 'America/Sao_Paulo')::date;
 br_hour int:=extract(hour from now() at time zone 'America/Sao_Paulo')::int;
 slotkey text;
 slotstart timestamptz;
 successful int:=0; rejected int:=0; running int:=0; backlog int:=0; dispatched int:=0;
 state_name text;
begin
 if not p_dry_run and br_hour not in (9,21) then
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
end $f$;
revoke all on function public.office_agents_check_writer(boolean) from public,anon,authenticated;
grant execute on function public.office_agents_check_writer(boolean) to service_role;

-- Quatro avaliações por dia; não faz polling contínuo e não duplica conteúdo.
select cron.schedule('guia-de-hoje-verificar-coletas','10 10,22 * * *',
 'select public.office_agents_check_collect(false);');
select cron.schedule('guia-de-hoje-processar-recuperacao','25 10,22 * * *',
 'select public.agent_collect_tick(),public.editorial_tick();');
select cron.schedule('guia-de-hoje-verificar-redacao','45 12,0 * * *',
 'select public.office_agents_check_writer(false);');
