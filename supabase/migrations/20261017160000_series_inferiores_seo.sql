-- Estrutura editorial brasileira, sem gerar partidas sem fonte.
create table if not exists public.football_competitions (
 slug text primary key check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 league_id text not null unique,
 name text not null,
 description text not null,
 country text not null default 'Brasil',
 display_order integer not null,
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.football_competitions enable row level security;
create policy "Competicoes listadas publicamente"
on public.football_competitions for select to anon,authenticated using(enabled);
revoke all on public.football_competitions from anon,authenticated;
grant select on public.football_competitions to anon,authenticated;
grant all on public.football_competitions to service_role;
insert into public.football_competitions(slug,league_id,name,description,display_order) values
('brasileirao-serie-a','4351','Brasileirão Série A','Jogos do Brasileirão Série A: confrontos, horários de Brasília e canais confirmados.',1),
('brasileirao-serie-b','4404','Brasileirão Série B','Jogos do Brasileirão Série B: datas, horários, equipes e onde assistir.',2),
('brasileirao-serie-c','4625','Brasileirão Série C','Jogos do Brasileirão Série C: datas, equipes e transmissões verificadas.',3),
('brasileirao-serie-d','5079','Brasileirão Série D','Jogos do Brasileirão Série D: calendário e canais quando anunciados.',4)
on conflict(slug) do update set league_id=excluded.league_id,name=excluded.name,
 description=excluded.description,display_order=excluded.display_order;
alter table public.matches add column if not exists competition_slug text references public.football_competitions(slug);
create index if not exists matches_competition_schedule on public.matches(competition_slug,game_date,kickoff_at) where is_published=true;
update public.matches set competition_slug=case
 when league in ('Brazilian Serie A','Brasileirão Série A') then 'brasileirao-serie-a'
 when league in ('Brazilian Serie B','Brasileirão Série B') then 'brasileirao-serie-b'
 when league in ('Brazilian Serie C','Brasileirão Série C') then 'brasileirao-serie-c'
 when league in ('Brazil Serie D','Brasileirão Série D') then 'brasileirao-serie-d'
 else competition_slug end
where competition_slug is null;

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
     source_url,seo_description,last_checked_at,data_provider,competition_slug
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
     now(),'thesportsdb',comp_slug
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
     seo_description=case when public.matches.broadcast_status='confirmed'
     then public.matches.seo_description else excluded.seo_description end
   where public.matches.data_provider='thesportsdb';
   count_written:=count_written+1;
 end loop;
 return count_written;
end $function$
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
  if extract(hour from utc_now)::integer in (9,15,21)
     and extract(minute from utc_now)::integer %5=0 then
    slot:=case extract(hour from utc_now)::integer
      when 9 then 0 when 15 then 12 when 21 then 24 end +
      floor(extract(minute from utc_now)::numeric/5)::integer;
    bd:=(now() at time zone 'America/Sao_Paulo')::date;
    if slot<8 then
      lookup_date:=bd+slot; lookup_kind:='events';league_id:='4404'; -- B
    elsif slot<16 then
      lookup_date:=bd+(slot-8);lookup_kind:='events';league_id:='4625'; -- C
    elsif slot<24 then
      lookup_date:=bd+(slot-16);lookup_kind:='events';league_id:='5079'; -- D
    elsif slot<32 then
      lookup_date:=bd+(slot-24);lookup_kind:='events';league_id:='4351'; -- A
    else
      lookup_date:=bd+(slot-32);lookup_kind:='tvevents';league_id:=null;
    end if;
    req_id:=public.agent_request_fixtures(lookup_date,lookup_kind,league_id,
      bd::text||'/br-series-v2-slot-'||slot::text);
  end if;
  if extract(hour from utc_now)::int=0 and extract(minute from utc_now)::int=0 then
    delete from public.agent_fixture_requests where requested_at<now()-interval '21 days';
  end if;
  return jsonb_build_object('games_written',processed,'new_request',req_id);
end $function$
;
revoke all on function public.agent_import_fixtures(jsonb) from public,anon,authenticated;
revoke all on function public.agent_collect_tick() from public,anon,authenticated;
grant execute on function public.agent_import_fixtures(jsonb) to service_role;
grant execute on function public.agent_collect_tick() to service_role;
