# Motor Inteligente de Curadoria: "Popular da Semana" (Filmes & Séries)

Aprimoramento do algoritmo da seção **Popular da Semana** (*Popular This Week*) para priorizar grandes lançamentos em cartaz nos cinemas, estreias recentes no streaming/digital e obras com alto engajamento semanal, aplicando a mesma inteligência tanto para **Filmes** quanto para **Séries** usando exclusivamente múltiplos sinais combinados do TMDB.

## Revisão e Decisões Confirmadas

> [!IMPORTANT]
> As decisões abaixo foram confirmadas e guiarão a implementação sem necessidade de chaves de API externas.

- **Fonte de Dados Confirmada**: Uso 100% baseado no **TMDB**, cruzando em paralelo múltiplos endpoints de lançamento teatral, lançamento digital/streaming e tendências diárias/semanais.
- **Prioridade de Ranking Confirmada**: Peso máximo para **grandes lançamentos atualmente em cartaz nos cinemas**, seguidos imediatamente por **filmes recém-chegados ao streaming/digital** e títulos em forte ascensão no *trending* da semana.
- **Escopo Confirmado**: Aplicação unificada tanto em **Filmes** (Cinema + Streaming Recente + Trending) quanto em **Séries** (Novos episódios/temporadas no ar + Streaming + Trending).

---

## 1. Visão Geral & Conceito Central

- **O Que Faz**: Substitui a chamada simples ao endpoint bruto `/trending/{type}/week` (que frequentemente mistura filmes ainda não lançados comercialmente, filmes antigos aleatórios ou produções obscuras com picos artificiais) por um **Motor Multi-Sinal de Popularidade Semanal**.
- **Público-Alvo & Contexto**: Usuários que abrem a Home, a aba de Filmes/Séries ou a vitrine completa de *Popular This Week* esperando ver exatamente o que está movimentando a conversa cultural agora — os blockbusters e filmes prestigiados em cartaz nas salas de cinema, os filmes que acabaram de estrear nas plataformas de streaming após a janela teatral, e as séries com episódios novos na semana.
- **Valor Principal**: Garante uma vitrine digna do Letterboxd, onde o topo da lista reflete fielmente os filmes em cartaz e as novidades quentes do streaming, mantendo a ordem 100% sincronizada entre os carrosséis da Home, os Hubs Desktop/Mobile e a página de resultados (*Browse Results*).

---

## 2. Experiência do Usuário & Design Visual

- **Fluxos de Usuário Impactados**:
  1. **Home (Mobile & Desktop)**: O destaque principal (*Hero Backdrop* no desktop) e a fileira **Popular this week** passam a exibir imediatamente os principais filmes em cartaz e recém-lançados no streaming.
  2. **Hubs de Filmes e Séries (`/films` e `/series`)**: O carrossel de 4 pôsteres grandes com métricas (*Watched / Rated / Liked*) e as fileiras mobile refletem a nova curadoria.
  3. **Exploração Completa (`/browse/results?preset=popular_week` e `?sort=popularity.desc`)**: Ao tocar na seta da seção ou navegar pelo filtro "Popular > Esta Semana", a grade completa pagina continuamente usando o mesmo motor de pontuação, sem quebrar a ordem vista na tela inicial.
- **Identidade Visual & Tema**:
  - Preserva integralmente a estética escura editorial estilo Letterboxd (`--color-lb-bg: #14181c`, `--color-lb-surface: #1b2228`, `--color-lb-green: #00e054`), mantendo os cards limpos, proporção `2:3` e transições fluidas.
- **Feedback Interativo & Performance**:
  - Todas as consultas multi-sinal rodam em paralelo (`Promise.allSettled`) com cache em memória (TTL de 5 minutos) e deduplicação de requisições simultâneas, garantindo carregamento instantâneo ao alternar entre abas.

---

## 3. Decisões de Produto & Regras de Pontuação (*Scoring*)

- **Decisão 1: Fusão de 5 Sinais para Filmes (*Popular Films This Week*)**
  - *Abordagem Escolhida*: Combinar em paralelo:
    1. **Em Cartaz nos Cinemas (`/movie/now_playing` + `/discover/movie` com `with_release_type=2|3`)**: Filmes na janela teatral atual (últimos 60 dias até hoje).
    2. **Recém-Chegados ao Streaming/Digital (`/discover/movie` com `with_release_type=4` ou `with_watch_monetization_types=flatrate|rent|buy`)**: Filmes lançados nos últimos 90–120 dias que acabaram de entrar no digital/streaming.
    3. **Trending Diário (`/trending/movie/day`)**: Pulso imediato do que explodiu nas últimas 24h.
    4. **Trending Semanal (`/trending/movie/week`)**: Volume consolidado da semana.
    5. **Alta Popularidade Geral (`/movie/popular`)**: Base complementar de engajamento.
  - *Por Quê*: Um filme que está simultaneamente em `/movie/now_playing` e em `/trending/movie/week` (ou que acabou de sair no digital e subiu no `/trending/movie/day`) recebe bônus cumulativos de consenso e fica garantido nas primeiras posições.

