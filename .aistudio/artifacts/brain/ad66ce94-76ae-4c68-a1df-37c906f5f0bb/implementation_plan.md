# Correção de Carregamento Instantâneo nos Carrosséis e Abas

Este plano corrige o atraso de carregamento nas abas e carrosséis horizontais para que todos os pôsteres já estejam prontos e visíveis (`opacity-100`, sem tela cinza ou fade tardio) no momento em que o usuário desliza o carrossel ou troca de aba.

### User Review & Critical Decisions

> [!IMPORTANT]
> Identificamos a causa exata pela qual os pôsteres dos carrosséis e da aba vizinha ainda apareciam carregando ao deslizar:

- **Causa 1 — `loading="lazy"` em itens fora da dobra horizontal (`idx >= 8` e seções 3 e 4)**: Ao restringir `eager` apenas aos primeiros 8 cards das 2 primeiras seções em `MobileCatalogSections`, o navegador passou a bloquear o carregamento dos demais pôsteres do carrossel e da aba lateral (`TabViewPager`) até o instante em que o usuário arrastava o dedo.
  - **Correção**: Restaurar `eager` (`loading="eager"`) em todos os cards dos carrosséis do `MobileCatalogSections` (mantendo `fetchPriority="high"` nos primeiros cards visíveis para que a primeira dobra tenha prioridade máxima na fila de rede, mas sem travar o restante dos carrosséis em `lazy`).
- **Causa 2 — Sincronização entre `preloadPoster` em Background e `PosterCard` Montado**: Quando `preloadPoster` termina de baixar a imagem via `new Image()`, um `PosterCard` que esteja montado em uma aba colapsada/lateral pode ainda estar com `isLoaded = false` caso o navegador adie o evento `onLoad` de elementos fora da tela.
  - **Correção**: Adicionar notificação direta no `markPosterUrlLoaded` para que qualquer `PosterCard` montado mude instantaneamente para `isLoaded = true` assim que o `preloadPoster` concluir o download em segundo plano, além de pré-aquecer todos os 18 pôsteres de cada carrossel da Home e de Séries.

---

### 1. Overview & Core Concept

- **O Que Faz**: Garante que tanto a rolagem horizontal dos carrosséis quanto o deslize lateral entre as abas (Filmes ↔ Séries) exibam os pôsteres já carregados instantaneamente, sem placeholders carregando durante o gesto.
- **Valor Principal**: Experiência nativa de 120Hz onde os carrosséis e abas vizinhas já estão 100% aquecidos na GPU e em memória antes do movimento do usuário.

---

### 2. User Experience & Visual Design

- **Fluxo de Experiência**:
  1. **Primeira Dobra**: Os 6 primeiros cards das seções iniciais recebem `priority={true}` (`fetchPriority="high"` + `loading="eager"`), pintando primeiro na tela.
  2. **Carrosséis Horizontais e Aba de Séries**: Todos os 18 cards de cada um dos 4 carrosséis possuem `eager={true}` (`loading="eager"`, `fetchPriority="auto"`) e são pré-aquecidos em segundo plano logo após o fetch da API.
  3. **Sincronização Instantânea de Estado (`isLoaded`)**: Assim que uma URL termina de baixar no `preloadPoster` ou no `<img />`, todos os `PosterCard` correspondentes (inclusive os que estão na aba ao lado ou mais à direita no carrossel) recebem `isLoaded = true` imediatamente, aparecendo prontos sem piscar quando o usuário rola.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisão 1: `eager={true}` em Todos os Cards de Carrossel + `priority` Seletivo nos Primeiros**
  - *Abordagem Escolhida*: Usar `fetchPriority="high"` apenas nos primeiros cards visíveis da tela, mas manter `loading="eager"` em todos os itens dos carrosséis horizontais (`MobileCatalogSections`) e do modal de carrossel (`PosterCarouselModal`).
  - *Por Quê*: Navegadores mobile não disparam `loading="lazy"` nem `IntersectionObserver` de viewport para itens deslocados horizontalmente (`translate3d(100%, 0, 0)` na aba vizinha ou `overflow-x-auto` no carrossel). Com `loading="eager"` + `fetchPriority="auto"`, o navegador baixa os primeiros cards com prioridade máxima e, logo em seguida, já carrega o restante do carrossel sem esperar o usuário tocar na tela.
- **Decisão 2: Pub/Sub Leve em `markPosterUrlLoaded`**
  - *Abordagem Escolhida*: Notificar os componentes `PosterCard` montados assim que sua URL entra em `loadedPosterUrls`.
  - *Por Quê*: Mesmo que uma aba esteja oculta (`visibility: hidden`), quando o `preloadPoster` concluir em background, o `PosterCard` já marca `isLoaded = true` na hora.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌──────────────────────────────────────────────────────────────────────────┐
│                 Fetch / Cache de Filmes e Séries (Hubs)                  │
│   └── prewarmHubPosters(hub, 18) aquece todos os pôsteres dos carrosséis │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                markPosterUrlLoaded(url) + Notificador Leve               │
│   • Adiciona URL ao Set loadedPosterUrls                                 │
│   • Notifica PosterCards montados (mesmo em abas ocultas/laterais)       │
│     para mudarem isLoaded -> true imediatamente (0ms, sem fade tardio)   │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│      MobileCatalogSections / SeriesHub / FilmsHub / PosterCarousel       │
│   • Cards 0..5 das seções iniciais: priority=true (fetchPriority="high") │
│   • Todos os cards dos carrosséis: eager=true (loading="eager")          │
│   • Ao arrastar o carrossel ou trocar de aba: imagens 100% prontas       │
└──────────────────────────────────────────────────────────────────────────┘
```
