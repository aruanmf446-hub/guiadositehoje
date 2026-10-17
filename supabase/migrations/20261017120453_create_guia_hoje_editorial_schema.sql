-- Migração aplicada no projeto Supabase kffzngznzjgioabtqxju em 17/10/2026.
-- Leitura pública apenas; escritas somente por backend com privilégios.
create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  headline text not null check (char_length(headline) between 10 and 220),
  summary text not null default '',
  body text not null default '',
  category text not null default 'Geral',
  image_url text,
  image_alt text,
  source_name text,
  source_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_article_complete check (status <> 'published' or (published_at is not null and char_length(trim(body)) > 0 and source_url is not null))
);
create index if not exists news_published_idx on public.news_articles (published_at desc) where status = 'published';
create index if not exists news_category_idx on public.news_articles (category, published_at desc) where status = 'published';

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  external_ref text unique,
  game_date date not null,
  league text not null,
  kickoff_at timestamptz not null,
  home_team text not null,
  home_abbr text not null,
  away_team text not null,
  away_abbr text not null,
  home_score integer check (home_score is null or home_score >= 0),
  away_score integer check (away_score is null or away_score >= 0),
  status text not null default 'scheduled' check (status in ('scheduled','live','finished','postponed','cancelled')),
  broadcast text,
  source_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists matches_public_date_idx on public.matches (game_date, kickoff_at) where is_published = true;

create table if not exists public.watch_titles (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('Filmes','Séries','Programas')),
  platform text not null,
  title text not null,
  synopsis text,
  poster_url text,
  source_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists watch_public_idx on public.watch_titles (kind, platform) where is_published = true;

create or replace function public.set_editorial_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end; $$;
create trigger update_news_at before update on public.news_articles for each row execute function public.set_editorial_updated_at();
create trigger update_matches_at before update on public.matches for each row execute function public.set_editorial_updated_at();
create trigger update_watch_at before update on public.watch_titles for each row execute function public.set_editorial_updated_at();

alter table public.news_articles enable row level security;
alter table public.matches enable row level security;
alter table public.watch_titles enable row level security;
create policy "Noticias publicadas visiveis" on public.news_articles for select to anon, authenticated
using (status = 'published' and published_at <= now());
create policy "Jogos publicados visiveis" on public.matches for select to anon, authenticated
using (is_published = true);
create policy "Guias publicados visiveis" on public.watch_titles for select to anon, authenticated
using (is_published = true);

revoke all on public.news_articles, public.matches, public.watch_titles from anon, authenticated;
grant select on public.news_articles, public.matches, public.watch_titles to anon, authenticated;
grant all on public.news_articles, public.matches, public.watch_titles to service_role;
