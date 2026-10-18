-- Corrige ambiguidade da variável "kind" no ON CONFLICT da função de trigger.
create or replace function public.iris_after_publication()
returns trigger language plpgsql security definer set search_path to ''
as $iris$
declare
 v_publish boolean:=false;
 v_kind text; v_title text; v_token text;
begin
 if TG_TABLE_NAME='news_articles' then
  v_kind:='noticia';v_title:=NEW.headline;
  if TG_OP='INSERT' then v_publish:=(NEW.status='published');
  else v_publish:=(NEW.status='published' and OLD.status<>'published'); end if;
 elsif TG_TABLE_NAME='watch_titles' then
  v_kind:='midia';v_title:=NEW.title;
  if TG_OP='INSERT' then v_publish:=NEW.is_published;
  else v_publish:=(NEW.is_published and not OLD.is_published); end if;
 elsif TG_TABLE_NAME='matches' then
  v_kind:='jogo';v_title:=NEW.home_team||' x '||NEW.away_team;
  if TG_OP='INSERT' then v_publish:=NEW.is_published;
  else v_publish:=(NEW.is_published and not OLD.is_published); end if;
 else
  return NEW;
 end if;
 if not v_publish then return NEW; end if;
 begin
  insert into public.agent_image_runs(kind,item_id,title,status,attempts,
   image_url,credit,credit_url,detail,attempted_at)
  values(v_kind,NEW.id,left(v_title,220),'queued',0,null,null,null,
   'Aguardando execução imediata após publicação',now())
  on conflict on constraint agent_image_runs_pkey do update
  set title=excluded.title,status='queued',attempts=0,
   image_url=null,credit=null,credit_url=null,detail=excluded.detail,attempted_at=now();
 exception when others then
  raise warning 'iris_queue_failed: %',SQLERRM;
  return NEW;
 end;
 begin
  select ac.token into v_token from public.agent_configuration ac where ac.name='images_editor';
  if nullif(v_token,'') is not null then
   perform net.http_post(
    url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/agente-imagens',
    headers:=jsonb_build_object('Content-Type','application/json','x-image-cron',v_token),
    body:=jsonb_build_object('kind',v_kind,'item_id',NEW.id),timeout_milliseconds:=90000
   );
  end if;
 exception when others then
  raise warning 'iris_dispatch_failed: %',SQLERRM;
 end;
 return NEW;
end
$iris$;
revoke all on function public.iris_after_publication() from public,anon,authenticated;
