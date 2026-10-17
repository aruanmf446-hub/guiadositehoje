-- Etapas reais, espaçadas ao longo do turno sem aumentar chamadas externas.
-- Coleta 06:00 / 18:00; processamento 07:05 / 19:05; redator SEO 08:35 / 20:35 (Brasília).
select cron.schedule('guia-de-hoje-coletor-processar','5 10,22 * * *',
 'select public.agent_collect_tick();');
select cron.schedule('guia-de-hoje-editorial-processar','5 10,22 * * *',
 'select public.editorial_tick();');
select cron.schedule('guia-de-hoje-redator-seo','35 11,23 * * *',
 $command$
 select net.http_post(
 url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/redator-seo',
 headers:=jsonb_build_object('Content-Type','application/json',
 'x-editor-cron',(select token from public.agent_configuration where name='seo_editor')),
 body:='{}'::jsonb,timeout_milliseconds:=120000);
 $command$);
create or replace function public.office_schedule_status()
returns jsonb language sql security definer set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'jobname',j.jobname,'schedule',j.schedule,'active',j.active,
 'last_run',lr.start_time,'last_status',lr.status
 ) order by j.jobname),'[]'::jsonb)
 from cron.job j
 left join lateral(
  select d.start_time,d.status from cron.job_run_details d
  where d.jobid=j.jobid order by d.start_time desc limit 1
 ) lr on true
 where j.jobname in('guia-de-hoje-coletor-sql','guia-de-hoje-coletor-processar',
 'guia-de-hoje-editorial','guia-de-hoje-editorial-processar',
 'guia-de-hoje-redator-seo');
$$;
