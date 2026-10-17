# Guia de Hoje

Portal Next.js com artigos, futebol, filmes e séries.

## Agente automático de futebol

A Edge Function `supabase/functions/atualizar-jogos/index.ts` está implantada no projeto `kffzngznzjgioabtqxju`.
O Supabase Cron executa a coleta **três vezes por dia**, 06h20, 12h20 e 18h20 (horário de Brasília), usando o agendamento **UTC 09h20, 15h20, 21h20**.

- Consulta um horizonte de **hoje até os próximos 7 dias**, abrangendo campeonatos brasileiros e internacionais.
- Importa partidas e horários com fuso explícito de Brasília, atualiza resultados, evita duplicações por `external_ref`.
- Faz páginas por jogo em `/futebol/[slug]`, com título, descrição, Open Graph, `SportsEvent`, canonical e sitemap dinâmico.
- Disponibiliza `/futebol` e `/futebol/onde-assistir`, com filtro de transmissões confirmadas.
- Só atribui emissora brasileira se a fonte indicar inequivocamente região **BR/Brasil**. Caso contrário, mostra **transmissão a confirmar**.
- Preserva transmissões inseridas com fonte independente. Nunca inventa canal ou cria artigos fictícios.
- Guarda o estado em `agent_runs` (execuções) e bloqueia chamadas não autorizadas com token aleatório armazenado no Supabase em `agent_configuration`.

**Fonte gratuita utilizada:** [TheSportsDB v1](https://www.thesportsdb.com/docs/api), documentada pelo fornecedor, com limite gratuito de **até 3 eventos por campeonato e data** e **1 anúncio de TV por consulta**. O agente consulta o recorte diário e o próximo evento por campeonato; a lista gratuita pode omitir jogos, portanto não há garantia de cobertura completa. Os anúncios para o Brasil são filtrados por país, e a grade pode mudar. A disponibilidade da API e as condições de reutilização devem ser respeitadas.

**Importante:** este é um agente de automação editorial e SEO por regras verificáveis, **sem modelo de IA generativa ativado** e sem consumo de tokens de IA. Um modelo generativo poderá ser acoplado depois, com sua própria chave e limites gratuitos, sem permitir que invente jogos ou transmissões.

## Consultar execução

Supabase SQL Editor:

```sql
select started_at,finished_at,status,games_found,games_written,broadcasts_verified,errors
from public.agent_runs order by id desc limit 10;

select game_date,league,home_team,away_team,broadcast,broadcast_status,slug
from public.matches where is_published order by kickoff_at limit 40;

select jobid,jobname,schedule,active from cron.job where jobname='guia-de-hoje-futebol-3x';
```

## Dados e publicação

As tabelas `news_articles`, `matches` e `watch_titles` usam RLS. Leitura pública de conteúdos publicados, escrita apenas por processo autorizado. Nunca exponha chaves secretas de banco na Vercel nem no frontend.

A home e as páginas se atualizam sem deploy a cada 5 minutos no Next.js (ISR). Os mecanismos de `sitemap.xml` e `robots.txt` usam como domínio canônico padrão **https://guiadehoje.site**. Confira a configuração real do domínio na Vercel antes de indexar.

## Desenvolvimento

```bash
npm ci
npm run typecheck
npm run build
```

Mudanças em SQL estão em `supabase/migrations`. As migrações já foram aplicadas no projeto Supabase informado.
