# Refatoração Arquitetural, Modularização e Otimização de Performance (MyWorld Cinema)

Este plano estrutura a evolução interna do código do **MyWorld Cinema**, dividindo os dois maiores monólitos do projeto (o contexto global de estado e o cliente/motor de curadoria TMDB) em módulos coesos e fortemente tipados, além de elevar a performance de renderização, o cache em memória e a fluidez em dispositivos móveis sem alterar qualquer aspecto visual ou funcional existente.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo refletem exatamente as prioridades confirmadas por você na etapa de alinhamento. Nenhum visual, cor, layout ou regra de negócio será alterado — todas as melhorias ocorrem na arquitetura interna, tipagem e performance de execução.

- **Decisão Confirmada 1 — Foco em Arquitetura, Tipagem e Performance**: Priorizar a modularização de arquivos extensos, fortalecimento da tipagem TypeScript (`strict`, eliminação de casts inseguros `as unknown as`), otimização de re-renders, cache TMDB e fluidez mobile.
- **Decisão Confirmada 2 — Escopo Principal nos Núcleos de Dados e Estado**: Desmembrar o gerenciador de estado global (~1.600 linhas) e o serviço TMDB (~3.080 linhas) em submódulos especializados mantendo 100% de compatibilidade com os imports existentes nos componentes.
- **Decisão Confirmada 3 — Preservação Total de UI/UX**: Manter 100% do visual e comportamento atuais intactos, atuando estritamente sob o capô.

---

### 1. Overview & Core Concept

- **O Que Faz**: Reorganiza o núcleo de estado do usuário (diário, watchlist, listas, avaliações, sincronização Supabase e importação Letterboxd) e a camada de dados TMDB (cliente HTTP com retry/deduplicação, caches LRU/TTL, motores de curadoria "Popular da Semana", "Mais Aguardados", "Semelhantes" e buscas enriquecidas) em domínios independentes e otimizados.
- **Público-Alvo / Contexto**: Usuários mobile e desktop do MyWorld Cinema que navegam entre abas, listas grandes (600+ filmes importados) e páginas de detalhes, além da manutenção futura do código.
- **Valor Principal**:
  - **Manutenibilidade e Clareza**: Substitui arquivos monolíticos de milhares de linhas por módulos focados por domínio ( cada um com responsabilidade única e contratos TypeScript explícitos).
  - **Performance O(1) em Listas Grandes**: Substitui buscas lineares (`Array.includes` / `Array.some`) em coleções de centenas de filmes por estruturas indexadas (`Set` / `Map`) e evita re-renderizações em cascata quando o usuário curte, avalia ou registra um filme.
  - **Rede e Cache Mais Inteligentes**: Unifica o gerenciamento de cache com expiração (TTL) e limite de memória (LRU), além de pré-aquecer pôsteres no mobile de forma adaptativa sem congestionar a banda.

---

### 2. User Experience & Visual Design

- **Fluxos do Usuário**: Todos os fluxos existentes (navegação entre abas com *swipe*, abertura de detalhes de filmes/séries/atores, registro no diário, edição de Top 4, *long-press* no mobile e importação CSV do Letterboxd) permanecem idênticos em comportamento e resposta visual.
- **Identidade Visual & Tema**:
  - *Direção Estética*: Preservação integral da estética escura inspirada no Letterboxd (`bg-lb-bg`, `#14181c`, `#00e054`, `#ff8000`, `#40bcf4`).
  - *Tipografia e Layout*: Nenhuma classe CSS, espaçamento ou componente visual será modificado.
