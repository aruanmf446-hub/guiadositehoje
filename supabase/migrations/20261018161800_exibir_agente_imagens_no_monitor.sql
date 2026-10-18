-- Inclui o agendamento das imagens na telemetria sem expor tokens ou comandos SQL.
CREATE OR REPLACE FUNCTION public.office_schedule_status()
 RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO ''
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
  'guia-de-hoje-finalizar-rodada','guia-de-hoje-imagens'
 );
$function$;
revoke all on function public.office_schedule_status() from public,anon,authenticated;
grant execute on function public.office_schedule_status() to service_role;
