# Plano de Otimização de Performance 120Hz & Imagens Retina/HD — MyWorld

## 1. Visão Geral e Decisões Confirmadas

Este plano estabelece a arquitetura de otimização para atingir **120 fps constantes** (janela de orçamento de **8.3ms por frame**) durante rolagem rápida, troca de abas, abertura de modais e renderização de grades densas, mantendo nitidez Retina/OLED em todas as capas e imagens do TMDB:

- **Resolução Retina/HD Confirmada**: Uso de `w500` e `w780` em `srcSet` (`500w` e `780w`) com `w500` como fonte base em todos os cartões e grades de pôsteres, além de `w1280` e `original` para backdrops e banners principais.
- **Virtualização Nativa CSS e Camada GPU Confirmada**: Aplicação de `content-visibility: auto`, `contain-intrinsic-size`, `backface-visibility: hidden` e promoção de camada GPU (`transform: translateZ(0)`) em todas as grades longas e listas (Watchlist, Diário, Busca, Explorar/Resultados, Perfil, Ator e Listas).
- **Trava de Regressão**: Preservação integral de todas as correções de lógica, `try/catch/finally` e sincronização aplicadas na auditoria anterior, sem qualquer alteração de cores, tipografia, espaçamentos ou layout em mobile e desktop.

---

## 2. Arquitetura do Pipeline de 120Hz (8.3ms Frame Budget)

```
[ Entrada de Toque / Scroll (120Hz = 8.3ms/frame) ]
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 1. Thread de Eventos & Gestos (Passive + rAF Throttling)     │
│    - Listeners touchstart/touchend/scroll com {passive:true} │
│    - Atualizações visuais de pull/swipe sincronizadas a 120Hz│
│    - Carrosséis com -webkit-overflow-scrolling: touch        │
│      e overscroll-behavior-x: contain                        │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Compositor & Virtualização CSS (GPU Layer Promotion)      │
│    - .poster-card-optimized: content-visibility: auto        │
│      + contain-intrinsic-size: auto 160px 240px              │
│    - Substituição de transition-all por transform + opacity  │
│    - Isolamento de pintura em itens de grade e linhas longas │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Pipeline de Imagens Retina/HD (Off-Main-Thread Decode)    │
│    - Pôsteres: src=w500 | srcSet="w500 500w, w780 780w"      │
│    - Hero/Backdrops: w1280 + original (eager + high priority)│
│    - decoding="async" + aspect-[2/3] fixo (Zero CLS)         │
│    - React.memo em cards e linhas do diário                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Detalhamento Técnico por Frente de Otimização

### A. Pipeline de Imagens Retina/HD sem Bloqueio da Thread Principal
- **Pôsteres em Alta Definição (`w500` / `w780`)**:
  - Atualizar o componente central de pôsteres e as grades de páginas para utilizar `w500` como `src` padrão e `srcSet` com `${urlW500} 500w, ${urlW780} 780w` (ou `1x / 2x`), com atributo `sizes` calibrado para telas Retina 2x/3x.
  - Atualizar miniaturas de listas, diário e pré-visualizações que usavam `w92` / `w185` para resoluções nítidas com `srcSet` responsivo (`w500` / `w780`), `decoding="async"` e `loading="lazy"`.
- **Prioridade de Carregamento (`eager` + `fetchPriority="high"` vs `lazy`)**:
  - Garantir `loading="eager"` e `fetchPriority="high"` exclusivamente nos elementos *above-the-fold* (Hero da Home, Backdrop principal, pôster principal da página de detalhes do filme/série e primeira fileira visível).
  - Garantir `loading="lazy"` e `decoding="async"` em todos os demais cartões de grades, listas, resultados de busca e histórico do diário.
- **Prevenção Total de Layout Shift (CLS = 0)**:
  - Manter `aspect-[2/3]` fixo e fundo sólido `#232a31` / `#1c2228` em todos os containers de pôster antes e durante a decodificação assíncrona.

### B. Virtualização Nativa CSS e Aceleração de GPU no Scroll
- **Contenção de Renderização (`.poster-card-optimized` e `.diary-row-optimized`)**:
  - Adicionar classes utilitárias de contenção CSS com `content-visibility: auto`, `contain-intrinsic-size: auto 160px 240px`, `backface-visibility: hidden` e `transform: translateZ(0)` nos itens de grades e linhas de listas longas (Watchlist, Diário, Busca, Explorar/Resultados, Perfil, Ator e Listas).
  - Nota de precisão: quando o menu contextual (popover desktop) de um cartão estiver aberto (`menuOpen`), desativar temporariamente o `content-visibility: auto` naquele único cartão para que o popover nunca seja cortado pelo container.
- **Eliminação de `transition-all` na Árvore de UI**:
  - Substituir todas as ocorrências de `transition-all` em cartões, botões e modais por transições restritas ao compositor da GPU (`transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease` ou equivalentes `transition-[transform,opacity,border-color,background-color]`).
- **Carrosséis Horizontais Nativos a 120Hz**:
  - Garantir `-webkit-overflow-scrolling: touch` e `overscroll-behavior-x: contain` em todos os trilhos horizontais (`[data-h-scroll="true"]`, `.similar-carousel`, `.person-tabs-container` e carrosséis de catálogo mobile).
  - Promover headers fixos, barras de navegação e modais com `backdrop-blur` para camadas próprias na GPU (`transform: translateZ(0)`), sem repetir `backdrop-filter` em itens individuais de grade.

### C. Prevenção de Re-renderizações em Cascata e Throttling por `requestAnimationFrame`
- **Memoização de Componentes de Lista (`React.memo`)**:
  - Manter `PosterCard` encapsulado em `React.memo` com comparação otimizada das propriedades primitivas do filme (`id`, `poster_path`, `title`, `release_date`, `size`, `priority`, `faded`, `rank`) para evitar re-renderizações quando objetos literais inline (`movie={{ id, title, ... }}`) são recriados pela página pai.
  - Extrair e envolver em `React.memo` os itens de linha do Diário (cards mobile e linhas da tabela desktop) para que rolagens paginadas ou alterações no contexto não re-renderizem dezenas de entradas simultaneamente.
- **Listeners Passivos e `requestAnimationFrame` em Gestos/Scroll**:
  - Garantir `{ passive: true }` em todos os listeners `touchstart`, `touchend`, `touchcancel` e `scroll` que não chamam `preventDefault()`.
  - Sincronizar atualizações de estado visual durante o arrasto do `PullToRefresh` via `requestAnimationFrame` e evitar leituras de layout (`getBoundingClientRect` / `getComputedStyle`) no caminho crítico de cada toque quando o valor já está medido para a rota atual.

---

## 4. Plano de Verificação

1. **Resumo de Otimizações 120Hz**: Listagem objetiva dos componentes, pipelines de imagem e regras CSS otimizados.
2. **Validação de Compilação e Lint**: Execução do build e checagem estática garantindo zero erros de TypeScript/ESLint e zero regressões visuais ou funcionais.
