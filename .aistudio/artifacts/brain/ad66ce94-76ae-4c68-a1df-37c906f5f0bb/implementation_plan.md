# Eliminação de Head-of-Line Blocking e Fila Escalonada de Pôsteres

Este plano elimina a contenção de rede (Head-of-Line Blocking) no carregamento inicial da Home, garantindo que os 8 pôsteres visíveis na primeira dobra recebam 100% da largura de banda com `fetchPriority="high"`, sem requisições duplicadas entre `new Image()` e `<img />`, enquanto a vizinhança imediata dos carrosséis é pré-carregada em cascata (2 ondas) e o restante sob demanda via `IntersectionObserver`.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Trava de Regressão Visual e Estrutural**:
> - Nenhuma alteração em cores, tipografia, larguras de itens (`ITEM_W`), `aspect-[2/3]`, espaçamentos ou animações CSS (`.poster-card-optimized` e `[data-h-scroll="true"]`).
> - Proibido adicionar `content-visibility: auto` ou `contain-intrinsic-size` nos cards de pôsteres.
> - Mantido o fade-in suave de 300ms (`transition-opacity duration-300 ease-out`) e exibição em 0ms para imagens em cache (`complete` + `Set` em memória).

- **Decisão Confirmada 1 — Prioridade Estrita na Primeira Dobra**: Nos carrosséis mobile, apenas os 4 primeiros itens das 2 primeiras seções (`sectionIndex < 2 && idx < 4`, totalizando 8 pôsteres) recebem `priority={true}` (`fetchPriority="high"`), e apenas a vizinhança imediata (`sectionIndex < 2 ? idx < 6 : sectionIndex === 2 && idx < 4`) recebe `eager={true}`.
- **Decisão Confirmada 2 — Unificação de `primarySrc` e `preloadPoster` sem Disparo Duplo**: Tanto `preloadPoster` quanto `primarySrc` do `PosterCard` passam a apontar diretamente para a resolução física calculada por `getOptimalPosterSize(isLarge)`. Além disso, removemos chamadas redundantes a `preloadPoster` dentro do `useEffect` e do `IntersectionObserver` do `PosterCard`, deixando a própria tag `<img loading="eager" />` conduzir o download único no DOM.
- **Decisão Confirmada 3 — Aquecimento Centralizado em 2 Ondas**: Removemos a duplicação de `warmUpVisiblePosters` na Home e centralizamos o aquecimento em `prewarmHubPosters` dividido em Onda 1 (imediata para os 8 pôsteres visíveis) e Onda 2 (após `250ms` + `requestIdleCallback` para a vizinhança dos carrosséis).

---

## 1. Overview & Core Concept

- **What It Does**: Reserva toda a prioridade de rede do navegador no instante zero para os 8 pôsteres visíveis na primeira dobra e escalona o pré-carregamento dos itens adjacentes dos carrosséis em segundo plano quando a thread/rede estiver livre.
- **Target Audience / Persona**: Usuários mobile e desktop navegando pelas vitrines de Filmes e Séries.
- **Key Value**: Renderização quase instantânea dos 8 pôsteres principais sem fila de espera causada por dezenas de downloads concorrentes fora da tela.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Abertura da Home (0ms–150ms)**: Os 8 pôsteres visíveis de "Populares da semana" e "Mais bem avaliados" baixam imediatamente com `fetchPriority="high"`, sem concorrer com os outros 64 pôsteres fora da tela.
  2. **Pausa Curta Pós-Pintura (250ms + Idle)**: A Onda 2 aquece silenciosamente em background os próximos pôsteres dos carrosséis (`idx 4..9` das duas primeiras seções e `idx 0..5` da 3ª e 4ª seções).
  3. **Deslize Horizontal ou Vertical**: Conforme o usuário rola o carrossel além do 10º item, o `IntersectionObserver` (`rootMargin: '400px 200px'`) ativa `nearViewport = true` com desconexão imediata (`observer.disconnect()`), mudando a `<img />` para `loading="eager"` antes que o card entre na área visível.
- **Visual Identity & Theme**: Preservação integral da estética escura (`#14181c`, `#232a31`) e das curvas de animação a 120Hz.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: `primarySrc` Dinâmico Alinhado a `getOptimalPosterSize(isLarge)`**
  - *Abordagem Escolhida*: Definir `const optimalSize = getOptimalPosterSize(isLarge)` e `const primarySrc = optimalSize === 'w342' ? urlW342 : optimalSize === 'w780' ? urlW780 : urlW500`, enquanto `preloadPoster` delega diretamente para `preloadImageUrl(tmdb.getImageUrl(posterPath, targetSize))`.
  - *Por quê*: Garante que o atributo `src`, a seleção do `srcSet` e o `new Image()` do preloader apontem exatamente para a mesma URL (ex.: `w342` em telas mobile DPR 3x), eliminando qualquer divergência ou sintaxe desnecessária de `srcset` no `new Image()`.
