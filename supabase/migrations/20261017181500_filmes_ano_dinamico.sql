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
    when 'filmes' then 'https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:'||extract(year from br_date)::int::text||'_films&cmtype=page&cmlimit=30&format=json'
   end;
  request_id:=net.http_get(url:=target_url,timeout_milliseconds:=20000);
  insert into public.agent_editorial_requests(request_key,request_id,kind)
  values(key_name,request_id,kind_name) on conflict on constraint agent_editorial_requests_pkey do nothing;
  return request_id;
end $function$
;
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
  summary_text:='Filme mencionado em um catálogo enciclopédico do ano corrente. A plataforma de exibição no Brasil ainda não foi verificada.';
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