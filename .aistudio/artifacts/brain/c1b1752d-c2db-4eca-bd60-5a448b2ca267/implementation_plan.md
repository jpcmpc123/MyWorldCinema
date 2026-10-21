# Plano de Implementação: Carregamento Completo Instantâneo e Animação de Slide Suave (340ms)

## 1. Diagnóstico do Problema Atual

1. **Por que a tela de detalhes abria incompleta ("Cast information is not available.", sem diretor, sem duração e sem imagem de fundo):**
   - Na chamada `getMovieDetails` / `getTVDetails` (`src/services/tmdb.ts`), o parâmetro `append_to_response` estava requisitando `images` com `include_image_language: 'en,null,pt,ko,ja,fr,es'` junto com 10 sub-requisições. Para filmes grandes (como *The Avengers*), isso infla a resposta JSON com centenas de imagens (~500 KB+) e faz a requisição demorar vários segundos ou sofrer timeout no 4G.
   - Além disso, `curateSimilarForDetails` fazia um `await fetchTMDB('/collection/...')` sequencial bloqueando o retorno dos detalhes do filme, e `TabViewPager.tsx` montava todas as abas (`HomePage` e `SeriesHubPage`) ao mesmo tempo na inicialização, disparando mais de 10 requisições simultâneas que disputavam banda com a abertura do filme.
   - Quando a requisição demorava ou falhava, o bloco `catch` de `FilmPage.tsx` exibia o `previewMovie` incompleto (vindo da lista de busca/catálogo, que não possui `credits`, `runtime`, `director` nem `backdrop_path`).

2. **Por que a animação de abertura não aparecia com slide suave:**
   - `src/pages/FilmPage.tsx` aplicava a classe `mw-slide-in-left`, mas o arquivo `src/index.css` só definia `.mw-slide-in-right` (com `260ms`) e não possuía `.mw-slide-in-left`. Como resultado, a página abria sem transição (`0ms`, corte seco).

---

## 2. Alterações Propostas

### A. Animação de Slide Suave de 340ms da Direita para a Esquerda (`src/index.css` e `src/pages/FilmPage.tsx`)
- Definir `@keyframes mwSlideFromRight` (`translate3d(100%, 0, 0)` $\rightarrow$ `translate3d(0, 0, 0)`) com duração de **`340ms`** e curva suave `cubic-bezier(0.22, 1, 0.36, 1)` tanto para `.mw-slide-in-left` quanto para `.mw-slide-in-right`.
- Garantir que o container da tela de detalhes (`FilmPage.tsx`) execute essa animação assim que os dados completos do filme/série forem exibidos.

### B. Otimização da Requisição e Garantia de Dados Completos (`src/services/tmdb.ts`)
- **Payload enxuto e rápido (~15–25 KB):** Remover `images` e `include_image_language` da chamada principal de `getMovieDetails` e `getTVDetails`, mantendo apenas os dados essenciais para a tela (`credits,videos,release_dates,watch/providers,recommendations,similar,external_ids` para filmes e `credits,aggregate_credits,videos,content_ratings,watch/providers,recommendations,similar,external_ids` para séries).
- **Zero bloqueio sequencial em coleções:** Não bloquear o retorno de `getMovieDetails` aguardando `/collection/{id}` se a franquia não estiver em cache; classificar imediatamente as recomendações e similares já incluídos na resposta principal e buscar a coleção em segundo plano apenas para cache.
- **Fallback de segurança com elenco e duração completos:** Caso a requisição principal com todos os anexos sofra qualquer instabilidade de rede, fazer fallback imediato para `/movie/{id}?append_to_response=credits,videos,release_dates,similar` (com tentativa em `en-US` se necessário), garantindo que `credits` (elenco e diretor), `runtime` e `backdrop_path` venham sempre preenchidos.

### C. Aguardar Dados Completos Antes de Exibir a Tela (`src/pages/FilmPage.tsx`)
- Remover o fallback que fazia `setMovie(previewMovie)` com dados incompletos.
- Manter o indicador de carregamento até que o objeto completo (com elenco, diretor, duração, classificação e backdrop) esteja pronto, exibindo a tela completa de uma só vez com o deslize suave de `340ms`.
- Adicionar pré-carregamento (`prefetchMovieDetails` / `prefetchTVDetails`) no evento `onPointerDown` / `onTouchStart` nas linhas de busca (`SearchPage.tsx`), nos cards de pôster (`PosterCard.tsx`) e na filmografia do ator (`ActorTabPanel.tsx`), para que o download dos dados comece no exato milissegundo em que o dedo toca no filme.

### D. Prioridade de Rede para a Aba Ativa (`src/components/TabViewPager.tsx`)
- Montar inicialmente apenas a aba ativa (`mounted: PANELS.map((_, i) => i === activeIndex)`), evitando que a aba de Séries dispare dezenas de requisições em segundo plano enquanto o usuário está navegando ou pesquisando filmes.
