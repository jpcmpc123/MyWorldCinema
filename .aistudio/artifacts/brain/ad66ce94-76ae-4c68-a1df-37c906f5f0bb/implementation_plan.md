# Abertura Instantânea de Detalhes (0ms), Busca Blindada e Restauração de Scroll ao Voltar

Este plano implementa a renderização imediata no primeiro frame (0ms) ao abrir filmes e séries a partir de qualquer pôster ou busca, blinda a busca contra condições de corrida com cache em memória instantâneo ao apagar/repetir termos e preserva tanto os dados quanto a posição exata de rolagem ao voltar da página de detalhes para a listagem anterior.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Trava de Regressão (Guardrail Crítico)**:
> - Os módulos de pôsteres, carrosséis mobile, cache de abas da Home e as regras CSS de 120Hz (`.poster-card-optimized` e `[data-h-scroll="true"]`) permanecem **100% intactos**.
> - Nenhuma alteração em cores, fontes, espaçamentos ou estrutura visual das páginas.

- **Decisão Confirmada 1 — Renderização 0ms na Página de Detalhes (`/film/:id` e `/tv/:id`)**: Inicializar o estado `movie` sincronamente com `cachedDetails` (se já visitado na sessão) ou com um objeto parcial derivado de `location.state.initialMovie` (quando `Number(initialMovie.id) === movieId`), liberando a renderização do cabeçalho, pôster, backdrop, nota, ano e sinopse imediatamente no frame zero sem tela de carregamento bloqueante enquanto `getMovieDetails` / `getTVDetails` completa elenco, vídeos e streaming em segundo plano.
- **Decisão Confirmada 2 — Transição Direta entre Filmes (`PUSH` de `/film/A` para `/film/B`)**: Ao clicar em um filme relacionado/similar dentro da própria página de detalhes (mudando de `movieId` via `PUSH`), a página rola imediatamente para o topo (`window.scrollTo(0, 0)`), passa `state={{ initialMovie: item, fromPoster: true }}` nos cards de coleção/similares e atualiza o estado `movie` sincronamente no mesmo ciclo de renderização com o novo `cachedDetails ?? initialPartialMovie`.
- **Decisão Confirmada 3 — Busca sem Race Conditions + Cache Instantâneo ao Apagar/Repetir**: Controlar todas as buscas por `latestRequestIdRef` + `AbortController` e manter um `Map` em memória de resultados por termo e aba (`idioma + filtro + termo`). Se o usuário apagar uma letra, alternar abas ou repetir um termo já consultado, o resultado aparece em 0ms (pulando inclusive o debounce de 300ms quando o termo já está no cache).
- **Decisão Confirmada 4 — Captura Protegida de `scrollY` e Restauração no Botão Voltar (`POP`)**: Registrar continuamente a posição de rolagem da rota ativa em um listener `scroll` (`{ passive: true }`) indexado por chave de rota (`pathname + search`) usando uma trava (`isNavigatingOrRestoringRef`) e ref da rota ativa atual para garantir que o `window.scrollTo(0, 0)` da nova página nunca sobrescreva o `scrollY` salvo da página anterior.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Detalhes em 0ms (inclusive de Filme A → Filme B)**: Ao tocar em qualquer pôster, resultado de busca ou card de filme similar/coleção, a página do filme/série abre já desenhada com capa, backdrop, título, ano, avaliação e sinopse usando `initialMovie`, rolando para o topo em navegações `PUSH`.
  2. **Busca Instantânea**: Digitações rápidas nunca exibem resultados atrasados de letras anteriores, e apagar caracteres ou repetir buscas exibe a lista imediatamente da memória RAM.
  3. **Navegação "Voltar" Nativa**: Voltar de um filme para a Home, Busca, Perfil de Ator ou Resultados de Filtro mantém a lista já carregada e restaura a altura exata da página onde o usuário estava.
