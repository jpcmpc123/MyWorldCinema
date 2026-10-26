# Otimização Cirúrgica de Performance Mobile (Rede, VRAM e Fluidez 60fps)

Plano de engenharia focado em acelerar o carregamento de pôsteres e backdrops do TMDB, reduzir drasticamente o consumo de memória de vídeo (VRAM) e garantir rolagem e transições de abas a 60fps constantes em dispositivos móveis, mantendo a experiência Desktop (`!isMobile`) 100% intacta.

## Revisão e Decisões Confirmadas

> [!IMPORTANT]
> **Garantia de Não-Regressão no Desktop**: Todas as restrições de resolução de imagem, desativação da camada 4K, contenção de DOM e remoção de animações por card serão aplicadas estritamente no contexto Mobile (`isMobile` ou `@media (max-width: 767px)`). O layout, as animações, os tamanhos de imagem e o upgrade 4K do Desktop permanecem 100% preservados.

- **Decisão Confirmada 1 — Camada Única de Backdrop no Mobile**: Telas mobile (até `767px`) utilizarão exclusivamente a camada rápida em resolução `w780` (`decoding="async"` e `fetchPriority="high"`), desativando o download, o `img.decode()` e a retenção em memória (`pinnedDecodedImages`) da segunda camada `original` (4K). O Desktop manterá a camada rápida em `w1280` seguida do upgrade para `original` 4K.
- **Decisão Confirmada 2 — Montagem Sob Demanda e em Idle no Paginador Mobile**: O carrossel de abas principais montará inicialmente apenas a aba ativa no boot (eliminando a montagem simultânea das 4 abas e o pré-carregamento concorrente aos 180ms). Após `2500ms` de inatividade (`requestIdleCallback` / `setTimeout`), apenas a aba vizinha imediata será pré-montada de forma silenciosa, e qualquer outra aba será montada instantaneamente no início de um gesto de swipe (`onTouchStart`) ou toque na barra de navegação.
- **Decisão Confirmada 3 — Renderização Instantânea na Grade de Resultados Mobile**: Os cards da grade de exploração e resultados no mobile serão renderizados instantaneamente sem animação escalonada por card (`.mw-poster-in`), eliminando gargalos de composição durante o scroll infinito.

---

## 1. Visão Geral e Conceito Central

- **O Que Faz**: Elimina o desperdício de banda com imagens superdimensionadas no celular, corrige divergências de cache entre pré-carregamento e exibição (`cache miss`), reduz a sobrecarga de camadas de textura na GPU mobile e evita que árvores DOM ocultas (abas fora de tela ou layouts exclusivos de Desktop) consumam CPU e memória durante a navegação no celular.
- **Público-Alvo / Contexto**: Usuários acessando o catálogo em smartphones (telas `<= 767px`), onde a largura de banda móvel, a concorrência de conexões HTTP e o limite de VRAM da GPU exigem gerenciamento rigoroso de recursos.
- **Valor Principal**: Pôsteres carregando quase instantaneamente ao abrir o app ou rolar listas, redução drástica no uso de memória gráfica e navegação fluida a 60fps reais na rolagem vertical e no swipe horizontal entre abas.

---

## 2. Experiência do Usuário e Comportamento Visual

- **Fluxos de Experiência Otimizados**:
  1. **Abertura Instantânea da Home**: Ao abrir o aplicativo no celular, toda a prioridade de rede e CPU é dedicada exclusivamente aos pôsteres visíveis da aba ativa, sem competir com requisições de fundo de outras 3 abas ou dezenas de imagens ocultas.
  2. **Navegação para Detalhes de Filme/Série**: O backdrop no topo carrega imediatamente em `w780`, o pôster compacto ao lado da sinopse carrega em tamanho proporcional (`w342` com `srcSet` enxuto `185w, 342w, 500w` e `sizes="110px"`), e os carrosséis de títulos relacionados/semelhantes aproveitam 100% do pré-carregamento em `w185` sem *cache miss*.
  3. **Busca e Perfil de Atores**: As miniaturas de `52px` na busca passam a baixar arquivos ultraleves (`w92` / `w185 2x` em vez de `w500` / `w780`), e a rolagem vertical das listas de busca corre livre de recalculos de `transform` em abas ocultas.
