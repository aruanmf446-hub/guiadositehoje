-- Evidências temporárias da recuperação editorial; nenhuma matéria é publicada sem fatos.
create table if not exists public.news_backfill_requests(
 article_id uuid primary key references public.news_articles(id) on delete cascade,
 request_id bigint not null,
 status text not null default 'pending' check(status in ('pending','ready','error','insufficient')),
 detail text,
 requested_at timestamptz not null default now(),
 processed_at timestamptz
);
create index if not exists news_backfill_status_idx on public.news_backfill_requests(status,requested_at);
alter table public.news_backfill_requests enable row level security;
revoke all on public.news_backfill_requests from anon,authenticated;
grant select,insert,update on public.news_backfill_requests to service_role;