- **Feedback Interativo & Fluidez Mobile**:
  - **Zero Bloqueio da Thread Principal**: Gravações no `localStorage` continuarão agendadas em `requestIdleCallback`, agora com *coalescing* e serialização desacoplada para nunca competir com animações de transição de página (`340ms cubic-bezier`).
  - **Consultas Instantâneas (`O(1)`)**: Verificações `isMovieWatched`, `isMovieLiked` e `isMovieInWatchlist` passam a consultar `Set<number>` sincronizados em memória em vez de percorrer arrays a cada chamada.
  - **Pré-aquecimento Adaptativo de Pôsteres**: O cache de abas passa a pré-carregar os primeiros pôsteres visíveis também em telas mobile (usando a variante leve `w185`), eliminando o atraso na primeira troca de aba.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Fachada Compatível (Barrel Re-exports) para Zero Quebra**
  - *Abordagem Escolhida*: Dividir o estado global e o serviço TMDB em submódulos internos coesos, mantendo os pontos de entrada públicos com a exata mesma assinatura (`useApp`, `useMovieState`, `useMovieActions`, `tmdb.*`, tipos exportados).
  - *Por Quê*: Permite modularizar mais de 4.600 linhas de código com segurança total, garantindo que todas as páginas e componentes continuem funcionando sem risco de regressão.
  - *Alternativas Consideradas*: Alterar as assinaturas em todas as 30+ páginas e componentes simultaneamente — descartado por aumentar o risco de efeitos colaterais desnecessários.

- **Decisão 2: Otimização de Estado e Sincronização Supabase Desacoplada**
  - *Abordagem Escolhida*: Extrair a lógica de persistência do Supabase (logs rápidos, logs completos, watchlist, Top 4, overrides e importação em lote) e o motor de importação do Letterboxd para módulos dedicados fora do corpo do componente `AppProvider`.
  - *Por Quê*: Reduz drasticamente a complexidade ciclomática do `AppProvider`, facilita testes e leitura, e permite usar `Set<number>` em memória para consultas `O(1)` de filmes assistidos, curtidos e na watchlist.
  - *Alternativas Consideradas*: Manter as funções assíncronas de banco e importação inline dentro do `AppProvider` — descartado pois mistura regras de transformação de CSV e queries SQL com o ciclo de vida de renderização do React.

- **Decisão 3: Arquitetura Modular do Serviço TMDB com Cache Tipado Unificado**
  - *Abordagem Escolhida*: Separar o serviço TMDB em módulos especializados:
    1. **Cliente HTTP & Cache (`client / cache`)**: `fetchFromTMDB`, `fetchWithRetry`, deduplicação de promises *in-flight* e cache LRU com TTL tipado.
    2. **Contratos e Normalizadores (`types / normalizers`)**: Interfaces estritas para filmes, séries (incluindo `aggregate_credits` e `created_by`), pessoas e coleções, eliminando `as unknown as Record<string, unknown>` espalhados pelo código.
    3. **Motores de Curadoria (`curators`)**: Algoritmos "Popular da Semana" (escalões Cinema vs. Streaming vs. Trending), "Mais Aguardados" (filtro de inéditos reais) e "Títulos Semelhantes" (afinidade de gêneros, keywords e franquias).
    4. **Busca e Importação (`search`)**: Busca enriquecida com diretores/títulos alternativos e resolução por TMDB ID / IMDb ID.
  - *Por Quê*: Isola as regras de pontuação e curadoria da infraestrutura de rede, tornando o código fácil de navegar e estritamente tipado.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

#### Diagrama de Arquitetura e Fluxo de Módulos

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         CAMADA DE APRESENTAÇÃO (UI)                          │
│   Pages (Home, Film, Profile, Search...)  │  PosterCard / GlobalModals       │
└─────────────────────┬──────────────────────────────────────┬─────────────────┘
                      │ useApp()                             │ useMovieState(id)
                      │ useMovieActions()                    │ useOpenActionSheet()
                      ▼                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     NÚCLEO DE ESTADO GLOBAL (AppContext)                     │
