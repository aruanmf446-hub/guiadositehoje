-- Atualização de agentes reais: duas janelas por dia, horário de Brasília.
-- Publicação e indexação do portal permanecem independentes.
CREATE OR REPLACE FUNCTION public.office_collect_football_batch()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  br_day date := (now() at time zone 'America/Sao_Paulo')::date;
  slot_label text := case when extract(hour from now() at time zone 'UTC')::int < 12 then 'manha' else 'noite' end;
  target date;
  league text;
  idx int;
  request_total int:=0;
begin
  -- Manhã: hoje + dias 1..3; noite: dias 4..7. Revalida hoje à noite.
  for league in select unnest(array['4351','4404','4625','5079']) loop
    for idx in 0..3 loop
      target:=br_day+case when slot_label='manha' then idx else idx+4 end;
      perform public.agent_request_fixtures(target,'events',league,br_day::text||'/v3/'||slot_label||'/'||league||'/'||target::text);
      request_total:=request_total+1;
    end loop;
  end loop;
  if slot_label='noite' then
    perform public.agent_request_fixtures(br_day,'tvevents',null,br_day::text||'/tv-br');
    request_total:=request_total+1;
  end if;
  return jsonb_build_object('requested',request_total,'slot',slot_label);
end; $function$
;
CREATE OR REPLACE FUNCTION public.office_collect_editorial_batch()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  br_day date:=(now() at time zone 'America/Sao_Paulo')::date;
  turn_label text:=case when extract(hour from now() at time zone 'UTC')::int <12 then 'manha' else 'noite' end;
  requested int:=0;
begin
  perform public.editorial_request('agencia',br_day::text||'/v3/'||turn_label||'/agencia');
  perform public.editorial_request('bbc',br_day::text||'/v3/'||turn_label||'/bbc');
  requested:=2;
  if turn_label='manha' then
    perform public.editorial_request('tv_br',br_day::text||'/v3/tv_br');
    perform public.editorial_request('tv_web',br_day::text||'/v3/tv_web');
    perform public.editorial_request('filmes',br_day::text||'/v3/filmes');
    requested:=5;
  end if;
  return jsonb_build_object('requested',requested,'slot',turn_label);
end; $function$
;
revoke all on function public.office_collect_football_batch() from public,anon,authenticated;
revoke all on function public.office_collect_editorial_batch() from public,anon,authenticated;
grant execute on function public.office_collect_football_batch() to service_role;
grant execute on function public.office_collect_editorial_batch() to service_role;
select cron.schedule('guia-de-hoje-coletor-sql','0 9,21 * * *',
 'select public.office_collect_football_batch();');
select cron.schedule('guia-de-hoje-coletor-processar','11 9,21 * * *',
 'select public.agent_collect_tick();');
select cron.schedule('guia-de-hoje-editorial','0 9,21 * * *',
 'select public.office_collect_editorial_batch();');
select cron.schedule('guia-de-hoje-editorial-processar','11 9,21 * * *',
 'select public.editorial_tick();');
