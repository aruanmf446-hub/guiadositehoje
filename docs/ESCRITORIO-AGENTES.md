# Escritório dos Agentes — Guia de Hoje

Acesse /escritorio no mesmo site do Guia de Hoje. A visualização é independente da home, das rotas editoriais e do sitemap.

## O que o escritório mostra

- Cinco personagens ilustrados: Futebol, Notícias, Filmes, Séries e Redação/SEO.
- Mesas selecionáveis, ficha individual com a missão e o último registro.
- Histórico real das últimas publicações de noticias, jogos e títulos.
- Atualização automática a cada 45 segundos e botão de atualizar.
- Estado "Trabalhando agora" somente se houver solicitação pendente confirmada nas tabelas de execução.
- Quando não há telemetria de execução, a interface usa "Atividade recente" ou "Aguardando", nunca inventa execução.
- O redator fica como "Sem execução registrada" se ainda não existirem trabalhos no banco.
- Personagens podem se mover por efeito visual; animação não é evidência de processamento.

## Habilitar o acesso restrito

Recomendado: na Vercel, defina OFFICE_PASSWORD (senha forte) e, se quiser, OFFICE_USER (padrão admin). Ao entrar na rota, o navegador solicitará as credenciais via HTTP Basic sobre HTTPS. A proteção se aplica também à API em /api/escritorio/status.

Sem OFFICE_PASSWORD, qualquer pessoa que conheça a URL pode visualizar dados já publicados. A regra noindex evita listagem no Google, mas NÃO substitui autenticação.

Para ler estados de execução precisos, defina SUPABASE_SERVICE_ROLE_KEY somente como variável do servidor Vercel, sem prefixo NEXT_PUBLIC. Essa chave é usada apenas em lib/office.ts, não é transmitida ao navegador. A aplicação funciona sem ela, usando a chave publicável e os dados permitidos pelo RLS.

Use as mesmas NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY do restante do site.

## Escopo

Este escritório é um monitor. Ele não cria jobs, não dispara coletores, não altera o banco, não produz conteúdo automaticamente e não gerencia credenciais. Os robôs atuais são coletores por regras SQL; não se deve afirmar que usam modelos generativos sem integração explícita.

Em caso de quadro vazio, verifique publicações e agendamentos no Supabase. As listas exibem amostras recentes, não o histórico total do banco.