- **Identidade Visual e Tema**:
  - *Preservação Visual Completa*: A paleta escura cinematográfica (`#14181c`, superfícies `#232a31`), tipografia, placeholders de título durante o carregamento e proporções `2:3` permanecem idênticos.
- **Feedback Interativo e Movimento**:
  - No Desktop (`!isMobile`), todas as micro-interações de hover, sombras, escalonamento de entrada (`.mw-poster-in`) e transições 4K continuam inalteradas.
  - No Mobile (`isMobile`), as entradas de grade em scroll infinito são imediatas e livres de atrasos artificiais, enquanto os carrosséis e abas respondem imediatamente ao toque.

---

## 3. Decisões Técnicas e Trade-Offs

- **Decisão 1: Dimensionamento de Imagens do TMDB e Alinhamento de Preload no Mobile**
  - *Abordagem Escolhida*:
    - Cards padrão (`!isLarge`) em telas até `640px`: `w185` como `src` padrão, `srcSet` restrito a `185w, 342w, 500w` (sem `w780` em cards pequenos no mobile) e `sizes="(max-width: 640px) 24vw, (max-width: 1024px) 18vw, 185px"`.
    - Carrosséis de Filmes Relacionados e Semelhantes (`92px`): `src` em `w185` e `srcSet` com `w185 1x, w342 2x`, casando exatamente com a URL pré-carregada.
    - Pôster do cabeçalho mobile (`86px`): `src` em `w342`, `srcSet` com `185w, 342w, 500w` e `sizes="110px"`.
    - Miniaturas da busca mobile (`52px`): `src` em `w92` e `srcSet` com `w92 1x, w185 2x`.
    - Grade mobile de atores (4 colunas) e foto da aba Bio (`92x138px`): `src` em `w185` com `srcSet` `185w, 342w` na grade e `w185 1x, w342 2x` na Bio no mobile.
  - *Por quê*: Reduz em até 75% o peso em bytes de cada pôster baixado em redes móveis e garante acerto de cache (`cache hit`) imediato ao abrir a página de um filme.
  - *Alternativas Consideradas*: Manter `w500`/`w780` no `srcSet` mobile foi descartado porque telas com `devicePixelRatio` 3x selecionavam arquivos de alta resolução para áreas visuais minúsculas de 52px a 92px.

- **Decisão 2: Lazy Loading Nativo Sem Observers por Card e Despromoção de Camadas GPU no Mobile**
  - *Abordagem Escolhida*: Remover o `new IntersectionObserver` individual de cada card que alternava o estado React `nearViewport` e confiar diretamente em `loading={priority || eager ? "eager" : "lazy"}` + `decoding="async"`. Em paralelo, desativar `transform: translateZ(0)` e `will-change: transform` em `@media (max-width: 767px)`.
  - *Por quê*: Elimina centenas de instâncias de observers e re-renderizações de estado React durante a rolagem, além de liberar dezenas de megabytes de texturas compostas na GPU do celular.

- **Decisão 3: Contenção de DOM (`content-visibility: hidden`), Desmontagem de Árvores Desktop Ocultas e Scroll Passivo Limpo**
  - *Abordagem Escolhida*:
    - Aplicar `content-visibility: hidden` e `contain-intrinsic-size: 100vw 100vh` em painéis colapsados (`.tab-panel-collapsed`) e no contêiner do paginador quando oculto por rotas secundárias no mobile.
    - Condicionar com `{!isMobile && (...)}` todo o bloco de duas colunas do modo "Títulos Semelhantes" (`isSimilarMode`) e bloquear a execução dos seus efeitos de busca de temas/nanogêneros quando `isMobile` for verdadeiro.
    - Remover a chamada de sincronização de `transform` (`querySelectorAll('.tab-panel')`) de dentro do listener de `scroll` vertical na página de busca, executando-a apenas no início do gesto de swipe horizontal (`onTouchStart`) ou na troca de aba.
  - *Por quê*: Garante que o navegador mobile nunca gaste tempo de layout, pintura, rede ou JavaScript por frame em elementos que não estão visíveis na tela do celular.

