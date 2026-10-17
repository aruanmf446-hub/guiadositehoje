# Guia de Hoje

Portal Next.js (App Router) com jogos do dia, notícias e guia de onde assistir.
O conteúdo público é consultado do projeto Supabase **guiadehoje.site**.

## Rodar

```bash
npm ci
npm run dev
npm run typecheck
npm run build
```

As credenciais **publicáveis** do Supabase já estão definidas como padrão em
`lib/supabase.ts`. Pode sobrescrevê-las com variáveis descritas em `.env.example`.
**Nunca** exponha chave `service_role` / `secret` em frontend ou GitHub.

## Banco de dados

Projeto: `kffzngznzjgioabtqxju` (https://supabase.com/dashboard/project/kffzngznzjgioabtqxju).

Tabelas criadas e protegidas por RLS:

- `news_articles`: textos completos, fontes e workflow `draft/published/archived`
- `matches`: partidas e transmissões por data em Brasília
- `watch_titles`: títulos e plataformas para assistir

A leitura pública só retorna artigos publicados (inclusive data de publicação vencida)
e jogos/guias marcados como publicados. **Não há permissões públicas de escrita.**
Para cadastrar/editar, utilize o Table Editor/SQL Editor do Supabase ou um processo
de backend autenticado usando uma chave secreta exclusivamente no servidor.

### Publicar uma notícia

Na tabela `news_articles`, informe `slug` (minúsculas, hífens), `headline`,
`summary`, `body`, `category`, `source_url`, `source_name`,
`published_at` e `status='published'`.
O corpo é texto simples: parágrafos separados por linha em branco.
Um artigo publicado exige data, corpo e URL de fonte.
Fotos devem ser de uso autorizado; informe `image_url` e `image_alt` somente
quando houver direito de uso.

Jogos e catálogos só aparecerão quando `is_published=true`. Partidas precisam
de `game_date` (data de Brasília), `kickoff_at` e equipes.

**O banco começa vazio.** A home mostra mensagens neutras e nunca apresenta dados
inventados. A publicação automática por agente de IA não está ativada nesta entrega.

## SEO

- Títulos e descrições (homepage, arquivo de notícias e cada artigo)
- Canonicals e Open Graph / Twitter Cards
- Imagem de compartilhamento gerada pelo Next.js
- `/robots.txt` e `/sitemap.xml` com URLs de artigos publicados
- Dados estruturados `WebSite`, `Organization` e `NewsArticle`
- Artigos com URLs permanentes em `/noticias/[slug]`

O domínio canônico padrão é `https://guiadehoje.site`, baseado na identificação
do site. Caso o domínio efetivo seja outro, defina `NEXT_PUBLIC_SITE_URL` na
hospedagem **antes de indexar o site**.

## Deploy

Implante na Vercel como Next.js. O site pode ler o projeto Supabase diretamente,
sem credenciais privadas nem novo banco. A home revalida conteúdo periodicamente
(`300s`); não exige um redeploy para buscar novas publicações.

Após configurar domínio e publicar, valide no Search Console:
`https://guiadehoje.site/sitemap.xml`.