│  ┌─────────────────────────┐  ┌────────────────────────┐  ┌───────────────┐  │
│  │   AppProvider (Core)    │  │  MovieStore (O(1) Set) │  │ Idle Storage  │  │
│  │  Estado React + Hooks   │─▶│ useSyncExternalStore   │  │ Scheduler     │  │
│  └────────────┬────────────┘  └────────────────────────┘  └───────────────┘  │
│               ├──────────────────────────────┐                               │
│               ▼                              ▼                               │
│  ┌─────────────────────────┐  ┌───────────────────────────────────────────┐  │
│  │ Supabase Sync Service   │  │      Letterboxd Bulk Import Engine        │  │
│  │ • Quick/Full Logs       │  │ • Deduplicação por (movieId + date)       │  │
│  │ • Watchlist & Top 4     │  │ • Upsert em lotes (chunks de 100)         │  │
│  │ • Poster/Backdrop Overr.│  │ • Merge inteligente de tags e reviews     │  │
│  └─────────────────────────┘  └───────────────────────────────────────────┘  │
└──────────────────────────────────────────────┬───────────────────────────────┘
                                               │
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE DADOS & CURADORIA TMDB                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                   Fachada Pública Unificada (`tmdb`)                   │  │
│  └───┬───────────────────┬──────────────────────┬─────────────────────┬───┘  │
│      ▼                   ▼                      ▼                     ▼      │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────┐  │
│  │ HTTP Client  │  │ Curadoria & Hubs │  │ Affinity Engine  │  │  Search  │  │
│  │ & LRU Cache  │  │ • Popular Week   │  │ • Similar Media  │  │ & Import │  │
│  │ • Retry 429  │  │ • Anticipated    │  │ • Genre/Keyword  │  │ • Enrich │  │
│  │ • In-Flight  │  │ • Films/TV Hubs  │  │   Jaccard Score  │  │ • IMDb   │  │
│  └──────────────┘  └──────────────────┘  └──────────────────┘  └──────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Modelo de Dados & Otimizações de Estado

1. **Indexação `O(1)` no Contexto**:
   - Criação de conjuntos derivados e refs sincronizadas (`watchedSetRef`, `likedSetRef`, `watchlistSetRef`) para que `isMovieWatched(id)`, `isMovieLiked(id)` e `isMovieInWatchlist(id)` executem em tempo constante `O(1)` em vez de `O(N)`.
   - No `movieStore`, a conversão de `watchlist` para IDs deixa de alocar arrays intermediários desnecessários quando a lista de observação não muda.
2. **Tipagem Estrita de Respostas Híbridas (Filme/Série)**:
   - Definição da interface explícita `TMDBRawMediaPayload` cobrindo campos exclusivos de TV (`name`, `original_name`, `first_air_date`, `episode_run_time`, `aggregate_credits`, `created_by`) para eliminar conversões `as unknown as Record<string, unknown>` e garantir segurança em tempo de compilação.
3. **Gerenciador de Cache `BoundedTTLCache<K, V>`**:
   - Abstração genérica leve com política LRU (remove a entrada menos recentemente usada ao atingir a capacidade máxima) e validação automática de TTL, substituindo os múltiplos `Map` manuais espalhados pelo serviço TMDB.

#### Mapeamento de Interações e Garantias de Comportamento

- **Ações Rápidas em Cartões (`PosterCard`)**: Ao clicar em "Assistido", "Curtir" ou atribuir estrelas, `useMovieActions` atualiza o estado em memória via `Set` `O(1)`, notifica exclusivamente o `PosterCard` daquele filme via `movieStore` e dispara a sincronização assíncrona no módulo de persistência Supabase.
- **Importação de Dados (Letterboxd CSV)**: O fluxo de importação delega a combinação de linhas, cálculo de estatísticas e envio em lotes (`chunkSize = 100`) ao módulo dedicado de importação, mantendo o retorno `ProfileImportSummary` idêntico.
- **Navegação Mobile & Abas**: O cache de abas (`tabDataCache`) passa a aquecer na Onda 1 os 4 primeiros pôsteres na resolução ideal de cada dispositivo (`w185` no mobile, `w342`/`w500` no desktop), garantindo transição instantânea ao deslizar entre *Films* e *Series*.
