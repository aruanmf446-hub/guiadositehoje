-- Corrigir rodadas que aparentavam ser puladas:
-- 1. BBC: conflito por URL repetida não pode cancelar a rodada.
-- 2. Processadores não disparam mais novos pedidos no antigo cron de 5/15 min.
-- 3. Filmes/séries entram nos dois turnos, com chave idempotente por turno.
-- 4. Processamento começa após 15 minutos e há uma checagem de recuperação por turno.
CREATE OR REPLACE FUNCTION public.editorial_import_rss(feed text, source_kind text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare root xml; item xml; headline text; url text; teaser text; pub text;
 pub_at timestamptz; source_label text; category_label text; article_slug text;
 inserted int:=0; changed int; article_uuid uuid; evidence_text text;
begin
 if source_kind not in ('agencia','bbc') then return 0; end if;
 source_label:=case when source_kind='agencia' then 'Agência Brasil' else 'BBC News Brasil' end;
 category_label:=case when source_kind='agencia' then 'Brasil' else 'Mundo' end;
 begin root:=xmlparse(document feed); exception when others then return 0; end;
 for item in select unnest(xpath('//item',root)) limit 35 loop
   headline:=nullif(btrim(coalesce((xpath('//title/text()',item))[1]::text,'')),'');
   headline:=replace(replace(headline,'<![CDATA[',''),']]>','');
   url:=btrim(coalesce((xpath('//link/text()',item))[1]::text,''));
   url:=replace(replace(url,'<![CDATA[',''),']]>','');
   pub:=btrim(coalesce((xpath('//pubDate/text()',item))[1]::text,''));
   teaser:=btrim(coalesce((xpath('//description/text()',item))[1]::text,''));
   teaser:='Acompanhe a reportagem na fonte original: '||source_label||'.';
   if headline is null or length(headline)<12 or url !~ '^https://'
      or (source_kind='agencia' and url !~ '^https://agenciabrasil[.]ebc[.]com[.]br/')
      or (source_kind='bbc' and url !~ '^https://(www[.])?bbc[.]com/portuguese/') then continue; end if;
   begin pub_at:=pub::timestamptz; exception when others then continue; end;
   if pub_at>now()+interval '20 minutes' or pub_at<now()-interval '10 days' then continue;end if;
   article_slug:=left(trim(both '-' from regexp_replace(translate(lower(headline),
      'áàâãäéêèëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn'),
      '[^a-z0-9]+','-','g')),90)||'-'||substr(md5(url),1,12);
   insert into public.news_articles(
     slug,headline,summary,body,category,source_name,source_url,
     published_at,status,is_aggregated
   ) values(article_slug,left(headline,220),
     coalesce(nullif(teaser,''),'Veja os detalhes na fonte original.'),
     'Este conteúdo é uma referência à reportagem publicada por '||source_label||
       '. A matéria completa, com apuração e contexto, está disponível na fonte original.',
     category_label,source_label,url,pub_at,'draft',true)
   on conflict do nothing;
   get diagnostics changed=row_count;
   inserted:=inserted+changed;
   -- O RSS é matéria-prima editorial, nunca uma notícia publicada automaticamente.
   if source_kind='agencia' then
     evidence_text := coalesce((xpath('//description/text()',item))[1]::text,'');
     evidence_text := replace(replace(replace(replace(evidence_text,
       '&lt;','<'),'&gt;','>'),'&amp;','&'),'&nbsp;',' ');
     evidence_text := regexp_replace(evidence_text,'<[^>]+>',' ','g');
     evidence_text := left(btrim(regexp_replace(evidence_text,'[[:space:]]+',' ','g')),6500);
     if length(evidence_text)>1400 then
       select id into article_uuid from public.news_articles where slug=article_slug limit 1;
       if article_uuid is not null then
         insert into public.editorial_evidence(article_id,evidence)
           values(article_uuid,evidence_text)
         on conflict(article_id) do update set
           evidence=excluded.evidence,source_captured_at=now();
       end if;
     end if;
   end if;
 end loop;
 return inserted;
end $function$
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
  if true then
    perform public.editorial_request('tv_br',br_day::text||'/v4/'||turn_label||'/tv_br');
    perform public.editorial_request('tv_web',br_day::text||'/v4/'||turn_label||'/tv_web');
    perform public.editorial_request('filmes',br_day::text||'/v4/'||turn_label||'/filmes');
    requested:=5;
  end if;
  return jsonb_build_object('requested',requested,'slot',turn_label);
end; $function$
;
CREATE OR REPLACE FUNCTION public.agent_collect_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 item record; src record; parsed jsonb; written int; processed int:=0;
 utc_now timestamp; slot int; bd date; lookup_date date; lookup_kind text;
 league_id text; req_id bigint:=null; message text;
begin
  for item in
    select id,request_id,source_kind,requested_at
    from public.agent_fixture_requests where status='pending'
    order by requested_at asc limit 15
  loop
    select status_code,error_msg,content into src
      from net._http_response where id=item.request_id order by created desc limit 1;
    if not found then
      if item.requested_at<now()-interval '25 minutes' then
        update public.agent_fixture_requests set
          status='error',error_text='Sem resposta antes do tempo limite',
          processed_at=now() where id=item.id;
      end if;
      continue;
    end if;
    if src.status_code<>200 or src.error_msg is not null or src.content is null then
      update public.agent_fixture_requests set status='error',processed_at=now(),
       http_status=src.status_code,
       error_text=left(coalesce(src.error_msg,'HTTP '||src.status_code),450)
      where id=item.id;
      continue;
    end if;
    begin
      parsed:=src.content::jsonb;
      written:=case when item.source_kind='tvevents' then
        public.agent_import_tv(parsed) else public.agent_import_fixtures(parsed) end;
      update public.agent_fixture_requests set status='ok',
        processed_at=now(),http_status=200,items_written=written where id=item.id;
      processed:=processed+written;
    exception when others then
      get stacked diagnostics message = message_text;
      update public.agent_fixture_requests set status='error',
        processed_at=now(),http_status=src.status_code,
        error_text=left(message,450) where id=item.id;
    end;
  end loop;
  utc_now:=now() at time zone 'UTC';
  if extract(hour from utc_now)::int=0 and extract(minute from utc_now)::int=0 then
    delete from public.agent_fixture_requests where requested_at<now()-interval '21 days';
  end if;
  return jsonb_build_object('games_written',processed,'new_request',req_id);
end $function$
;
CREATE OR REPLACE FUNCTION public.editorial_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare row_item record; response record; result_count int:=0; imported int:=0;
 kind_name text; time_br timestamp := now() at time zone 'America/Sao_Paulo';
 key_name text; req_id bigint:=null; problem text;
begin
  for row_item in
    select request_key,request_id,kind,requested_at from public.agent_editorial_requests
    where status='pending' order by requested_at asc limit 8
  loop
   select status_code,error_msg,content into response from net._http_response
    where id=row_item.request_id order by created desc limit 1;
   if not found then
     if row_item.requested_at<now()-interval '35 minutes' then
       update public.agent_editorial_requests set status='error',
         error_message='Tempo esgotado',processed_at=now() where request_key=row_item.request_key;
     end if;
     continue;
   end if;
   if response.status_code<>200 or response.error_msg is not null or response.content is null then
     update public.agent_editorial_requests set status='error',
       error_message=left(coalesce(response.error_msg,'HTTP '||response.status_code),400),
       processed_at=now() where request_key=row_item.request_key;
     continue;
   end if;
   begin
     imported:=case row_item.kind
       when 'agencia' then public.editorial_import_rss(response.content,'agencia')
       when 'bbc' then public.editorial_import_rss(response.content,'bbc')
       when 'tv_br' then public.editorial_import_series(response.content::jsonb,true)
       when 'tv_web' then public.editorial_import_series(response.content::jsonb,false)
       when 'filmes' then public.editorial_import_films(response.content::jsonb)
       else 0 end;
     update public.agent_editorial_requests set status='ok',processed_at=now(),
       result_count=imported where request_key=row_item.request_key;
     result_count:=result_count+imported;
   exception when others then
     get stacked diagnostics problem=message_text;
     update public.agent_editorial_requests set status='error',
       error_message=left(problem,400),processed_at=now() where request_key=row_item.request_key;
   end;
  end loop;
  return jsonb_build_object('imported',result_count,'request',req_id);
end $function$
;

select cron.schedule('guia-de-hoje-coletor-processar','15 9,21 * * *',
  'select public.agent_collect_tick();');
select cron.schedule('guia-de-hoje-editorial-processar','15 9,21 * * *',
  'select public.editorial_tick();');

create or replace function public.office_recover_scheduled_batches()
returns jsonb
language plpgsql security definer set search_path to ''
as $recover$
declare
 football jsonb; editorial jsonb; processed_football jsonb; processed_editorial jsonb;
begin
 -- As request_keys dos coletores impedem pedidos duplicados.
 football:=public.office_collect_football_batch();
 editorial:=public.office_collect_editorial_batch();
 processed_football:=public.agent_collect_tick();
 processed_editorial:=public.editorial_tick();
 return jsonb_build_object('checked_at',now(),'football',football,
   'editorial',editorial,'processed_football',processed_football,
   'processed_editorial',processed_editorial);
end;
$recover$;
revoke all on function public.office_recover_scheduled_batches() from public,anon,authenticated;
grant execute on function public.office_recover_scheduled_batches() to service_role;

-- Somente 2 verificações diárias, sem polling em segundos ou minutos.
select cron.schedule('guia-de-hoje-revisar-rodada','45 9,21 * * *',
 'select public.office_recover_scheduled_batches();');
select cron.schedule('guia-de-hoje-finalizar-rodada','58 9,21 * * *',
 'select public.agent_collect_tick(),public.editorial_tick();');

-- Reprocessar a resposta já recebida da BBC na rodada com conflito de URL.
update public.agent_editorial_requests
set status='pending',processed_at=null,error_message=null
where kind='bbc' and status='error'
  and error_message like '%unique_news_source_url%'
  and requested_at>=now()-interval '24 hours';
