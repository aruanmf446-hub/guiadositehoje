# Agente automático de futebol — Guia de Hoje

## Estado da implantação

O coletor de jogos opera **dentro do Supabase PostgreSQL**, usando `pg_cron + pg_net`, sem custo de API de IA.
As tabelas, funções e o cron estão no projeto `kffzngznzjgioabtqxju`.
A rotina anterior da Edge Function `atualizar-jogos` foi **retirada do agendamento** porque as chamadas diretas dela eram bloqueadas/limitadas.
Ela não deve ser reativada enquanto o coletor SQL estiver funcionando.

## Horários e fontes

- O cron executa uma checagem a cada 5 minutos, mas só faz **uma nova chamada à fonte** de 5 em 5 minutos nas janelas **06:00–06:55, 12:00–12:55 e 18:00–18:55 (Brasília)**. Fora delas processa respostas pendentes.
- A busca cobre de hoje a sete dias adiante, priorizando as quatro divisões nacionais: Série A (4351), B (4404), C (4625) e D (5079).
- A API pública `TheSportsDB v1` retorna **até 3 partidas por consulta diária** na chave gratuita 123, então **a cobertura é parcial**, mesmo com vários recortes.
- Transmissões brasileiras só são preenchidas ao encontrar anúncio marcado explicitamente como `Brazil`; quando ausente, exibimos **Transmissão a confirmar**.
- Evita duplicados por referência externa e preserva o slug dos jogos no banco.
- A publicação no site Next.js ocorre pelo próprio Supabase; **não exige redeploy para cada nova partida**. Revalidação de aproximadamente 5 minutos.
- SEO é feito pelas rotas `/futebol`, `/futebol/onde-assistir`, `/futebol/[slug]` e pelo sitemap dinâmico.
- Este é um **robô de dados por regras**, não um modelo generativo. Não cria matérias textuais fictícias.

## Verificação operacional

No Supabase > SQL Editor:

```sql
select game_date,league,home_team,away_team,broadcast,broadcast_status
from public.matches
where is_published and game_date >= (now() at time zone 'America/Sao_Paulo')::date
order by kickoff_at limit 30;

select requested_at,request_key,http_status,status,items_written,error_text
from public.agent_fixture_requests order by requested_at desc limit 25;

select jobname,schedule,active from cron.job where jobname='guia-de-hoje-coletor-sql';

select start_time,status,return_message from cron.job_run_details
where jobid=(select jobid from cron.job where jobname='guia-de-hoje-coletor-sql')
order by start_time desc limit 10;
```

Sem canais inventados, sem chaves privadas no GitHub, e sem inserção pública. Para cobrir **todos** os jogos e todas as transmissões será necessário avaliar uma fonte de dados com cobertura/licença apropriada.

## Divisões inferiores e SEO automático

- Agenda de consultas: 8 datas da Série B, 8 da Série C, 8 da Série D, 8 da Série A
  e 4 verificações de canais no Brasil, distribuídas nos 36 horários diários.
- Competição identificada pelo ID real da fonte, em `football_competitions`.
- Páginas próprias `/futebol/campeonatos/brasileirao-serie-a` até `serie-d`.
- Os jogos usam URL permanente `/futebol/<slug>`, com canônico e dados `SportsEvent`.
- Os campeonatos só são indexáveis quando há partidas confirmadas nos próximos sete dias.
  Em períodos sem calendário, a página fica acessível aos visitantes, mas com `noindex`.
- O `sitemap.xml` agrega os jogos e as páginas de campeonatos com partidas recentes.
- Limite importante: a API gratuita retorna até três eventos por dia e competição.
  A ausência de partidas na Série C/D pode significar que o campeonato está parado,
  que a fonte não publicou os jogos ou que a cota foi atingida.