- **Decisão 2: Priorização de Grandes Lançamentos em Cartaz + Streaming Recente**
  - *Abordagem Escolhida*:
    - **Peso Máximo (Cinema Atual)**: Bônus elevado para filmes presentes na janela de cinema (`now_playing` / `release_type 2|3`) lançados nos últimos 45 dias e com volume real de avaliações do público (`vote_count`), evitando que filmes obscuros fiquem na frente de grandes estreias.
    - **Segundo Maior Peso (Streaming/Digital Recente)**: Bônus forte para filmes da janela recente (últimos 120 dias) disponíveis em *streaming/digital* que estão no *trending* diário ou semanal.
    - **Filtro de Elegibilidade**: Bloqueio estrito de filmes inéditos/futuros (`release_date > hoje` ficam exclusivos para *Most Anticipated*) e penalização de filmes sem engajamento mínimo ou com nota muito baixa/sem pôster.

- **Decisão 3: Curadoria Equivalente para Séries (*Popular Series This Week*)**
  - *Abordagem Escolhida*: Combinar `/trending/tv/day`, `/trending/tv/week`, `/tv/on_the_air` (séries exibindo episódios novos nos próximos/últimos 7 dias) e `/discover/tv` filtrado por episódios recentes no streaming (`air_date.gte` recente + `with_watch_monetization_types=flatrate`), mantendo o bloqueio automático de *Talk Shows*, *News* e *Reality* diários.
  - *Por Quê*: Garante que séries com temporadas ou episódios semanais em andamento no streaming liderem a vitrine, em vez de séries finalizadas há anos.

---

## 4. Arquitetura Técnica & Fluxo de Dados

```
┌────────────────────────────────────────────────────────────────────────────┐
│                  FONTES PARALELAS DO TMDB (Cache + Inflight)               │
├─────────────────────────────────────┬──────────────────────────────────────┤
│               FILMES                │                SÉRIES                │
│ • /movie/now_playing (Cinema)       │ • /tv/on_the_air (Episódios Atuais)  │
│ • /discover (Digital/Streaming Rec) │ • /discover (Streaming + Air Date)   │
│ • /trending/movie/day (Pulso 24h)   │ • /trending/tv/day (Pulso 24h)       │
│ • /trending/movie/week (Semana)     │ • /trending/tv/week (Semana)         │
│ • /movie/popular (Volume Geral)     │ • /tv/popular (Volume Geral)         │
└──────────────────┬──────────────────┴──────────────────┬───────────────────┘
                   │                                     │
                   ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                MOTOR DE RANKING SEMANAL (Weekly Popularity Engine)         │
│  1. Elegibilidade: Data <= Hoje + Pôster válido + Anti-Talk/News (Séries)  │
│  2. Sinais Combinados:                                                     │
│     • Bônus Principal: Em Cartaz no Cinema (Now Playing + Recência <= 60d) │
│     • Bônus Forte: Estreia Recente no Streaming/Digital (<= 120d)          │
│     • Bônus de Momento: Posição no Trending Day + Trending Week            │
│     • Bônus de Consenso: Presença simultânea em múltiplas listas           │
│     • Ponderação de Relevância: log10(vote_count) + vote_average + pop     │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   CONSUMIDORES SINCRONIZADOS NA INTERFACE                  │
├──────────────────────┬──────────────────────────┬──────────────────────────┤
│   Home & Mobile      │   Hubs Desktop           │   Catálogo & Paginação   │
│ • Hero Backdrop      │ • Popular Films Week     │ • BrowseResultsPage      │
│ • MobileCatalog      │ • Popular Series Week    │ • FilmsPage / SeriesPage │
└──────────────────────┴──────────────────────────┴──────────────────────────┘
```

### Mapeamento de Estado & Paginação
- **Pool Curado e Paginado**: O motor gera um pool ranqueado de alta precisão para as páginas iniciais (combinando múltiplas páginas de sinais em lote) e suporta paginação contínua para o *scroll* infinito no mobile e paginação numerada no desktop.
- **Compatibilidade com Filtros**: Quando o usuário aplica filtros extras (gênero, ano, década, serviço de streaming ou país) dentro de *Popular This Week*, o motor adapta a consulta ao `/discover` preservando a ordenação por relevância semanal e elegibilidade de lançamento.
