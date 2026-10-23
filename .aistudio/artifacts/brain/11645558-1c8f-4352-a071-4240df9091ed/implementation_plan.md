# Otimização de Performance e Redução de Peso (Zero Alteração Visual/Funcional)

Plano para tornar o aplicativo **MyWorld Cinema** substancialmente mais leve, rápido na abertura e econômico em memória RAM e CPU, mantendo 100% da aparência, fluxos, animações e funcionalidades atuais intactos.

## Revisão do Usuário & Decisões Confirmadas

> [!IMPORTANT]
> Todas as otimizações abaixo atuam exclusivamente nos bastidores (divisão inteligente de código, gestão de memória, eliminação de re-renderizações desnecessárias e eficiência de rede/imagens), sem alterar o layout, cores, textos ou comportamento do app.

- **Decisão Confirmada 1 — Escopo de Otimização Completa**: Aplicar as três frentes de otimização:
  1. Divisão do pacote JavaScript (Code Splitting) e carregamento sob demanda (Lazy Loading) de telas pesadas e modais secundários;
  2. Redução do consumo de memória RAM e eliminação de re-renderizações desnecessárias no React;
  3. Otimização do carregamento de imagens e do cache de requisições da API TMDB.
- **Decisão Confirmada 2 — Preservação de Arquivos de Projeto**: Manter intactos todos os arquivos de backup e capturas de tela existentes no repositório, garantindo porém que o empacotador de produção ignore artefatos pesados não utilizados pelo runtime quando aplicável sem apagar nenhum arquivo.

---

## 1. Visão Geral & Objetivo

- **O Que Faz**: Reduz o peso do pacote inicial carregado pelo navegador/WebView, diminui o uso contínuo de memória RAM durante a navegação entre filmes/séries/atores e acelera as respostas de interface e rede.
- **Público-Alvo**: Usuários mobile (navegador e app Android Capacitor) e desktop que navegam por catálogos extensos de pôsteres, abas deslizantes e fichas técnicas detalhadas.
- **Valor Principal**: Inicialização mais rápida (First Contentful Paint / Time to Interactive menor), rolagem e transições de abas a 60/120 FPS constantes sem engasgos de coleta de lixo (Garbage Collection) e menor consumo de bateria e dados móveis.

---

## 2. Experiência do Usuário & Identidade Visual

- **Fluxos de Usuário**: Exatamente idênticos aos atuais. O usuário continua navegando pelas abas principais (`Filmes`, `Séries`, `Críticas`, `Listas`), abrindo páginas de detalhes com transição deslizante instantânea, pesquisando no catálogo e utilizando modais de avaliação e listas.
- **Identidade Visual & Tema**: 100% preservada — paleta escura cinematográfica (`--color-lb-bg: #14181c`, `--color-lb-surface: #1b2228`, destaque verde `#00e054` e laranja `#ff8000`), tipografia e espaçamentos originais.
- **Feedback Interativo & Movimento**: As transições de página em 2 fases na GPU e o indicador elástico das abas continuam funcionando exatamente da mesma forma, mas com pré-aquecimento assíncrono dos pacotes (chunks) ao tocar/passar o mouse nos cartões para evitar qualquer atraso na primeira abertura.

---

## 3. Principais Decisões Técnicas & Trade-Offs

- **Decisão 1: Code Splitting de Rotas Pesadas com Pré-Carregamento Preditivo (Prefetch)**
  - *Abordagem Escolhida*: Converter as páginas de detalhes de Filme/Série, Perfil de Ator, Coleção, Busca e as abas secundárias do paginador mobile para carregamento sob demanda (`React.lazy`), disparando o pré-carregamento do módulo automaticamente no toque/hover do cartão (`PosterCard`) ou em tempo ocioso (`requestIdleCallback`). Também carregar sob demanda os modais secundários da página de filme (seletor de pôster/backdrop e lightbox).
  - *Por quê*: Retira centenas de kilobytes do pacote JavaScript principal que bloqueia o carregamento inicial do app, enquanto o prefetch no toque garante que a página já esteja na memória no instante em que a transição começa.
  - *Alternativas Consideradas*: Manter todas as páginas importadas estaticamente no ponto de entrada — descartado pois força o dispositivo a baixar e compilar todo o código de detalhes de filmes, atores e modais antes mesmo de pintar a tela inicial.

- **Decisão 2: Otimização do Store de Filmes (`O(1)` via `Set`) e Isolamento de Contexto**
  - *Abordagem Escolhida*: Substituir buscas lineares repetidas (`Array.includes` em listas de assistidos, curtidos e watchlist para cada cartão renderizado) por estruturas `Set<number>` com consulta `O(1)` instantânea, além de usar seletores e ações estáveis (`useMovieActions`, `useOpenActionSheet`) nos componentes que só disparam ações sem precisar re-renderizar quando a lista de logs muda.
  - *Por quê*: Com dezenas ou centenas de cartões montados simultaneamente nas grades e abas do `TabViewPager`, consultas `O(1)` e contextos desacoplados evitam cascatas de re-renderização ao curtir ou marcar um filme como assistido.

