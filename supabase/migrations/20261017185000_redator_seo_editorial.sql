-- Redação própria, auditoria e pauta de fontes verificáveis.
alter table public.news_articles add column if not exists seo_title text;
alter table public.news_articles add column if not exists seo_description text;
alter table public.news_articles add column if not exists generated_by_ai boolean not null default false;
alter table public.news_articles add column if not exists editorial_verification text not null default 'source_only';
create table if not exists public.editorial_evidence (
 article_id uuid primary key references public.news_articles(id) on delete cascade,
 evidence text not null,
 source_captured_at timestamptz not null default now()
);
alter table public.editorial_evidence enable row level security;
revoke all on public.editorial_evidence from anon,authenticated;
grant all on public.editorial_evidence to service_role;
create table if not exists public.editorial_ai_runs (
 article_id uuid primary key references public.news_articles(id) on delete cascade,
 created_at timestamptz not null default now(),
 finished_at timestamptz,
 state text not null default 'running'
   check(state in ('running','published','needs_review','error')),
 model text,
 word_count integer,
 detail text
);
alter table public.editorial_ai_runs enable row level security;
revoke all on public.editorial_ai_runs from anon,authenticated;
grant all on public.editorial_ai_runs to service_role;
create index if not exists editorial_ai_runs_created_at on public.editorial_ai_runs(created_at desc);
-- A pauta recebida via RSS só é publicada após gerar e validar texto original.
update public.news_articles set status='draft'
where is_aggregated=true and generated_by_ai=false
and body like 'Este conteúdo é uma referência à reportagem%';

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
     false,'wikipedia-film:'||pageid,'unverified','Wikipedia')
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
   on conflict (slug) do nothing;
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
revoke all on function public.editorial_import_rss(text,text) from public,anon,authenticated;
revoke all on function public.editorial_import_films(jsonb) from public,anon,authenticated;
grant execute on function public.editorial_import_rss(text,text) to service_role;
grant execute on function public.editorial_import_films(jsonb) to service_role;
insert into public.agent_configuration(name,token)
values('seo_editor',encode(sha256((gen_random_uuid()::text||clock_timestamp()::text||gen_random_uuid()::text)::bytea),'hex'))
on conflict(name) do nothing;
select cron.schedule(
  'guia-de-hoje-redator-seo',
  '35 11,21 * * *',
  $task$
  select net.http_post(
    url:='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/redator-seo',
    headers:=jsonb_build_object('Content-Type','application/json',
      'x-editor-cron',(select token from public.agent_configuration where name='seo_editor')),
    body:='{}'::jsonb,
    timeout_milliseconds:=120000
  );
  $task$
);
