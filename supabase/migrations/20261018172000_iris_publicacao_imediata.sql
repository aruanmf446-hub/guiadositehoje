-- Íris inicia automaticamente após cada publicação, sem esperar o cron.
-- O pg_net só envia HTTP DEPOIS do commit; rollback não produz requisição.
-- Os trabalhos ficam persistidos para recuperação se a solicitação falhar.
alter table public.agent_image_runs drop constraint if exists agent_image_runs_status_check;
alter table public.agent_image_runs add constraint agent_image_runs_status_check
 check (status in ('queued','processing','done','not_found','error'));
alter table public.agent_image_runs drop constraint if exists agent_image_runs_kind_check;
alter table public.agent_image_runs add constraint agent_image_runs_kind_check
 check (kind in ('noticia','midia','jogo'));

create index if not exists agent_image_runs_pending_idx
 on public.agent_image_runs(attempted_at asc) where status='queued';

create or replace function public.iris_after_publication()
returns trigger language plpgsql security definer set search_path to ''
as $iris$
declare
 published boolean:=false;
 kind text; headline text; token_value text;
begin
 if TG_TABLE_NAME='news_articles' then
  published:=(NEW.status='published' and
   (TG_OP='INSERT' or coalesce(OLD.status,'draft')<>'published'));
  kind:='noticia';headline:=NEW.headline;
 elsif TG_TABLE_NAME='watch_titles' then
  published:=(NEW.is_published and
   (TG_OP='INSERT' or not coalesce(OLD.is_published,false)));
  kind:='midia';headline:=NEW.title;
 elsif TG_TABLE_NAME='matches' then
  published:=(NEW.is_published and
   (TG_OP='INSERT' or not coalesce(OLD.is_published,false)));
  kind:='jogo';headline:=NEW.home_team||' x '||NEW.away_team;
 else
  return NEW;
 end if;
 if not published then return NEW; end if;

 -- Publicação gera só uma tarefa identificada por item/categoria.
 -- Republicação reabre o trabalho, mas atualização de imagem não dispara novamente.
 begin
  insert into public.agent_image_runs(kind,item_id,title,status,attempts,
    image_url,credit,credit_url,detail,attempted_at)
  values(kind,NEW.id,left(headline,220),'queued',0,null,null,null,
   'Aguardando execução imediata após publicação',now())
  on conflict(kind,item_id) do update
  set title=excluded.title,status='queued',attempts=0,image_url=null,
      credit=null,credit_url=null,detail=excluded.detail,attempted_at=now();
 exception when others then
  raise warning 'iris_queue_failed: %',SQLERRM;
  return NEW;
 end;

 -- A fila não depende do HTTP. Falha de rede nunca impede a publicação.
 begin
  select token into token_value from public.agent_configuration
   where name='images_editor';
  if nullif(token_value,'') is not null then
   perform net.http_post(
    url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/agente-imagens',
    headers:=jsonb_build_object('Content-Type','application/json',
     'x-image-cron',token_value),
    body:=jsonb_build_object('kind',kind,'item_id',NEW.id),
    timeout_milliseconds:=90000
   );
  end if;
 exception when others then
  raise warning 'iris_dispatch_failed: %',SQLERRM;
 end;
 return NEW;
end
$iris$;

revoke all on function public.iris_after_publication() from public,anon,authenticated;

drop trigger if exists iris_news_published on public.news_articles;
create trigger iris_news_published
after insert or update of status on public.news_articles
for each row execute function public.iris_after_publication();

drop trigger if exists iris_media_published on public.watch_titles;
create trigger iris_media_published
after insert or update of is_published on public.watch_titles
for each row execute function public.iris_after_publication();

drop trigger if exists iris_match_published on public.matches;
create trigger iris_match_published
after insert or update of is_published on public.matches
for each row execute function public.iris_after_publication();

-- Recupera tarefas cujo disparo não chegou ao Edge Function (sem polling constante).
select cron.schedule('guia-de-hoje-imagens-resgatar','*/30 * * * *',
 $cron$
 select net.http_post(
  url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/agente-imagens',
  headers:=jsonb_build_object('Content-Type','application/json',
   'x-image-cron',(select token from public.agent_configuration where name='images_editor')),
  body:='{}'::jsonb,timeout_milliseconds:=90000
 )
 where exists (
  select 1 from public.agent_image_runs
  where status='queued' and attempted_at < now()-interval '10 minutes'
 );
 $cron$);