- **Decisão 3: Teto Inteligente de Memória para Imagens Decodificadas e Cache TMDB**
  - *Abordagem Escolhida*: Reduzir a retenção de elementos `HTMLImageElement` decodificados em memória (evitando segurar dezenas de bitmaps de alta resolução simultaneamente na RAM), limitar o tamanho dos caches em memória (`loadedPosterUrls`, `tmdbCache`, `mediaDetailsCache`, `similarProfileCache`) com política LRU simples e evitar gravações duplicadas desnecessárias simultâneas em `sessionStorage` + `localStorage` para o mesmo payload pesado das vitrines.
  - *Por quê*: Bitmaps decodificados na RAM são os maiores responsáveis por lentidão progressiva e fechamento abrupto em celulares após navegar por vários filmes seguidos.

---

## 4. Arquitetura Técnica & Estratégia de Dados

### Diagrama de Arquitetura de Performance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Inicialização Leve (Boot)                        │
│  ┌──────────────────────┐   ┌───────────────────────┐   ┌────────────┐  │
│  │ Pacote Core Enxuto   │   │ Chunks de Bibliotecas │   │ Home +     │  │
│  │ (Shell + Roteador)   │──▶│ (React / Ícones / DB) │──▶│ Cache RAM  │  │
│  └──────────────────────┘   └───────────────────────┘   └────────────┘  │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
│   Code Splitting &    │   │  Estado & Memória O(1)│   │   Rede & Imagens      │
│   Prefetch Preditivo  │   │                       │   │   Otimizadas          │
├───────────────────────┤   ├───────────────────────┤   ├───────────────────────┤
│ • Detalhes de Filme,  │   │ • MovieStore com Set  │   │ • Hero Desktop em     │
│   Ator, Busca e       │   │   O(1) para watched,  │   │   resolução w1280     │
│   Coleção sob demanda │   │   liked e watchlist   │   │   (~130KB vs ~5MB)    │
│ • Prefetch do chunk   │   │ • Limite LRU em       │   │ • Deduplicação e      │
│   no pointerDown/hover│   │   caches de imagens e │   │   poda automática de  │
│ • Modais de imagem e  │   │   perfis de similares │   │   caches TMDB         │
│   lightbox lazy       │   │ • Zero re-render      │   │ • Escrita assíncrona  │
│                       │   │   global em ações     │   │   única em storage    │
└───────────────────────┘   └───────────────────────┘   └───────────────────────┘
```

### Mapeamento de Otimizações por Camada

1. **Empacotamento e Divisão de Chunks (Build & Bundle)**
   - Separar bibliotecas pesadas em chunks dedicados e cacheáveis (`react-vendor`, `supabase`, `icons`) para que o navegador compile e armazene em cache de forma independente.
   - Carregar sob demanda (`lazyWithRetry`) as rotas de detalhes (`FilmPage`, `ActorPage`, `CollectionPage`, `SearchPage`) e as abas não ativas do `TabViewPager` (`SeriesHubPage`, `DiaryPage`, `ListsPage`), mantendo o prefetch automático em segundo plano logo após o primeiro paint e no toque de qualquer pôster.
   - Carregar sob demanda os modais internos da página de detalhes (`ImagePickerModal`, `PosterLightbox`, `ActionBottomSheet`) apenas quando o usuário solicitar sua abertura.

2. **Estado, Memória e Re-renderizações React**
   - Atualizar o armazenamento de cartões (`MovieStore`) para converter `watchedIds`, `likedIds` e `watchlistIds` em `Set<number>` uma única vez a cada atualização de estado, reduzindo a verificação por cartão de `O(N)` para `O(1)`.
   - Reduzir o buffer de bitmaps decodificados retidos na memória RAM e liberar referências de imagens antigas imediatamente após a transição, evitando acúmulo de dezenas de megabytes de texturas descomprimidas.
   - Garantir que `HomePage` e componentes de navegação consumam ações estáveis e memorizem listas derivadas para evitar recálculos em cada renderização.

3. **Imagens e Camada de Dados TMDB**
   - Ajustar o banner principal (Hero) do desktop na `HomePage` para utilizar `w1280` em vez de `original` (reduzindo o peso da imagem de destaque de ~4–8 MB para ~120 KB sem perda visual, seguindo o mesmo padrão já adotado no componente `Backdrop`).
   - Unificar a persistência do cache das vitrines (`tabDataCache`) em um único armazenamento rápido (`sessionStorage` com fallback leve), evitando serializar e gravar o mesmo JSON pesado duas vezes seguidas (`sessionStorage` + `localStorage`) a cada atualização.
   - Adicionar limite de tamanho (LRU) aos mapas em memória do serviço TMDB (`similarProfileCache`, `mediaDetailsCache`, `popularWeekPoolCache`) para manter o uso de RAM estável mesmo em sessões longas.