- **Decisão 2: Fim do Disparo Duplo entre `preloadPoster` e `<img loading="eager" />`**
  - *Abordagem Escolhida*: No `PosterCard`, remover `preloadPoster(...)` de dentro do `useEffect` de montagem e de dentro do callback do `IntersectionObserver`. Quando `priority`, `eager` ou `nearViewport` for verdadeiro, a própria tag `<img loading="eager" />` realiza a requisição e alimenta o `Set` em memória no `onLoad`.
  - *Por quê*: Evita instanciar um `new Image()` no mesmo milissegundo em que a tag `<img />` do DOM já iniciou a requisição.
- **Decisão 3: Fila Escalonada em 2 Ondas Centralizada no Serviço de Cache**
  - *Abordagem Escolhida*: Remover `warmUpVisiblePosters` da página inicial e centralizar em `prewarmHubPosters`:
    - **Onda 1 (Síncrona)**: `popular.slice(0, 4)` e `highestRated.slice(0, 4)` (8 pôsteres da primeira dobra).
    - **Onda 2 (`setTimeout(..., 250)` + `requestIdleCallback`)**: `popular.slice(4, 10)`, `highestRated.slice(4, 10)`, `mostWatched.slice(0, 6)` e `mostAnticipated.slice(0, 6)`.
  - *Por quê*: Elimina a tempestade de 72 requisições simultâneas no segundo zero e mantém a vizinhança imediata dos carrosséis pronta no cache em memória.

---

## 4. Technical Architecture & Data Strategy

### Fluxo de Priorização e Carregamento em Cascata

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     CARREGAMENTO DA HOME / VITRINES                      │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
┌─────────────────────────────────┐             ┌─────────────────────────────────┐
│     ONDA 1 (0ms - Imediata)     │             │  ONDA 2 (250ms + IdleCallback)  │
│  • popular.slice(0, 4)          │             │  • popular.slice(4, 10)         │
│  • highestRated.slice(0, 4)     │             │  • highestRated.slice(4, 10)    │
│  • DOM: priority={true}         │             │  • mostWatched.slice(0, 6)      │
│    loading="eager"              │             │  • mostAnticipated.slice(0, 6)  │
│    fetchPriority="high"         │             │  • Notifica cards via Pub/Sub   │
└─────────────────────────────────┘             └─────────────────────────────────┘
                                                                 │
                                                                 ▼
                                                ┌─────────────────────────────────┐
                                                │   ONDA 3 (Scroll Sob Demanda)   │
                                                │  • Itens idx >= 6 / idx >= 10   │
                                                │  • IntersectionObserver         │
                                                │    rootMargin: "400px 200px"    │
                                                │  • observer.disconnect() 1-shot │
                                                │  • setNearViewport(true)        │
                                                │    -> <img loading="eager" />   │
                                                └─────────────────────────────────┘
```

### Detalhamento por Módulo

1. **Seções de Catálogo Mobile (`MobileCatalogSections`)**:
   - No `PosterRail`, configurar:
     - `priority={sectionIndex < 2 && idx < 4}`
     - `eager={sectionIndex < 2 ? idx < 6 : sectionIndex === 2 && idx < 4}`
2. **Componente de Pôster e Preloader (`PosterCard`)**:
   - Simplificar `preloadPoster(posterPath, size, isLarge)` para resolver `const targetSize = size || getOptimalPosterSize(isLarge)` e chamar `preloadImageUrl(tmdb.getImageUrl(posterPath, targetSize))`.
   - Em `PosterCardBase`, definir `const optimalSize = getOptimalPosterSize(isLarge)` e `const primarySrc = optimalSize === 'w342' ? urlW342 : optimalSize === 'w780' ? urlW780 : urlW500`.
   - No `useEffect` de assinatura do cache, remover `if (priority || eager || nearViewport) { preloadPoster(...); }` e inscrever o listener `subscribePosterUrlLoaded` para que cards pré-carregados pela Onda 2 mudem imediatamente para `isLoaded = true`.
   - No `IntersectionObserver`, manter apenas `observer.disconnect()` e `setNearViewport(true)` ao interceptar `rootMargin: '400px 200px'`.
3. **Serviço de Cache de Abas e Home (`tabDataCache` & `HomePage`)**:
   - Em `HomePage` (e páginas de hub), remover `warmUpVisiblePosters` duplicado e acionar `prewarmHubPosters` centralizado quando houver cache inicial ou após `setFilmsHub`.
   - Em `prewarmHubPosters`, executar a Onda 1 imediatamente nos 4 primeiros itens de `popular` e `highestRated`, e agendar a Onda 2 após `250ms` + `requestIdleCallback` para `slice(4, 10)` das duas primeiras listas e `slice(0, 6)` de `mostWatched` e `mostAnticipated`.
