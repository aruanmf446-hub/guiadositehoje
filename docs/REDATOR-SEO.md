# Redator SEO do Guia de Hoje — configuração

## Estado

A função Supabase `redator-seo` e o cron `guia-de-hoje-redator-seo` estão implantados.
O cron chama o agente duas vezes ao dia às **08h35 e 18h35 (horário de Brasília)**.
A função foi testada: autenticação interna funciona e ela retorna
`waiting_for_cloudflare_ai_token` enquanto não houver credencial externa.

**Falta uma configuração única para ativar a redação generativa:**
1. No Cloudflare da conta Pessoal `aruanmf446@gmail.com`, crie um API Token
   limitado à conta com permissões `Workers AI - Read` e `Workers AI - Edit`
   (conforme [documentação Cloudflare](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)).
2. No Supabase, projeto `kffzngznzjgioabtqxju`, acesse Edge Functions > Secrets;
   crie um segredo chamado `CLOUDFLARE_AI_TOKEN` com esse token.
3. O cron do Supabase executará o redator automaticamente na próxima janela.
   Não compartilhe o token em chat ou no GitHub.

## Processo

- RSS Agência Brasil e BBC alimentam a pauta, não artigos vazios.
- A fonte Agência Brasil é armazenada em `editorial_evidence`, RLS sem acesso público.
- Só entram no redator pautas `draft` com conteúdo suficiente e fontes verificáveis.
- A função Cloudflare Workers AI `@cf/meta/llama-3.1-8b-instruct-fp8-fast`
  cria título SEO, metadescrição, resumo e matéria estruturada com o texto-fonte.
- Gatilhos conservadores verificam volume, estrutura, trechos copiados e números
  presentes no material-fonte. Pautas reprovadas **não são indexadas**.
- Máximo de **2 pautas por dia** por padrão. Artigos publicados recebem
  `generated_by_ai=true`, `editorial_verification='ai_source_checks'`
  e atribuição explícita à fonte original.
- **Aviso:** filtros automáticos não substituem checagem humana. Evite uso
  em cobertura sensível sem revisão, principalmente medicina, política eleitoral,
  segurança e acusações. IA ou SEO não garantem aprovação AdSense.

## Comandos de acompanhamento

```sql
select article_id,state,word_count,detail,created_at
from public.editorial_ai_runs order by created_at desc limit 20;

select headline,slug,status,seo_title,generated_by_ai
from public.news_articles order by published_at desc limit 30;

select jobname,active,schedule from cron.job
where jobname in ('guia-de-hoje-redator-seo','guia-de-hoje-editorial');
```

Sem chave o redator não publica, mas o coletor continua preparando novas pautas.
A arquitetura permite trocar a fonte do modelo sem reescrever o site.