- **Target Audience / Persona**: Usuários navegando rapidamente entre catálogos, buscas, filmografias de atores e páginas de filmes/séries no mobile e no desktop.
- **Key Value**: Sensação de aplicativo nativo com transição instantânea na ida e na volta, sem telas de loading repetitivas nem perda de posição na lista.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Toque no Pôster, Resultado de Busca ou Similar → Página do Filme (0ms)**:
     - Se o filme já foi aberto antes na sessão, 100% dos dados (incluindo elenco, coleção e similares) vêm do cache em memória em 0ms.
     - Se é a primeira abertura (ou clique em um filme similar de `/film/A` para `/film/B`), a página vai para o topo (`window.scrollTo(0, 0)`), exibe cabeçalho, backdrop, pôster, nota e sinopse imediatamente via `location.state.initialMovie`, e preenche elenco, equipe e provedores assim que a requisição em background conclui.
  2. **Digitação e Backspace na Busca**:
     - Ao digitar um termo inédito, o debounce de 300ms dispara a busca identificada por `requestId` e `AbortSignal`.
     - Ao apagar letras (voltando a um prefixo já buscado) ou revisitar a página de busca pelo botão Voltar, o cache em memória entrega a lista em 0ms sem piscar.
  3. **Botão Voltar (`←` ou Gesto Nativo)**:
     - Ao sair de `/film/:id` ou `/tv/:id` de volta para Home, Busca, Ator ou Browse Results, a página anterior já possui seus itens no estado inicial (via cache em memória) e restaura exatamente o `window.scrollY` salvo antes da saída.
- **Visual Identity & Theme**: Nenhuma mudança estética; toda a identidade visual Letterboxd Dark permanece inalterada.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Hidratação Progressiva via `initialMovie` + Suporte a `/film/A` → `/film/B`**
  - *Abordagem Escolhida*: Quando `movie?.id !== movieId` (troca de filme na mesma rota `/film/:id` ou `/tv/:id`), atualizar sincronamente `setMovie(cachedDetails ?? initialPartialMovie)`, `setLoading(!(cachedDetails || initialPartialMovie))` e `setAssetsReady(Boolean(cachedDetails || initialPartialMovie))`, além de executar `window.scrollTo(0, 0)` na transição `PUSH`. Nos carrosséis de "Filmes Relacionados" e "Filmes Semelhantes" dentro da própria página de detalhes, passar `state={{ initialMovie: item, fromPoster: true }}` para que clicar em um similar também seja 0ms.
  - *Por quê*: Garante que tanto a entrada vinda da Home/Busca quanto a navegação encadeada entre filmes similares abram no frame zero e no topo da página.
- **Decisão 2: Bypass de Debounce em Cache Hit na Busca**
  - *Abordagem Escolhida*: Quando o termo digitado (ou resultante de um Backspace) já existir no `Map` em memória para a aba ativa, atualizar `debouncedQuery` imediatamente em 0ms em vez de esperar 300ms.
  - *Por quê*: Ao apagar letras ou clicar num termo recente, o usuário percebe resposta instantânea sem tráfego de rede.
- **Decisão 3: Captura Blindada de `scrollY` com Listener Passivo e Lock de Transição**
  - *Abordagem Escolhida*: Manter um listener `window.addEventListener('scroll', ..., { passive: true })` que grava `routeScrollMap.set(activeRouteKeyRef.current, window.scrollY)` somente quando `location.pathname + location.search === activeRouteKeyRef.current` e `!isTransitioningRouteRef.current`. Antes de aplicar `window.scrollTo(0, 0)` para a nova rota `PUSH`, travamos a gravação e atualizamos `activeRouteKeyRef.current` para a nova rota, impedindo que o `scrollY = 0` da nova página sobrescreva o valor salvo da página anterior.
  - *Por quê*: Elimina o bug clássico em que o evento `scroll` disparado por `window.scrollTo(0, 0)` durante a troca de rota zera o `scrollY` salvo da listagem anterior.

---

## 4. Technical Architecture & Data Strategy

### Arquitetura de Navegação Instantânea, Busca e Restauração

