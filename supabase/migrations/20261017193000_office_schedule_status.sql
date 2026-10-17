-- RPC de leitura restrita para monitorar agendamentos existentes do Guia de Hoje.
-- Não retorna comandos, tokens, URLs privadas nem credenciais.
create or replace function public.office_schedule_status()
returns jsonb
language sql
security definer
set search_path = ''
as $office$
 select coalesce(jsonb_agg(jsonb_build_object(
  'jobname', j.jobname, 'schedule', j.schedule, 'active', j.active,
  'last_run', lr.start_time, 'last_status', lr.status
 ) order by j.jobname),'[]'::jsonb)
 from cron.job j
 left join lateral (
  select d.start_time,d.status from cron.job_run_details d
  where d.jobid=j.jobid
  order by d.start_time desc limit 1
 ) lr on true
 where j.jobname in ('guia-de-hoje-coletor-sql','guia-de-hoje-editorial','guia-de-hoje-redator-seo');
$office$;
revoke all on function public.office_schedule_status() from public, anon, authenticated;
grant execute on function public.office_schedule_status() to service_role;
