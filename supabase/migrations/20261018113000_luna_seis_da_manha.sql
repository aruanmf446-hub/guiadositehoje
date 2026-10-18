-- Luna publica às 06:00 e 18:00 (Brasília), com fontes verificadas coletadas ANTES.
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
  perform public.editorial_request('filmes',br_day::text||'/v4/'||turn_label||'/filmes');
  requested:=3;
  return jsonb_build_object('requested',requested,'slot',turn_label);
end; $function$
;
create or replace function public.office_collect_luna_batch()
returns jsonb language plpgsql security definer set search_path to ''
as $luna$
declare br_day date := (now() at time zone 'America/Sao_Paulo')::date;
 turn_label text := case when extract(hour from now() at time zone 'America/Sao_Paulo')::int <12 then 'manha' else 'noite' end;
begin
 perform public.editorial_request('tv_br',br_day::text||'/v5/'||turn_label||'/tv_br');
 perform public.editorial_request('tv_web',br_day::text||'/v5/'||turn_label||'/tv_web');
 return jsonb_build_object('slot',turn_label,'requested',2);
end $luna$;
revoke all on function public.office_collect_luna_batch() from public,anon,authenticated;
grant execute on function public.office_collect_luna_batch() to service_role;
-- 05h20 coleta, 05h35 processamento, 06h00 publicação SEO; idem 17h20/17h35/18h.
select cron.schedule('guia-de-hoje-luna-coletar','20 8,20 * * *',
 'select public.office_collect_luna_batch();');
select cron.schedule('guia-de-hoje-luna-processar','35 8,20 * * *',
 'select public.editorial_tick();');
select cron.schedule('guia-de-hoje-luna-editorial','0 9,21 * * *',
 $$select net.http_post(
 url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/luna-editorial',
 headers:=jsonb_build_object('Content-Type','application/json',
 'x-luna-cron',(select token from public.agent_configuration where name='luna_editor')),
 body:='{}'::jsonb,timeout_milliseconds:=115000)$$);
