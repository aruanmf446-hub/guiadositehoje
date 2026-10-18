-- Disparo manual auditável para conferir uma publicação real agora.
create or replace function public.news_backfill_start_once()
returns bigint language plpgsql security definer set search_path to ''
as $run$
declare ref bigint;
begin
 select net.http_post(
 url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/noticias-backfill',
 headers:=jsonb_build_object('Content-Type','application/json',
 'x-backfill-token',(select token from public.agent_configuration where name='backfill_news')),
 body:='{}'::jsonb,
 timeout_milliseconds:=110000
 ) into ref;
 return ref;
end;
$run$;
revoke all on function public.news_backfill_start_once() from public,anon,authenticated;
grant execute on function public.news_backfill_start_once() to service_role;
