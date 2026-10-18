-- Conclusões de agentes não equivalem a pg_cron "succeeded"; ver resultados das tarefas.
CREATE OR REPLACE FUNCTION public.editorial_request(kind_name text, request_key text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target_url text; key_name text; request_id bigint; existing_id bigint;
 br_date date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if kind_name not in ('agencia','bbc','tv_br','tv_web','filmes') then
    raise exception 'invalid kind'; end if;
  key_name:=coalesce(request_key,br_date::text||'/'||kind_name);
  select r.request_id into existing_id from public.agent_editorial_requests r where r.request_key=key_name;
  if existing_id is not null then return existing_id;end if;
  target_url:=case kind_name
    when 'agencia' then 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml'
    when 'bbc' then 'https://feeds.bbci.co.uk/portuguese/rss.xml'
    when 'tv_br' then 'https://api.tvmaze.com/schedule?country=BR&date='||br_date::text
    when 'tv_web' then 'https://api.tvmaze.com/schedule/web?date='||br_date::text
    when 'filmes' then 'https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:'||extract(year from br_date)::int::text||'_films&cmtype=page&cmsort=timestamp&cmdir=desc&cmlimit=50&format=json'
   end;
  request_id:=net.http_get(url:=target_url,timeout_milliseconds:=20000);
  insert into public.agent_editorial_requests(request_key,request_id,kind)
  values(key_name,request_id,kind_name) on conflict on constraint agent_editorial_requests_pkey do nothing;
  return request_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.office_schedule_status()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object(
  'jobname',j.jobname,'schedule',j.schedule,'active',j.active,
  'last_run',lr.start_time,'last_status',lr.status
 ) order by j.jobname),'[]'::jsonb)
 from cron.job j
 left join lateral(
  select d.start_time,d.status from cron.job_run_details d
  where d.jobid=j.jobid order by d.start_time desc limit 1
 ) lr on true
 where j.jobname in(
  'guia-de-hoje-coletor-sql','guia-de-hoje-coletor-processar',
  'guia-de-hoje-editorial','guia-de-hoje-editorial-processar',
  'guia-de-hoje-redator-seo','guia-de-hoje-redator-recuperar',
  'guia-de-hoje-luna-editorial','guia-de-hoje-luna-coletar',
  'guia-de-hoje-luna-processar','guia-de-hoje-revisar-rodada',
  'guia-de-hoje-finalizar-rodada'
 );
$function$
;
-- Segundo disparo somente para recuperar falha do turno, com teto de 2 matérias publicadas/dia.
select cron.schedule('guia-de-hoje-redator-recuperar','10 0,12 * * *',
$$select net.http_post(
 url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/redator-seo',
 headers:=jsonb_build_object('Content-Type','application/json',
  'x-editor-cron',(select token from public.agent_configuration where name='seo_editor')),
 body:='{}'::jsonb,timeout_milliseconds:=120000)$$);
-- Uma tentativa de recuperação da Luna após a publicação agendada das 06h e 18h.
select cron.schedule('guia-de-hoje-luna-recuperar','25 9,21 * * *',
$$select net.http_post(
 url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/luna-editorial',
 headers:=jsonb_build_object('Content-Type','application/json',
  'x-luna-cron',(select token from public.agent_configuration where name='luna_editor')),
 body:='{}'::jsonb,timeout_milliseconds:=115000)$$);
