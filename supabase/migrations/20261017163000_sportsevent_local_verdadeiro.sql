-- Enriquecimento auditável de partidas e prevenção de SportsEvent sem local.
alter table public.matches add column if not exists venue_name text;
alter table public.matches add column if not exists venue_address text;
alter table public.matches add column if not exists venue_city text;
alter table public.matches add column if not exists venue_region text;
alter table public.matches add column if not exists venue_country text;

-- TheSportsDB informa Estádio Castelão para Ceará x Juventude (17/10/2026).
-- Prefeitura de Fortaleza: Avenida Alberto Craveiro, 2901, Fortaleza-CE.
update public.matches
 set venue_name='Estádio Castelão',venue_address='Avenida Alberto Craveiro, 2901',
     venue_city='Fortaleza',venue_region='CE',venue_country='BR'
 where external_ref='thesportsdb:2431497'
 and home_team='Ceará' and away_team='Juventude' and game_date='2026-10-17';

CREATE OR REPLACE FUNCTION public.agent_import_fixtures(body jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 ev jsonb; ref text; home_name text; away_name text; id_event text;
 iso_time text; kickoff timestamptz; game_day date;
 match_state text; home_score integer; away_score integer;
 slugged text; name_competition text; comp_slug text; count_written int:=0;
begin
 if jsonb_typeof(body->'events') <> 'array' then return 0; end if;
 for ev in select value from jsonb_array_elements(body->'events') loop
   if coalesce(ev->>'strSport','Soccer') <> 'Soccer' then continue; end if;
   id_event := ev->>'idEvent';
   home_name := trim(coalesce(ev->>'strHomeTeam',''));
   away_name := trim(coalesce(ev->>'strAwayTeam',''));
   iso_time := nullif(ev->>'strTimestamp','');
   if iso_time is null then
     iso_time := coalesce(ev->>'dateEvent','') || 'T' || coalesce(ev->>'strTime','');
   end if;
   if id_event !~ '^[0-9]+$' or length(home_name)<2 or length(away_name)<2
      or iso_time !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}' then
      continue;
   end if;
   begin
     kickoff := (replace(substring(iso_time from 1 for 19),' ','T')::timestamp at time zone 'UTC');
   exception when others then continue; end;
   game_day := (kickoff at time zone 'America/Sao_Paulo')::date;
   if game_day < (now() at time zone 'America/Sao_Paulo')::date or
     game_day > (now() at time zone 'America/Sao_Paulo')::date+7 then continue; end if;
   match_state := lower(coalesce(ev->>'strStatus',''));
   match_state := case
     when match_state like '%cancel%' then 'cancelled'
     when match_state like '%postpon%' then 'postponed'
     when match_state like '%finish%' or match_state like '%full time%' then 'finished'
     when match_state like '%live%' or match_state like '%progress%' then 'live'
     else 'scheduled' end;
   home_score := null; away_score := null;
   if match_state in('live','finished') then
     if ev->>'intHomeScore' ~ '^[0-9]+$' then home_score := (ev->>'intHomeScore')::integer; end if;
     if ev->>'intAwayScore' ~ '^[0-9]+$' then away_score := (ev->>'intAwayScore')::integer; end if;
   end if;
   select slug,name into comp_slug,name_competition from public.football_competitions
     where league_id=ev->>'idLeague' and enabled limit 1;
   if not found then
     comp_slug:=null;
     name_competition:=left(coalesce(nullif(trim(ev->>'strLeague'),''),'Futebol'),120);
   end if;
   slugged := regexp_replace(
       translate(lower(home_name||'-x-'||away_name),
        'áàâãäéêèëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'),
       '[^a-z0-9]+','-','g');
   slugged := trim(both '-' from slugged);
   slugged := left(slugged,180)||'-'||id_event;
   ref := 'thesportsdb:'||id_event;
   insert into public.matches (
     external_ref,slug,game_date,league,kickoff_at,
     home_team,home_abbr,away_team,away_abbr,
     home_score,away_score,status,is_published,
     source_url,seo_description,last_checked_at,data_provider,competition_slug,
     venue_name,venue_city,venue_country
   ) values (
     ref,slugged,game_day,name_competition,kickoff,
     left(home_name,120),upper(left(home_name,3)),
     left(away_name,120),upper(left(away_name,3)),
     home_score,away_score,match_state,true,
     'https://www.thesportsdb.com/event/'||id_event,
     left(home_name||' x '||away_name||' pela '||name_competition||
       ' no dia '||to_char(kickoff at time zone 'America/Sao_Paulo','DD/MM/YYYY')||
       ' às '||to_char(kickoff at time zone 'America/Sao_Paulo','HH24:MI')||
       ' (Brasília). Onde assistir: transmissão no Brasil a confirmar.',280),
     now(),'thesportsdb',comp_slug,
     left(nullif(trim(ev->>'strVenue'),''),180),
     left(nullif(trim(ev->>'strCity'),''),120),
     left(nullif(trim(ev->>'strCountry'),''),100)
   )
   on conflict(external_ref) do update set
     game_date=excluded.game_date,league=excluded.league,
     competition_slug=coalesce(excluded.competition_slug,public.matches.competition_slug),
     kickoff_at=excluded.kickoff_at,
     home_team=excluded.home_team,home_abbr=excluded.home_abbr,
     away_team=excluded.away_team,away_abbr=excluded.away_abbr,
     home_score=excluded.home_score,away_score=excluded.away_score,
     status=excluded.status,is_published=true,
     source_url=excluded.source_url,last_checked_at=now(),
     venue_address=case when excluded.venue_name is distinct from public.matches.venue_name
       then null else public.matches.venue_address end,
     venue_region=case when excluded.venue_name is distinct from public.matches.venue_name
       then null else public.matches.venue_region end,
     venue_name=coalesce(excluded.venue_name,public.matches.venue_name),
     venue_city=case when excluded.venue_name is distinct from public.matches.venue_name
       then excluded.venue_city else coalesce(excluded.venue_city,public.matches.venue_city) end,
     venue_country=coalesce(excluded.venue_country,public.matches.venue_country),
     seo_description=case when public.matches.broadcast_status='confirmed'
     then public.matches.seo_description else excluded.seo_description end
   where public.matches.data_provider='thesportsdb';
   count_written:=count_written+1;
 end loop;
 return count_written;
end $function$
;
