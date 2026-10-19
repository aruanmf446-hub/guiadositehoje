-- Acompanhamento do Escritório: cron ativo de todos os agentes, inclusive Otto.
-- Retorna somente metadados de agendamento e execução; nunca expõe comandos ou tokens.
create or replace function public.office_schedule_status()
returns jsonb
language sql security definer set search_path to ''
as $office$
 select coalesce(jsonb_agg(jsonb_build_object(
  'jobname',j.jobname,
  'schedule',j.schedule,
  'active',j.active,
  'last_run',d.start_time,
  'last_status',d.status
 ) order by j.jobname),'[]'::jsonb)
 from cron.job j
 left join lateral (
  select r.start_time,r.status
  from cron.job_run_details r
  where r.jobid=j.jobid
  order by r.start_time desc
  limit 1
 ) d on true
 where j.jobname like 'guia-de-hoje-%'
$office$;
revoke all on function public.office_schedule_status() from public,anon,authenticated;
grant execute on function public.office_schedule_status() to service_role;
