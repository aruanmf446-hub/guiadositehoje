create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
-- Atualizar às 06h20, 12h20 e 18h20 em Brasília (UTC-3).
-- O token é gerado no banco, nunca publicado no GitHub.
select cron.schedule(
  'guia-de-hoje-futebol-3x',
  '20 9,15,21 * * *',
  $job$
  select net.http_post(
    url := 'https://kffzngznzjgioabtqxju.supabase.co/functions/v1/atualizar-jogos',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-token',(select token from public.agent_configuration where name='fixtures_agent')
    ),
    timeout_milliseconds := 90000
  );
  $job$
);
