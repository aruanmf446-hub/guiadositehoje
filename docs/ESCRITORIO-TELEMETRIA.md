# Telemetria real do Escritório

O escritório de /escritorio monitora, sem executar, os agentes existentes.

## Integrações atuais

- Supabase: status real de solicitações (futebol, editorial e redator SEO), pautas com evidência, publicações e próximos horários dos jobs pg_cron via RPC protegida.
- GitHub: últimos commits da branch padrão e estados de GitHub Actions. Classificação de commits **por palavras no assunto**, não por identidade do autor. A associação a Otto é uma inferência de assunto (SEO/redator/sitemap), não prova de que ele executou determinada conversa.
- GitHub Actions: estado de validação de código é separado do estado de execução da IA. Uma build em andamento NÃO é escrita de artigo.
- Último trabalho: URL verificável (publicação ou commit). "Próxima": estimativa da próxima execução a partir da programação atualmente ativa no Supabase, não garantia de publicação.
- "Trabalhando agora": exclusivo de execução marcada como **running/processing/in_progress** recentemente no banco. Solicitações pending aparecem como fila, não como IA executando.

## Segurança

Requer OFFICE_PASSWORD e SUPABASE_SERVICE_ROLE_KEY configuradas **apenas no ambiente de servidor** da Vercel. Se não existirem, o escritório continua lendo somente publicações públicas e commits GitHub. A função SQL `office_schedule_status()` é concedida exclusivamente a `service_role` e não retorna comandos ou segredos.

Opcional: adicione GITHUB_MONITOR_TOKEN na Vercel, sem prefixo NEXT_PUBLIC, para aumentar os limites da API do GitHub. A consulta funciona sem token para um repositório público, usando cache de 90 segundos. Nunca enviar tokens para o navegador.

## Por que não consigo ver outra conversa do ChatGPT?

ChatGPT não expõe automaticamente ao site o estado interno de outras conversas. Só é possível observar ações externas confirmáveis: commits, workflows, jobs, filas, publicações. Para mostrar o que o agente digita/planeja **antes** de executar algo, seria necessária telemetria explícita emitida pelo próprio executor. Não inventar a atividade.

## Layout

Em desktops com altura de até 1000px, o escritório mantém o cenário e a ficha visíveis numa única viewport; conteúdo da ficha rola internamente. Em telefones, mantém layout vertical acessível e rolável.

A consulta atualiza a cada 45 segundos. As consultas externas ao GitHub possuem cache próprio de 90 segundos.


## Agentes de outros chats (integração ativa, opt-in)

A tabela privada \`public.office_agent_activity\` foi criada no Supabase do Guia de Hoje. Ela permite a um executor autorizado informar o trabalho ao escritório **sem compartilhar senhas em texto ou abrir o acesso público**.

Quando iniciar uma tarefa em outro chat/serviço, o executor pode gravar seu identificador e um resumo verdadeiro:

\`\`\`sql
insert into public.office_agent_activity
 (agent_id,status,task,next_task,updated_at,expires_at)
values
 ('seo','working','Redigindo matéria com evidências verificadas',
  'Validar conteúdo e publicar caso passe nas verificações',
  now(),now()+interval '10 minutes')
on conflict(agent_id) do update set
 status=excluded.status,task=excluded.task,next_task=excluded.next_task,
 updated_at=excluded.updated_at,expires_at=excluded.expires_at;
\`\`\`

Para indicar conclusão, use a mesma instrução com \`status='completed'\`, \`task\` contendo a entrega e \`evidence_url\` com URL comprovável. Estados permitidos: \`working\`, \`waiting\`, \`completed\`, \`error\`. IDs válidos: \`seo\`, \`noticias\`, \`futebol\`, \`filmes\`, \`series\`.

Atualize o heartbeat de um agente em execução ao menos uma vez a cada **5 minutos**. Após 10 minutos sem nova atualização (ou expiração), o escritório deixa de exibir "trabalhando" por esse registro. O dashboard também observa diretamente os jobs do Supabase.

**Não** envie chaves secretas no chat; execute o registro na conexão Supabase autorizada. A tabela tem RLS e nenhum acesso anônimo ou de usuário comum.

Os agentes existentes não começam a executar automaticamente porque o escritório existe: a conexão observa ações reais dos coletores e editores. A escrita de tarefas continua sendo responsabilidade dos jobs e executores originais.
