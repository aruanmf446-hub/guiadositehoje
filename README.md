# Guia de Hoje

Portal de notícias, jogos e guia de transmissões, desenvolvido em Next.js + Supabase.

## Futebol automático (ativo)

O coletor de partidas agora funciona **no Supabase PostgreSQL** com `pg_cron` e `pg_net`.
Ele faz solicitações espaçadas à **TheSportsDB (chave pública gratuita 123)** e grava
partidas dos **próximos sete dias** em `public.matches` com URLs e SEO próprios.

- Cron: `guia-de-hoje-coletor-sql`, execução a cada 5 minutos. Faz uma chamada externa
  por vez nas janelas 06h–06h55, 12h–12h55, 18h–18h55 (Brasília).
- Prioridade às Séries **A, B, C e D** do Brasileirão, com oito consultas diárias por divisão.
  Se não houver partidas disponíveis, não são geradas partidas ou canais fictícios.
  O limite gratuito da fonte pode omitir partidas; **não garante todos os jogos**.
- Grade brasileira: só informa canal quando a fonte relaciona o evento a `Brazil`;
  sem evidência, mostra **transmissão a confirmar**. Dados sujeitos a alterações.
- Evita duplicatas com `external_ref` e mantém URLs por partida estáveis.
- URLs: `/futebol`, `/futebol/onde-assistir`, `/futebol/[slug]`,
  `/futebol/campeonatos/[slug]` e `/sitemap.xml`.
- Cada jogo tem meta title, descrição, canonical, Open Graph e
  dados estruturados `SportsEvent`. As divisões recebem metadados próprios e
  páginas `CollectionPage`; **só entram no sitemap quando têm jogos próximos**.
  Competições sem jogos têm `noindex`.
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

## Capa editorial e novos agentes (17/10/2026)

- Página inicial: somente partidas **do dia de Brasília** ainda por começar;
  partidas ao vivo só enquanto o início foi há menos de três horas.
  Partidas encerradas saem da capa, mas permanecem em `/buscar?q=...` e nas
  URLs originais indexáveis em `/futebol/[slug]`.
- Pesquisa `/buscar`: times, campeonatos, notícias e filmes/séries (com
  `robots=noindex` para não gerar páginas de resultados duplicadas).
- Capa editorial: notícias com crédito e link à fonte, filmes em destaque, séries
  e jogos futuros selecionados. Catálogo completo em `/filmes-series`.
- Agente de notícias: fontes RSS Agência Brasil e BBC News Brasil, usando apenas
  título/referência e chamadas para o material original; evita fingir que
  reportagens de terceiros são apuração do Guia de Hoje. Essas chamadas
  agregadas não entram como artigos autorais no sitemap e usam `noindex`.
- Séries/programas: TVmaze (programação brasileira quando confirmada;
  disponibilidade de outros territórios é indicada como não verificada).
- Filmes: catálogo de referência de 2026 na Wikipedia; **não implica**
  disponibilidade em streaming. Onde assistir permanece "a confirmar" sem
  licenças/API regional verificada.
- Cron `guia-de-hoje-editorial` a cada 15 min processa as respostas e
  programa novas consultas: notícias às 6h, 9h, 12h, 15h, 18h e 21h,
  filmes/séries às 7h, horário de Brasília. Execução é gratuita dentro dos
  limites do Supabase e das fontes, sujeita a disponibilidade.
- SEO: página de coleção de mídia, notícias com fonte, dados estruturados
  na homepage; jogos antigos continuam no sitemap, limitado aos 1500
  registros recentes. Os modelos de IA generativa ainda **não estão ativados**:
  são coletores automáticos com regras, sem uso de API paga.