---

## 4. Arquitetura Técnica e Estratégia de Dados *(Referência Técnica)*

### Diagrama de Arquitetura e Fluxo de Renderização Condicional

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        Detecção de Contexto Viewport                      │
│            useIsMobile() / matchMedia('(max-width: 767px)')               │
└───────────────────┬───────────────────────────────────┬───────────────────┘
                    │ isMobile === true                 │ isMobile === false
                    ▼                                   ▼
┌───────────────────────────────────────┐ ┌─────────────────────────────────┐
│         Pipeline Mobile (60fps)       │ │   Pipeline Desktop (Intacto)    │
├───────────────────────────────────────┤ ├─────────────────────────────────┤
│ • Paginador de Abas:                  │ │ • Árvore de Rotas Direta        │
│   - Boot: monta apenas aba ativa      │ │ • Backdrop Dupla Camada:        │
│   - Idle (2500ms): monta aba vizinha  │ │   - fastSrc (w1280) +           │
│   - Ocultos: content-visibility:hidden│ │   - hdSrc (original 4K decode)  │
│ • Imagens TMDB Enxutas:               │ │ • Pôsteres Alta Resolução:      │
│   - Cards: w185 (185w, 342w, 500w)    │ │   - w342 / w500 / w780          │
│   - Busca (52px): w92 (1x) / w185 (2x)│ │ • Modo Similares Duas Colunas:  │
│   - Backdrop: camada única w780       │ │   - Abas Themes & Nanogenres    │
│ • GPU & Scroll Leves:                 │ │ • Animações e GPU:              │
│   - Sem Observer individual por card  │ │   - translateZ(0) e .mw-poster  │
│   - Sem translateZ(0) em massa        │ │     com delay escalonado        │
│   - Sync de abas só no início do swipe│ │                                 │
└───────────────────────────────────────┘ └─────────────────────────────────┘
```

### Mapeamento Interativo de Componentes e Estado

1. **Componente de Pôster Padrão**:
   - Na inicialização e renderização: avalia o tamanho ótimo considerando `w185` para viewports `<= 640px` em cards padrão (`!isLarge`), gera `srcSet` com `185w, 342w, 500w` no mobile e aplica `loading={priority || eager ? 'eager' : 'lazy'}` nativo sem instanciar `IntersectionObserver` por card.
2. **Componente de Backdrop**:
   - Quando `isMobile` é verdadeiro: resolve `fastSrc` para `w780`, ignora o agendamento do timer de upgrade para `original` 4K e não retém elementos `HTMLImageElement` no buffer global `pinnedDecodedImages`.
3. **Paginador de Abas Mobile (`TabViewPager`)**:
   - No mount inicial: inicializa o vetor `mounted` apenas com `true` no índice da aba ativa (`activeIndex`).
   - Em inatividade (`2500ms` após a montagem da aba ativa): monta silenciosamente apenas a aba vizinha imediata sem disparar pré-carregamento em massa de imagens.
   - Na interação do usuário (`onTouchStart` do swipe ou clique em aba): marca imediatamente a aba de destino/adjacente como montada antes da transição visual.
   - Quando oculto por navegação secundária: aplica contenção `content-visibility: hidden` para zerar o custo de layout das abas em segundo plano.
4. **Página de Vitrines e Similares**:
   - Quando `isSimilarMode` está ativo no mobile: curto-circuita os hooks que buscam seções de temas e nanogêneros do Desktop, desmonta a árvore Desktop via `{!isMobile && (...)}` e renderiza os cards da grade mobile instantaneamente (sem classe `.mw-poster-in` e sem `animationDelay`).
5. **Página de Busca Mobile**:
   - Durante a rolagem vertical (`window.scroll`): atualiza apenas a referência de posição em memória, deixando a sincronização de `transform` das abas inativas (`syncInactivePanelsOffset`) exclusivamente para o início do gesto de swipe horizontal ou mudança de aba ativa.
