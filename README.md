# MyWorld Cinema

Plataforma social de descoberta, diário, críticas e listas de filmes e séries, construída com **React 19**, **TypeScript**, **Vite**, **Tailwind CSS 4**, **Supabase** e **Capacitor (Android)**.

- **Repositório:** [github.com/jpcmpc123/MyWorldCinema](https://github.com/jpcmpc123/MyWorldCinema)

## Funcionalidades

- **Catálogo de Filmes e Séries:** Descoberta por popularidade, avaliação, década, ano, gênero, país, idioma e serviço de streaming (via TMDb API).
- **Diário e Críticas (`/diary` e `/reviews`):** Registro cronológico de sessões, avaliações de 0,5 a 5 estrelas, curtidas, alertas de spoiler e página dedicada de críticas.
- **Nota Unificada:** Agregação ponderada de notas (Letterboxd, IMDb, Rotten Tomatoes, Metacritic e TMDb) via MDBList / OMDb com cache persistente.
- **CINE IA (`/cine-ia`):** Recomendação em 7 dimensões (gênero, clima, época, origem, ritmo, contexto) e modo *Adivinhar Filme* com fallback local integrado.
- **Listas e Watchlist:** Criação de listas ranqueadas ou temáticas, importação/exportação de dados em CSV (compatível com Letterboxd) e sorteio de títulos na Watchlist.
- **Sincronização em Nuvem (Supabase):** Autenticação por e-mail/senha (com recuperação de senha) e Google OAuth, Row-Level Security (RLS) e avatares personalizados.
- **Web, PWA & Android (Capacitor):** Suporte a gestos nativos (ViewPager com indicador elástico, Pull-to-Refresh) e empacotamento Android.

## Configuração Local

1. Clone o repositório e instale as dependências:
   ```bash
   bun install
   # ou: npm install
   ```

2. Copie `.env.example` para `.env` e preencha suas chaves:
   ```bash
   cp .env.example .env
   ```
   Variáveis utilizadas:
   - `VITE_TMDB_API_KEY` e `VITE_TMDB_ACCESS_TOKEN` (obrigatórias para catálogo TMDb)
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (para autenticação e banco na nuvem)
   - `VITE_MDBLIST_API_KEY` e `VITE_OMDB_API_KEY` (opcionais, para enriquecer a Nota Unificada)

3. No Supabase, execute os scripts em `supabase/schema.sql`, `supabase/migration_settings.sql`, `supabase/migration_film_overrides.sql` e `supabase/migration_storage_avatars.sql`.

4. Inicie o servidor de desenvolvimento:
   ```bash
   bun run dev
   ```

## Scripts

- `bun run dev` — Servidor de desenvolvimento na porta `3000`
- `bun run build` — Checagem de tipos (`tsc -b`) e build de produção (`vite build`)
- `bun run lint` — Validação estática com `oxlint`

## Atribuição

Dados de filmes e séries fornecidos por [TMDb](https://www.themoviedb.org/). Este produto utiliza a API do TMDb, mas não é endossado nem certificado pelo TMDb.
