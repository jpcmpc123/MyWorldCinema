# Otimização Ultra-Veloz de Pôsteres e Imagens TMDB

Este plano detalha a arquitetura de rede, escalonamento responsivo Retina (`srcSet`/`sizes`) e pré-carregamento preditivo para que os pôsteres e imagens do TMDB apareçam quase instantaneamente no mobile e no desktop, mantendo intactos o layout, as proporções `2:3` e as curvas de fluidez de 120Hz.

### User Review & Critical Decisions

> [!IMPORTANT]
> O plano foi atualizado com os dois refinamentos técnicos de precisão de cache e performance de scroll a 120Hz. Basta clicar em **Proceed** para executarmos todas as alterações no código.

- **Cache Hit 100% no `preloadPoster` (Confirmado)**: Como `26vw` em uma tela de `390px` com DPR 3x resulta em `~304px` físicos (`<= 342w`), o navegador seleciona `w342` no `srcSet` mesmo em telas Retina 3x. O `preloadPoster` usará a mesma fórmula de largura física (`vw * 0.26 * dpr <= 342 ? 'w342' : 'w500'`) e também atribuirá `img.sizes` e `img.srcset` diretamente na instância `new Image()`, garantindo 100% de aproveitamento do cache HTTP/memória sem downloads duplicados.
- **Desconexão Imediata do `IntersectionObserver` (Confirmado)**: Assim que um card abaixo da dobra entrar na margem de `rootMargin: "400px 200px"` e acionar o carregamento, o observador executará `observer.disconnect()` / `observer.unobserve()` imediatamente (one-shot), mantendo o custo de CPU e memória em zero durante o scroll a 120Hz.
- **Trava de Regressão Visual e de Layout (Confirmado)**: Nenhuma regra `content-visibility: auto` ou `contain-intrinsic-size` será aplicada aos cards de pôsteres, preservando a altura compacta dos carrosséis, as proporções `aspect-[2/3]`, as cores, a tipografia e o fade-in suave de `300ms ease-out` com detecção síncrona de cache em memória (`complete` + `Set`).
- **Calibração de `srcSet` (`w342`, `w500`, `w780`) e `sizes` Reais (Confirmado)**: Substituição de larguras fixas superestimadas no atributo `sizes` pelas dimensões reais ocupadas na viewport (`(max-width: 640px) 26vw, (max-width: 1024px) 18vw, 185px` em grades/carrosséis padrão e `(max-width: 768px) 45vw, 300px` em destaques).

---

### 1. Overview & Core Concept

- **O Que Faz**: Elimina a latência perceptível no carregamento de capas de filmes e séries em carrosséis horizontais, grades de navegação e aberturas da tela de detalhes.
- **Público e Contexto**: Usuários navegando em telas mobile (OLED/Retina 2x e 3x) com rolagem rápida entre abas e carrosséis, bem como usuários no desktop explorando grades densas de catálogo.
- **Valor Principal**: Redução drástica do tempo até o primeiro frame pintado (LCP/FCP de imagens) por meio de conexões TLS antecipadas, seleção exata de resolução no CDN do TMDB e busca preditiva com 100% de cache hit antes da conclusão do clique ou scroll.

---

### 2. User Experience & Visual Design

- **Fluxo de Experiência do Usuário**:
  1. **Abertura Inicial (Primeira Dobra)**: O navegador já possui o handshake TCP/TLS concluído com `image.tmdb.org` e `api.themoviedb.org`. Os primeiros 6 a 8 pôsteres visíveis de "Populares da semana" e "Mais bem avaliados" iniciam o download imediatamente com `loading="eager"`, e os 4 primeiros de maior destaque recebem `fetchPriority="high"`.
  2. **Rolagem Vertical e Horizontal Antecipada (One-Shot)**: À medida que o usuário desliza a página ou um carrossel, o `IntersectionObserver` com margem expandida (`rootMargin: "400px 200px"`) promove o card para carregamento ativo antes que entre na área visível e se desconecta imediatamente (`observer.disconnect()`), sem qualquer overhead em rolagem a 120Hz.
  3. **Toque ou Hover Preditivo**: No instante em que o dedo encosta (`onPointerDown`) ou o cursor entra (`onMouseEnter`) em um pôster, o utilitário de preload inicia em segundo plano (uma única vez por filme) o download da imagem exata de detalhe (`w342` no mobile / `w500` no desktop) e do backdrop em alta definição (`w1280`), garantindo abertura instantânea ao confirmar a navegação.
- **Identidade Visual & Tema (Inalterados)**:
  - *Estética e Paleta*: Mantém integralmente a paleta escura estilo Letterboxd (`#14181c`, `#1c2228`, `#232a31`, `#00e054`, `#99aabb`) e os placeholders tipográficos discretos no mobile enquanto a imagem vem da rede.
  - *Movimento e Feedback*: Preserva o fade-in de `300ms ease-out` para novas imagens da rede e a exibição em `0ms` (sem transição e sem flash) para imagens já presentes no `Set` em memória ou no cache do navegador (`img.complete && img.naturalWidth > 0`).

---

### 3. Key Product Decisions & Trade-Offs