```
┌────────────────────────────────────────────────────────────────────────────┐
│            ORIGEM: PosterCard / Search / Actor / Browse / Similar          │
│         Passa state={{ initialMovie, fromPoster: true }} no <Link>         │
│    Listener passivo grava scrollY da rota ativa (protegido contra 0)       │
└───────────────────┬────────────────────────────────────────▲───────────────┘
                    │ Clique (PUSH -> scrollTo(0,0))         │ Voltar (POP)
                    ▼                                        │ (0ms + ScrollY)
┌───────────────────────────────────────────┐                │
│     PÁGINA DE DETALHES (/film | /tv)      │                │
│  1. Frame 0 (0ms):                        │                │
│     • Usa cachedDetails (se existir)      │                │
│     • Ou hidrata de state.initialMovie    │────────────────┘
│     • De /film/A -> /film/B: scrollTo(0,0)│
│       + hidrata novo initialMovie na hora │
│  2. Background Fetch:                     │
│     • getMovieDetails / getTVDetails      │
│     • Salva em mediaDetailsCache (30 min) │
│     • Atualiza elenco, vídeos e streaming │
└───────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                     PIPELINE DE BUSCA BLINDADO (/search)                   │
├────────────────────────────────────────────────────────────────────────────┤
│  Input (?q=) ──► Cache Hit no Map<string, PanelCacheEntry>?                │
│                    ├─► SIM: Bypass debounce (0ms) -> Renderiza imediato    │
│                    └─► NÃO: Debounce 300ms -> Incrementa latestRequestId   │
│                             + AbortController.abort() da anterior          │
│                             -> Salva no Map se reqId === latestRequestId   │
└────────────────────────────────────────────────────────────────────────────┘
```

### Detalhamento Técnico

1. **Abertura Instantânea na Página de Detalhes (Incluindo `/film/A` → `/film/B`)**:
   - Criar helper `buildInitialMovieDetails(initial, movieId)` que converte `location.state?.initialMovie` (quando `Number(initial.id) === movieId`) em um `TMDBMovieDetails` parcial válido.
   - Inicializar `movie` com `cachedDetails ?? initialPartialMovie`, `loading` com `!(cachedDetails || initialPartialMovie)` e `assetsReady` com `Boolean(cachedDetails || initialPartialMovie)`.
   - Quando `movie?.id !== movieId` (ex.: usuário clicou em um filme similar/recomendado indo de `/film/A` para `/film/B`), atualizar sincronamente `movie` com `cachedDetails ?? initialPartialMovie`, rolar para o topo (`window.scrollTo(0, 0)`) e buscar os detalhes completos em background sem limpar a tela para um spinner.
   - Adicionar `state={{ initialMovie: item, fromPoster: true }}` nos links de filmes relacionados/similares da página de detalhes, nas linhas de busca (`ResultRow` e `MobileMovieRow`) e nos dropdowns rápidos ("Find a film/series").
   - Expandir o cache em memória de `getMovieDetails`, `getTVDetails`, `getPersonDetails` e `getCollectionDetails` no serviço TMDB para 30 minutos de TTL.

2. **Busca Instantânea e Blindada contra Race Conditions**:
   - Criar cache em nível de módulo `searchMemoryCache = new Map<string, PanelCacheEntry>()` indexado por `${language}:${filter}:${term.toLowerCase()}` e cache de enriquecimento `searchEnrichCache` no serviço TMDB.
   - Adicionar `latestRequestIdRef` e `AbortController` na busca principal, no `prefetchFilter` de abas vizinhas e nas barras rápidas de busca de Filmes/Séries, descartando qualquer resposta cujo `requestId !== latestRequestIdRef.current`.
   - Inicializar o estado da página de busca já hidratado a partir de `searchMemoryCache` quando o usuário voltar da página de um filme ou repetir uma busca recente.

3. **Captura Protegida de `scrollY` e Restauração ao Voltar (Back Navigation)**:
   - No `AppShell`, manter `routeScrollPositions = new Map<string, number>()` com listener `scroll` passivo associado à chave da rota comprometida (`committedRouteKeyRef.current`) e bloqueio `isProgrammaticScrollRef.current` durante a troca de rotas, garantindo que o `window.scrollTo(0, 0)` da nova página nunca sobrescreva o `scrollY` salvo da rota que está saindo.
   - Ao detectar retorno (`navigationType === 'POP'`), restaurar o `scrollY` salvo em `useLayoutEffect` (e confirmar no próximo `requestAnimationFrame`) em vez de chamar `window.scrollTo(0, 0)`.
   - Nas páginas de listagem (`BrowseResults`, `Actor`, `Collection`, `Films`, `Series`), manter cache em memória dos itens carregados (`items`, `page`, `hasMore`, `person`, `collection`) por chave de rota/parâmetros e preservar o scroll salvo quando os dados vierem do cache no retorno.
