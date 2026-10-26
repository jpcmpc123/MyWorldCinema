# Sistema de Nota Unificada (Letterboxd, IMDb, Metacritic, Rotten Tomatoes e TMDb)

Implementação de um motor de agregação ponderada de notas críticas e de público diretamente na página de detalhes de filmes e séries, combinando dados da MDBList API (principal) e OMDb API (fallback) com persistência instantânea em `localStorage` e integração nativa ao bloco de avaliações tanto no Mobile quanto no Desktop.

## User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo foram alinhadas e confirmadas na etapa de esclarecimento e guiam toda a arquitetura desta entrega:

- **Decisão Confirmada 1 (Posicionamento na Interface)**: A **Nota Unificada** será integrada diretamente ao bloco principal de `Ratings` (tanto na seção de histograma mobile quanto no painel lateral direito do desktop), exibindo os indicadores individuais das 5 plataformas logo abaixo do histograma.
- **Decisão Confirmada 2 (Escala Principal em Destaque)**: O destaque principal da Nota Unificada utilizará exclusivamente a **escala de 0 a 5 estrelas** no padrão Letterboxd (ex.: `4.2 ★`, calculada convertendo o score ponderado de `0–100` para `score / 20`), preservando a identidade visual do app.
- **Decisão Confirmada 3 (Cobertura de Filmes e Séries)**: O agregador funcionará tanto para **Filmes** (`/tmdb/movie/${tmdbId}`) quanto para **Séries** (`/tmdb/show/${tmdbId}`), com fallback automático para a OMDb API via `imdb_id` e para a nota nativa do TMDb.
- **Configuração de Secrets (`.env.example`)**: As variáveis `VITE_MDBLIST_API_KEY` e `VITE_OMDB_API_KEY` serão registradas no `.env.example` (habilitando o painel de Secrets do AI Studio), mantendo fallback seguro em código para as chaves fornecidas para que a funcionalidade opere imediatamente.

---

## 1. Overview & Core Concept

- **O que faz**: Quando o usuário abre a tela de detalhes de um filme ou série, o sistema consulta o cache local (`notas_unificadas_v1_${tmdbId}` ou `notas_unificadas_v1_tv_${tmdbId}` para séries, mantendo `notas_unificadas_v1_${tmdbId}` para filmes conforme especificado) e, caso ainda não esteja salvo, busca em segundo plano as avaliações do **Letterboxd**, **IMDb**, **Metacritic**, **Rotten Tomatoes** e **TMDb**.
- **Cálculo da Média Ponderada**:
  - Cada fonte disponível na MDBList (`data.ratings`) fornece `score` (0 a 100) e `value` (valor original na escala de cada plataforma).
  - Pesos aplicados exclusivamente sobre as fontes que possuem nota válida (`score > 0`):
    - **Letterboxd** (`letterboxd`): peso `3.0`
    - **IMDb** (`imdb`): peso `2.5`
    - **Metacritic** (`metacritic`): peso `2.5`
    - **Rotten Tomatoes** (`tomatoes`): peso `1.5`
    - **TMDb** (`tmdb`): peso `1.0`
  - A média ponderada resultante (`0 a 100`) é convertida para a escala Letterboxd de **0 a 5 estrelas** (`unifiedScore100 / 20`) para alimentar a nota de destaque e a curva do histograma.
- **Valor Principal**: Oferece ao usuário um consenso real e imediato entre crítica e público sem sair do aplicativo, sem impactar a fluidez de 60fps das grades de pôsteres e sem desperdiçar franquia de requisições das APIs.

---

## 2. User Experience & Visual Design

- **Fluxo do Usuário e Estados de Carregamento**:
  1. **Zero chamadas fora da página de detalhes**: Nenhuma requisição para MDBList ou OMDb é disparada na Home, Busca ou Grades de navegação.
  2. **Abertura da Página de Detalhes**:
     - Se o filme/série já estiver salvo em `localStorage` (`notas_unificadas_v1_${tmdbId}`), a Nota Unificada em escala 0–5 e as notas das 5 plataformas são renderizadas **instantaneamente no primeiro frame**, sem skeleton.
     - Se for a primeira abertura daquele título, o histograma exibe imediatamente a estimativa inicial e, logo abaixo, uma linha de placeholders com pulso suave (`animate-pulse`) reserva o espaço exato das plataformas (zero *Cumulative Layout Shift*).
     - Assim que a resposta da MDBList (ou fallback OMDb) retorna, a nota principal em escala 0–5 atualiza suavemente e as notas originais de cada plataforma aparecem com transição de opacidade (`150ms`).
- **Identidade Visual & Tema**:
  - *Direção Estética*: Editorial cinematográfico escuro fiel ao Letterboxd (`#14181c` no mobile, `#202830` no card lateral do desktop, divisórias sutis `#2c3440` e destaque verde `#00e054`).
  - *Tipografia e Alinhamento Numérico*: Uso rigoroso de `tabular-nums` em todas as notas (`4.3`, `8.6/10`, `92%`, `84`) para alinhamento vertical perfeito.
  - *Exibição das Plataformas (Clean Unboxed Row / Micro-Grid)*: Logo abaixo das barras do histograma, uma grade compacta e limpa exibe cada fonte disponível com seu identificador visual/sigla e o valor original formatado (`value`):
    - **Letterboxd**: ex. `4.1 ★` (ou `4.1/5`)
    - **IMDb**: ex. `8.3`
    - **Rotten Tomatoes**: ex. `91%`
    - **Metacritic**: ex. `82`
    - **TMDb**: ex. `79%` ou `7.9`

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Disparo Exclusivo na Página de Detalhes + Cancelamento de Requisição**
  - *Abordagem Escolhida*: O hook/serviço de Nota Unificada roda apenas dentro da visualização de detalhes do título ativo, utilizando `AbortController` caso o usuário volte rapidamente ou troque de filme.
  - *Por quê*: Garante consumo mínimo da cota diária da MDBList/OMDb e mantém zero impacto de CPU/rede durante a rolagem de listas e carrosséis no celular.
