# Guia de Hoje

Portal de notícias, jogos e guia de transmissões, desenvolvido em Next.js + Supabase.

## Futebol automático (ativo)

O coletor de partidas agora funciona **no Supabase PostgreSQL** com `pg_cron` e `pg_net`.
Ele faz solicitações espaçadas à **TheSportsDB (chave pública gratuita 123)** e grava
partidas dos **próximos sete dias** em `public.matches` com URLs e SEO próprios.

- Cron: `guia-de-hoje-coletor-sql`, execução a cada 5 minutos. Faz uma chamada externa
  por vez nas janelas 06h–06h55, 12h–12h55, 18h–18h55 (Brasília).
- Consulta mundial de jogos e recortes do Brasileirão Série A, Premier League e
  Liga dos Campeões. O limite gratuito da fonte pode omitir partidas; **não garante
  todos os jogos**.
- Grade brasileira: só informa canal quando a fonte relaciona o evento a `Brazil`;
  sem evidência, mostra **transmissão a confirmar**. Dados sujeitos a alterações.
- Evita duplicatas com `external_ref` e mantém URLs por partida estáveis.
- URLs: `/futebol`, `/futebol/onde-assistir`, `/futebol/[slug]` e `/sitemap.xml`.
- Cada artigo de futebol tem meta title, descrição, canonical, Open Graph e
  dados estruturados `SportsEvent`.
- Site: revalidação automática de ~5 minutos; sitemap de ~15 minutos.

**O coletor antigo da Edge Function `atualizar-jogos` foi DESATIVADO do cron.**
Não o execute em paralelo: ele atingia bloqueios HTTP 403/429.
O coletor atual é um robô de dados e SEO por regras, **sem IA generativa paga**.
Veja [o manual operacional completo](docs/AGENTE-FUTEBOL.md).

## Conferir se está funcionando

No [SQL Editor do Supabase](https://supabase.com/dashboard/project/kffzngznzjgioabtqxju/sql/new):

```sql
select game_date,league,home_team,away_team,broadcast
from public.matches where is_published order by kickoff_at limit 30;

select request_key,status,http_status,items_written,error_text
from public.agent_fixture_requests order by id desc limit 20;

select jobname,active,schedule from cron.job
where jobname='guia-de-hoje-coletor-sql';
```

## Desenvolvimento

```bash
npm ci
npm run typecheck
npm run build
```

A URL e a chave **publicável** do Supabase podem ser configuradas pelas variáveis
em `.env.example`. Nunca exponha chaves secretas ou service_role no frontend.
O domínio canônico configurado é `https://guiadehoje.site`.

Migrations versionadas em `supabase/migrations`. Banco real identificado por
`kffzngznzjgioabtqxju`. As tabelas públicas usam RLS, sem permissões de escrita
para visitantes.