- **Decisão 1: `srcSet` de 3 Degraus (`342w`, `500w`, `780w`) + `preloadPoster` Sincronizado por Largura Física**
  - *Abordagem Escolhida*: Fornecer `w342 342w, w500 500w, w780 780w` com `src` base em `w500` e `sizes="(max-width: 640px) 26vw, (max-width: 1024px) 18vw, 185px"` (ou `(max-width: 768px) 45vw, 300px` em cards `lg`). No `preloadPoster`, calcular a largura física (`(vw <= 640 ? vw * 0.26 : vw <= 1024 ? vw * 0.18 : 185) * dpr <= 342 ? 'w342' : 'w500'`) e também configurar `img.sizes` e `img.srcset` na instância `new Image()`.
  - *Por Quê*: Em telas de `390px` com DPR 3x, `26vw` equivale a `~101.4px` CSS (`~304px` físicos `<= 342w`). Dessa forma, tanto o `new Image()` de pré-aquecimento quanto o `<img srcSet>` do DOM requisitam exatamente o arquivo `w342` (~28 KB), evitando o download em duplicidade de `w500` e garantindo Cache Hit de 100%.
- **Decisão 2: Desconexão Imediata do `IntersectionObserver` (`rootMargin: "400px 200px"`)**
  - *Abordagem Escolhida*: Quando um card abaixo da dobra intersecta a margem de `400px` (vertical) por `200px` (horizontal), o callback ativa o estado de carregamento imediato e chama `observer.disconnect()` na mesma instrução.
  - *Por Quê*: Uma vez que a imagem começou a carregar, o card nunca mais precisa ser observado. Desconectar na hora elimina callbacks de interseção durante o scroll contínuo em telas de 120Hz.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

#### Arquitetura do Pipeline de Imagens

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     HTML Head (Preconnect & DNS-Prefetch)                │
│         https://image.tmdb.org (TLS/DNS) • https://api.themoviedb.org    │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                Fetch das Vitrines (Home / Filmes / Séries)               │
│   Assim que os dados chegam da API ou do Cache:                          │
│   └── Warm-up Assíncrono (requestIdleCallback / setTimeout 50ms)         │
│       └── preloadPoster(poster_path) com img.sizes + img.srcset          │
│            e cálculo (26vw * dpr <= 342 ? 'w342' : 'w500') -> 100% Hit    │
└──────────────────┬───────────────────────────────────┬───────────────────┘
                   │                                   │
                   ▼                                   ▼
┌─────────────────────────────────────┐ ┌──────────────────────────────────┐
│   Primeira Dobra (Above the Fold)   │ │   Abaixo da Dobra / Carrosséis   │
│ • Primeiros 6–8 cards:              │ │ • IntersectionObserver           │
│   loading="eager"                   │ │   rootMargin: "400px 200px"      │
│ • Primeiros 4 cards:                │ │ • Ao intersectar: ativa load +   │
│   fetchPriority="high"              │ │   observer.disconnect() imediato │
└──────────────────┬──────────────────┘ └──────────────┬───────────────────┘
                   │                                   │
                   └─────────────────┬─────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     PosterCard (React.memo + Cache Set)                  │
│ • src=".../w500"                                                         │
│ • srcSet=".../w342 342w, .../w500 500w, .../w780 780w"                   │
│ • sizes="(max-width: 640px) 26vw, (max-width: 1024px) 18vw, 185px"       │
│ • onPointerDown / onMouseEnter (1x por filme via ref):                   │
│   └── preloadPoster(poster_path, detalhe) + preloadSingleImage(backdrop) │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Mapeamento Interativo e de Estado

1. **Conexões Antecipadas no Head**:
   - Configurar `<link rel="preconnect" ... crossorigin />` e `<link rel="dns-prefetch" ... />` para `https://image.tmdb.org` e `https://api.themoviedb.org`.
2. **Utilitários Globais `preloadImageUrl` e `preloadPoster` com Cache Hit 100%**:
   - `preloadImageUrl(url)`: controlado por `Set<string>` para nunca duplicar chamadas, com `img.decoding = 'async'` e marcação automática no `loadedPosterUrls` ao concluir.
   - `preloadPoster(posterPath, explicitSize?)`: calcula a largura física exata do card (`vw * 0.26 * dpr <= 342 ? 'w342' : 'w500'`) quando o tamanho não é forçado, e configura `img.sizes` e `img.srcset` idênticos ao `PosterCard` na instância `new Image()`, registrando `currentSrc` e `src` em `loadedPosterUrls` no `onload`.
3. **Observador One-Shot (`rootMargin: "400px 200px"`) e Preload no Toque/Hover**:
   - Cards abaixo da dobra iniciam um `IntersectionObserver` com `rootMargin: "400px 200px"`. No primeiro callback `entry.isIntersecting`, promovem `shouldLoad` para `true` (`loading="eager"`), disparam `preloadPoster` e chamam `observer.disconnect()` imediatamente.
   - No `onPointerDown` e `onMouseEnter` (protegido por `prefetchedIdRef` para rodar apenas 1x por filme), o `PosterCard` pré-carrega a imagem do pôster que `FilmPage` exige (`w342` no mobile, `w500` no desktop) + o backdrop `w1280` + os detalhes da API.
4. **Prioridade na Primeira Dobra e Warm-up Pós-Fetch**:
   - Na Home (`HomePage` e `MobileCatalogSections`), `FilmsHubPage` e `SeriesHubPage`, os primeiros 6 a 8 cards das seções iniciais ("Populares da semana" e "Mais bem avaliados") recebem carregamento `eager`, com `fetchPriority="high"` nos 4 primeiros.
   - Após o carregamento da API (e em `tabDataCache`), um agendamento em `requestIdleCallback` / `setTimeout(..., 50)` executa `preloadPoster` para os primeiros pôsteres dos carrosséis visíveis.
