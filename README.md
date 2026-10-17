# Guia de Hoje

Site com os jogos do dia, notícias e onde assistir filmes, séries e programas.
Layout baseado no design do canvas "Guia de Hoje".

Stack: Next.js (App Router) + React + TypeScript + Supabase (cliente pronto).

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha as variáveis do Supabase (opcional nesta etapa)
npm run dev
```

Abra http://localhost:3000.

Outros comandos:

```bash
npm run typecheck   # checagem de tipos
npm run build       # build de produção
npm run start       # roda o build
```

## Estrutura

```
app/            layout, página inicial e CSS global (tokens de cor e fonte em :root)
components/     seções e controles de filtro (client components onde há estado)
lib/data.ts     dados de exemplo (jogos, notícias, títulos) — troque por consultas ao Supabase
lib/supabase.ts cliente Supabase; retorna null se as variáveis não estiverem definidas
```

## Deploy

### Parte 1 — preparação do código (feita)

- Projeto Next.js compila sem erros (`npm run build`).
- `.env.example` lista as variáveis necessárias.
- `.gitignore` deixa de fora `node_modules`, `.next`, `.env*.local` e `.vercel`.

### Parte 2 — Vercel e Supabase

1. **Supabase**: criar o projeto e copiar a URL e a chave `anon` em *Project Settings > API*.
2. **Vercel**: importar o repositório `aruanmf446-hub/guiadositehoje`; o framework Next.js é detectado automaticamente.
3. Cadastrar em *Settings > Environment Variables* (Production e Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Fazer o deploy. Depois de criar as tabelas no Supabase, substituir os dados de `lib/data.ts` por consultas.

Observação: a data no topo da página é calculada no build. Sem um novo deploy, ela fica com a data do último build. Para atualizar todo dia, use um Deploy Hook da Vercel agendado ou busque os dados em tempo de requisição.
