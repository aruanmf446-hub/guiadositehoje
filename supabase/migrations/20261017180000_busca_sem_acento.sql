create extension if not exists unaccent with schema extensions;
create or replace function public.search_guia_matches(term text)
returns table(slug text,home_team text,away_team text,league text,kickoff_at timestamptz,status text)
language sql stable security invoker set search_path = ''
as $$
 select m.slug,m.home_team,m.away_team,m.league,m.kickoff_at,m.status
 from public.matches m
 where m.is_published=true and m.slug is not null
 and length(btrim(term)) between 2 and 70
 and (
    extensions.unaccent(lower(m.home_team)) like '%'||extensions.unaccent(lower(term))||'%'
    or extensions.unaccent(lower(m.away_team)) like '%'||extensions.unaccent(lower(term))||'%'
    or extensions.unaccent(lower(m.league)) like '%'||extensions.unaccent(lower(term))||'%'
 )
 order by m.kickoff_at desc limit 40;
$$;
revoke all on function public.search_guia_matches(text) from public;
grant execute on function public.search_guia_matches(text) to anon,authenticated,service_role;
