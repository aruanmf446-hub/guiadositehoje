-- Autosserviço editorial para Notícias + Filme + Séries.
alter table public.news_articles add column if not exists is_aggregated boolean not null default false;
create unique index if not exists unique_news_source_url on public.news_articles(source_url) where source_url is not null;
create index if not exists published_news_date on public.news_articles(published_at desc) where status='published';
alter table public.watch_titles add column if not exists external_ref text;
alter table public.watch_titles add column if not exists watch_url text;
alter table public.watch_titles add column if not exists availability_status text not null default 'unverified';
alter table public.watch_titles add column if not exists source_name text;
create unique index if not exists watch_ref_unique on public.watch_titles(external_ref) where external_ref is not null;
create table if not exists public.agent_editorial_requests(
 request_key text primary key, request_id bigint not null unique,
 kind text not null check(kind in('agencia','bbc','tv_br','tv_web','filmes')),
 requested_at timestamptz not null default now(), processed_at timestamptz,
 status text not null default 'pending' check(status in('pending','ok','error')),
 result_count integer not null default 0, error_message text
);
alter table public.agent_editorial_requests enable row level security;
revoke all on public.agent_editorial_requests from anon,authenticated;
grant all on public.agent_editorial_requests to service_role;

CREATE OR REPLACE FUNCTION public.editorial_import_films(payload jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare movie jsonb; movie_title text; pageid text; summary_text text; inserted int:=0; changed int;
begin
 if jsonb_typeof(payload->'query'->'categorymembers')<>'array' then return 0; end if;
 for movie in select value from jsonb_array_elements(payload->'query'->'categorymembers') limit 60 loop
  movie_title:=left(btrim(coalesce(movie->>'title','')),220);
  pageid:=movie->>'pageid';
  if pageid !~ '^[0-9]+$' or length(movie_title)<4 or
     lower(movie_title) like 'list of%' or lower(movie_title) like '%film festival%' then continue;end if;
  summary_text:='Filme mencionado no catálogo enciclopédico de 2026. A plataforma de exibição no Brasil ainda não foi verificada.';
  insert into public.watch_titles(kind,title,platform,synopsis,source_url,watch_url,
     is_published,external_ref,availability_status,source_name)
  values('Filmes',movie_title,'Disponibilidade a confirmar',summary_text,
     'https://en.wikipedia.org/?curid='||pageid,
     'https://en.wikipedia.org/?curid='||pageid,
     true,'wikipedia-film:'||pageid,'unverified','Wikipedia')
  on conflict(external_ref) where external_ref is not null do nothing;
  get diagnostics changed=row_count; inserted:=inserted+changed;
 end loop;
 return inserted;
end $function$
;

CREATE OR REPLACE FUNCTION public.editorial_import_rss(feed text, source_kind text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare root xml; item xml; headline text; url text; teaser text; pub text;
 pub_at timestamptz; source_label text; category_label text; article_slug text;
 inserted int:=0; changed int;
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
     category_label,source_label,url,pub_at,'published',true)
   on conflict (slug) do nothing;
   get diagnostics changed=row_count;
   inserted:=inserted+changed;
 end loop;
 return inserted;
end $function$
;

CREATE OR REPLACE FUNCTION public.editorial_import_series(payload jsonb, br_only boolean)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item jsonb; show_info jsonb; program_name text; id_show text; channel text;
 channel_country text; description_text text; ref text; inserted int:=0; changed int;
begin
 if jsonb_typeof(payload)<>'array' then return 0; end if;
 for item in select value from jsonb_array_elements(payload) limit 300 loop
   show_info:=coalesce(item->'_embedded'->'show',item->'show');
   id_show:=show_info->>'id';
   program_name:=left(btrim(coalesce(show_info->>'name','')),220);
   if id_show !~ '^[0-9]+$' or length(program_name)<2 then continue; end if;
   channel:=coalesce(show_info->'network'->>'name',show_info->'webChannel'->>'name');
   channel_country:=coalesce(show_info->'network'->'country'->>'code',show_info->'webChannel'->'country'->>'code','');
   if br_only and channel_country<>'BR' then continue; end if;
   if not br_only and channel_country not in ('BR','US','GB','') then continue; end if;
   if channel is null or length(channel)<2 then continue; end if;
   ref:='tvmaze:'||id_show;
   description_text:=left(btrim(regexp_replace(coalesce(show_info->>'summary',''),'(<[^>]+>)','','g')),420);
   insert into public.watch_titles(kind,platform,title,synopsis,source_url,watch_url,
      is_published,external_ref,availability_status,source_name)
   values('Séries',
      case when channel_country='BR' then channel||' (programação no Brasil)'
           else channel||' (disponibilidade no Brasil a confirmar)' end,
      program_name,description_text,
      show_info->>'url',show_info->>'url',true,ref,
      case when channel_country='BR' then 'schedule_br' else 'unverified' end,'TVmaze')
   on conflict (external_ref) where external_ref is not null do update set
      title=excluded.title,platform=excluded.platform,synopsis=excluded.synopsis,
      source_url=excluded.source_url,watch_url=excluded.watch_url,
      availability_status=excluded.availability_status,
      updated_at=now()
   where public.watch_titles.source_name='TVmaze';
   get diagnostics changed=row_count;inserted:=inserted+changed;
 end loop;
 return inserted;
end $function$
;

CREATE OR REPLACE FUNCTION public.editorial_request(kind_name text, request_key text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target_url text; key_name text; request_id bigint; existing_id bigint;
 br_date date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if kind_name not in ('agencia','bbc','tv_br','tv_web','filmes') then
    raise exception 'invalid kind'; end if;
  key_name:=coalesce(request_key,br_date::text||'/'||kind_name);
  select r.request_id into existing_id from public.agent_editorial_requests r where r.request_key=key_name;
  if existing_id is not null then return existing_id;end if;
  target_url:=case kind_name
    when 'agencia' then 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml'
    when 'bbc' then 'https://feeds.bbci.co.uk/portuguese/rss.xml'
    when 'tv_br' then 'https://api.tvmaze.com/schedule?country=BR&date='||br_date::text
    when 'tv_web' then 'https://api.tvmaze.com/schedule/web?date='||br_date::text
    when 'filmes' then 'https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:2026_films&cmtype=page&cmlimit=30&format=json'
   end;
  request_id:=net.http_get(url:=target_url,timeout_milliseconds:=20000);
  insert into public.agent_editorial_requests(request_key,request_id,kind)
  values(key_name,request_id,kind_name) on conflict on constraint agent_editorial_requests_pkey do nothing;
  return request_id;
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
  if extract(minute from time_br)::int in (0,15,30) then
    if extract(hour from time_br)::int in (6,9,12,15,18,21) and
      extract(minute from time_br)::int in (0,15) then
      kind_name:=case when extract(minute from time_br)::int=0 then 'agencia' else 'bbc' end;
      key_name:=time_br::date::text||'/'||extract(hour from time_br)::int||'/'||kind_name;
      req_id:=public.editorial_request(kind_name,key_name);
    elsif extract(hour from time_br)::int=7 then
      kind_name:=case extract(minute from time_br)::int
        when 0 then 'tv_br' when 15 then 'tv_web' when 30 then 'filmes' else null end;
      if kind_name is not null then
        key_name:=time_br::date::text||'/'||kind_name;
        req_id:=public.editorial_request(kind_name,key_name);
      end if;
    end if;
  end if;
  return jsonb_build_object('imported',result_count,'request',req_id);
end $function$
;
revoke all on function public.editorial_import_rss(text,text) from public,anon,authenticated;
revoke all on function public.editorial_import_series(jsonb,boolean) from public,anon,authenticated;
revoke all on function public.editorial_import_films(jsonb) from public,anon,authenticated;
revoke all on function public.editorial_request(text,text) from public,anon,authenticated;
revoke all on function public.editorial_tick() from public,anon,authenticated;
grant execute on function public.editorial_import_rss(text,text) to service_role;
grant execute on function public.editorial_import_series(jsonb,boolean) to service_role;
grant execute on function public.editorial_import_films(jsonb) to service_role;
grant execute on function public.editorial_request(text,text) to service_role;
grant execute on function public.editorial_tick() to service_role;
select cron.schedule('guia-de-hoje-editorial','*/15 * * * *','select public.editorial_tick();');
