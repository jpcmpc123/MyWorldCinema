# Atualização Real no Pull-to-Refresh Mobile e Exclusão na Aba da Lupinha

Garantir que o gesto de puxar para recarregar (pull-to-refresh) no celular execute uma atualização real dos catálogos da API TMDB e dos dados do usuário no Supabase sem piscar a tela, mantendo a aba de Pesquisa (lupinha) e todas as suas subpáginas totalmente livres desse indicador.

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisões confirmadas para o funcionamento do recarregamento mobile:

- **Atualização real sem piscar a tela (Confirmado)**: Ao puxar e soltar nas abas permitidas, o aplicativo limpará os caches em memória da TMDB (incluindo os pools de *Populares da Semana* e detalhes em RAM) e buscará novamente os dados atualizados da TMDB e do Supabase (diário, assistidos, curtidas, notas, watchlist, Top 4 e overrides) em segundo plano, atualizando a interface suavemente sem recarregar a página inteira do navegador (sem tela preta/branca de F5).
- **Sem looping/recarregamento na aba da Lupinha (Confirmado)**: O indicador de puxar para recarregar fica estritamente bloqueado na aba de busca (ícone da lupinha), nos resultados de pesquisa, nos filtros (*Lançamento*, *Gênero*, *País*, *Idioma*, *Streaming*, *Mais populares*, *Mais bem avaliados*, *Mais aguardados*) e nas páginas de detalhes de filmes, séries e elenco.

## 1. Overview & Core Concept

- **O que foi diagnosticado**:
  1. Embora o `PullToRefresh` limpasse o `tabDataCache`, o serviço da TMDB mantinha um segundo cache interno em memória (`popularWeekPoolCache` e `mediaDetailsCache`) com duração de 30 minutos. Assim, ao puxar para atualizar, a chamada retornava instantaneamente os mesmos objetos cacheados na memória RAM em vez de consultar a API da TMDB novamente.
  2. Nas abas de Perfil, Diário, Watchlist e Atividade, os dados do usuário no Supabase (`film_logs`, `watchlist`, `profiles`, `film_overrides`) só eram carregados uma única vez no login e não escutavam o evento de recarregamento.
- **Valor entregue**: Puxar para baixo nas abas principais ou no perfil agora força uma nova consulta real à TMDB e ao Supabase, refletindo imediatamente novos registros, alterações de pôster/backdrop, favoritos e catálogos atualizados.

## 2. User Experience & Visual Design

- **Fluxo de Atualização Suave**:
  - O usuário puxa a tela para baixo nas abas principais (*Filmes*, *Séries*, *Críticas*, *Listas*) ou nas abas de *Perfil* (*Perfil*, *Diário*, *Listas*, *Watchlist*).
  - O círculo branco com a seta escura (`#14181c`) desce de trás da barra superior preta e entra em rotação contínua enquanto as requisições reais à TMDB e ao Supabase são concluídas.
  - Os cartões e estatísticas da tela são atualizados no lugar (*in-place*), sem desmontar a página e sem piscar a tela, e o círculo branco recolhe suavemente.
- **Bloqueio Total na Aba da Lupinha**:
  - Na aba da lupinha (Pesquisa) e em qualquer tela aberta a partir dela (filtros de ano, década, gênero, país, idioma, streaming ou resultados), o gesto de puxar para baixo não exibe nenhum círculo ou looping de carregamento.

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Limpeza Completa dos Caches em Memória da TMDB**
  - *Abordagem Escolhida*: Expor um método de limpeza dos caches internos de vitrines e detalhes da TMDB para ser acionado junto com o `tabDataCache.invalidateAll()` no momento do pull-to-refresh.
  - *Por quê*: Garante que `getFilmsHubSections()` e `getSeriesHubSections()` façam requisições HTTP reais à TMDB ao puxar para atualizar, mantendo o cache rápido durante a navegação normal entre abas.
- **Decisão 2: Re-sincronização Silenciosa com o Supabase**
  - *Abordagem Escolhida*: Escutar o evento de atualização no contexto principal e de autenticação para recarregar `film_logs`, `watchlist`, `favorite_films`, `film_overrides` e dados do perfil diretamente do Supabase sem zerar a tela antes da resposta.
  - *Por quê*: Evita qualquer efeito de piscar (*flash* de estado vazio) enquanto garante que alterações feitas na conta apareçam imediatamente após puxar para recarregar.

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│               Gesto Pull-to-Refresh (Abas Principais / Perfil)         │
│   (Bloqueado na Lupinha / Busca / Filtros / Detalhes de Filme e Série) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Orquestrador de Atualização Real                   │
│  1. Limpa tabDataCache + popularWeekPoolCache + mediaDetailsCache      │
│  2. Dispara evento global 'mw:pull-to-refresh'                         │
└─────────────────┬────────────────────────────────────┬─────────────────┘
                  │                                    │
                  ▼                                    ▼
┌───────────────────────────────────┐┌───────────────────────────────────┐
│        Catálogo TMDB (API)        ││      Dados do Usuário (Supabase)  │
│ • Re-busca Filmes e Séries da     ││ • Re-consulta film_logs,          │
│   semana, mais votados e em alta  ││   watchlist, favorite_films,      │
│ • Atualiza HomePage e SeriesHub   ││   film_overrides e perfil         │
│   in-place sem piscar a tela      ││ • Atualiza Perfil/Diário/Watchlist│
└───────────────────────────────────┘└───────────────────────────────────┘
```

- **Mapeamento de Estado e Eventos**:
  - Quando o usuário solta o indicador após o limite de ativação, os caches em memória são invalidados antes do disparo do evento `mw:pull-to-refresh`, garantindo que tanto o pré-carregamento quanto os ouvintes nas páginas ativas recebam dados frescos da rede.
  - O indicador aguarda a conclusão real das Promises da TMDB e do Supabase antes de recolher para cima da barra superior.