- **Decisão 2: Estratégia de Resiliência em 3 Níveis (MDBList → OMDb → TMDb Nativo)**
  - *Abordagem Escolhida*:
    1. **Nível 1 (Principal)**: Consulta `https://api.mdblist.com/tmdb/${mediaType}/${tmdbId}?apikey=${MDBLIST_KEY}`. Extrai `letterboxd`, `imdb`, `metacritic`, `tomatoes` e `tmdb` de `data.ratings`.
    2. **Nível 2 (Fallback OMDb)**: Se a MDBList falhar, der timeout ou retornar `ratings` sem notas válidas, consulta `https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_KEY}` (usando o `imdb_id` vindo do TMDb ou da própria MDBList). Converte `imdbRating` (`parseFloat * 10`), `Metascore` (`parseInt`) e `Rotten Tomatoes` (`parseInt` de `Ratings[]`) para a base 100 e combina com a nota do TMDb (`vote_average * 10`) aplicando os mesmos pesos.
    3. **Nível 3 (Contingência TMDb)**: Caso o título ainda não possua `imdb_id` ou ambas as APIs externas falhem, utiliza a nota oficial do TMDb para nunca exibir erro visual quebrado.
- **Decisão 3: Cache Persistente em `localStorage` com Chave Padronizada**
  - *Abordagem Escolhida*: Salvar o payload processado na chave `notas_unificadas_v1_${tmdbId}` (para filmes, e prefixado com `tv_` quando for série de mesmo ID numérico para evitar colisão de IDs entre filme e série no TMDb) assim que uma resposta válida da MDBList ou OMDb for obtida.
  - *Por quê*: Reaberturas do mesmo título carregam em `0ms` sem qualquer chamada de rede.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     Configuração de Ambiente & Secrets                   │
│       VITE_MDBLIST_API_KEY (Principal)  |  VITE_OMDB_API_KEY (Reserva)   │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     Serviço de Notas Unificadas                          │
│                                                                          │
│  1. Verifica Cache: localStorage.getItem("notas_unificadas_v1_${id}")    │
│     ├─ Hit  ──► Retorna payload instantaneamente (0ms)                   │
│     └─ Miss ──► 2. Chama MDBList API (/tmdb/movie ou /tmdb/show)         │
│                    ├─ Sucesso ──► Pondera (LB 3.0, IMDb 2.5, MC 2.5,     │
│                    │              RT 1.5, TMDb 1.0)                      │
│                    └─ Falha/Vazio ──► 3. Fallback OMDb API (?i=imdbId)   │
│                                          Converte IMDb*10, Metascore, RT │
│                 4. Salva em localStorage e retorna UnifiedRatingsData    │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
┌────────────────────────────────────────┐ ┌───────────────────────────────┐
│     Bloco Mobile de Ratings            │ │   Painel Desktop de Ratings   │
│  - Média Unificada em destaque (0–5 ★) │ │  - Média Unificada (0–5 ★)    │
│  - Curva do histograma sincronizada    │ │  - Histograma verde clássico  │
│  - Linha de fontes abaixo (LB, IMDb,   │ │  - Grade compacta das 5       │
│    RT, Metacritic, TMDb) + Skeleton    │ │    fontes abaixo + Skeleton   │
└────────────────────────────────────────┘ └───────────────────────────────┘
```

### Data Model & State

- **`PlatformRatingItem`**:
  - `source`: `'letterboxd' | 'imdb' | 'tomatoes' | 'metacritic' | 'tmdb'`
  - `label`: Nome curto para exibição (`Letterboxd`, `IMDb`, `Rotten Tomatoes`, `Metacritic`, `TMDb`)
  - `score100`: Nota normalizada de `0` a `100` usada no cálculo ponderado
  - `displayValue`: Nota formatada na escala original da plataforma (a partir de `value` na MDBList ou formatada no fallback OMDb, ex.: `4.2`, `8.5`, `93%`, `81`, `7.8`)
  - `weight`: Peso da plataforma (`3.0`, `2.5`, `2.5`, `1.5`, `1.0`)
- **`UnifiedRatingsPayload`**:
  - `tmdbId`: `number`
  - `unifiedScore100`: `number` (média ponderada de `0` a `100`)
  - `unifiedStars5`: `number` (`unifiedScore100 / 20`, escala `0` a `5`)
  - `sources`: `PlatformRatingItem[]`
  - `provider`: `'mdblist' | 'omdb' | 'tmdb-fallback'`
  - `updatedAt`: `number`

### Interactive Component & State Mapping

- **Gerenciamento de Estado na Página do Filme**:
  - Ao montar ou trocar `movieId`, o estado `unifiedRatings` inicializa lendo sincronamente o `localStorage` (`notas_unificadas_v1_${movieId}`) para evitar qualquer piscar de tela se já estiver em cache.
  - Caso não esteja em cache, `unifiedLoading` fica `true` (exibindo o skeleton discreto na faixa de plataformas) enquanto o `useEffect` aguarda os detalhes básicos do filme (`imdb_id` e `vote_average`) e dispara a busca unificada.
  - Quando os dados chegam, a nota principal (`avg` no mobile e `averageRating` no `RatingHistogram` desktop) passa a refletir `unifiedRatings.unifiedStars5`, e a faixa inferior renderiza as notas originais de cada uma das 5 plataformas.
