# Polimento de Suavidade Visual e Tátil (Experiência Nativa a 120Hz)

Elevação da experiência visual e física do aplicativo para alcançar suavidade de nível nativo a 120Hz em mobile e desktop, combinando fade-in inteligente em imagens (zero pop-in na rede e exibição instantânea em 0ms quando em cache), resposta física imediata ao toque, curvas de inércia nativa em abas/modais e rolagem bidirecional sem atrito nos carrosséis horizontais.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Guardrails de Layout e Performance**: Nenhuma propriedade `content-visibility: auto` ou `contain-intrinsic-size` será readicionada aos cards de pôsteres, preservando a altura compacta exata dos carrosséis horizontais. Todas as otimizações de nitidez Retina (`srcSet` `w500`/`w780`, `decoding="async"`, `React.memo`) e a identidade visual Letterboxd permanecem intactas.

- **Decisão Confirmada 1 — Alcance do Fade-in Inteligente (300ms ease-out + Cache 0ms)**: Aplicar o carregamento suave de opacidade (`opacity-0` -> `opacity-100` em `300ms ease-out`) em todos os pôsteres, backdrops e avatares do aplicativo, verificando `img.complete && img.naturalWidth > 0` (e o cache em memória da sessão) na montagem para renderizar instantaneamente sem piscar caso a imagem já esteja no cache.
- **Decisão Confirmada 2 — Curvas de Inércia Nativa e Micro-interações Táteis**: Padronizar modais, gavetas inferiores (bottom sheets), popovers, barra de abas (`FILMES`, `SÉRIES`, `CRÍTICAS`, `LISTAS` e abas de perfil/pessoa) e navegação inferior com a curva de desaceleração nativa `cubic-bezier(0.32, 0.72, 0, 1)`, além de feedback físico ao toque (`active:scale-[0.96]` no mobile e `hover:scale-[1.02]` em `@media (hover: hover)` no desktop com `cubic-bezier(0.22, 1, 0.36, 1)`).

---

## 1. Overview & Core Concept

- **O Que Entrega**: Uma camada de polimento sensorial de 120Hz onde imagens surgem suavemente sem saltos visuais, botões e pôsteres respondem fisicamente no primeiro frame do toque (sem atraso de 300ms), modais e abas desaceleram com inércia natural de sistema operacional móvel e carrosséis permitem rolar a página verticalmente sem prender o gesto.
- **Público e Contexto**: Usuários navegando rapidamente por catálogos densos de filmes e séries em telas OLED/ProMotion de 120Hz no celular e monitores de alta taxa de atualização no desktop.
- **Valor Principal**: Eliminação de cortes secos, flashes de imagem e atrito de toque, mantendo 100% da fidelidade visual e estrutural do layout atual.

---

## 2. User Experience & Visual Design

- **Fluxos de Experiência do Usuário**:
  1. **Carregamento de Imagens (Zero Pop-in Brusco)**: Ao abrir a Home ou rolar por grades de filmes, pôsteres inéditos fazem uma transição suave de `opacity-0` para `opacity-100` (`300ms ease-out`) sobre o fundo ardósia `#232a31`. Ao voltar para uma aba já visitada, a checagem imediata de cache (`imgRef.current?.complete && naturalWidth > 0`) exibe a imagem em `opacity-100` no primeiro frame, sem piscar.
  2. **Toque e Micro-interações Físicas**: Tocar em qualquer pôster ou botão principal comprime sutilmente o elemento (`scale3d(0.96, 0.96, 1)`) sem atraso (`touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`). No desktop (`@media (hover: hover)`), passar o mouse aplica um leve realce (`scale3d(1.02, 1.02, 1)`) com curva elástica `cubic-bezier(0.22, 1, 0.36, 1)`.
  3. **Transições de Abas, Páginas e Modais**: A abertura de gavetas, modais, popovers e o deslize das abas utilizam a desaceleração nativa `cubic-bezier(0.32, 0.72, 0, 1)`, enquanto o conteúdo de páginas e abas realiza uma entrada suave (`opacity: 0 -> 1` e `translateY(4px) -> translateY(0)` em `180ms`) que libera o `transform` ao final para não afetar elementos `position: fixed`.
  4. **Rolagem Híbrida nos Carrosséis**: O usuário pode iniciar um movimento vertical de rolagem mesmo com o polegar sobre um carrossel horizontal (`pan-x pan-y`, `-webkit-overflow-scrolling: touch`, `overscroll-behavior-x: contain`), sem barras de rolagem aparentes.
- **Identidade Visual & Tema**:
  - *Direção Estética*: Preservação integral da estética escura cinematográfica inspirada no Letterboxd (`#14181c`, `#1c2228`, `#2c3440`, verde `#00e054`, azul `#40bcf4`, laranja `#ff8000`).
  - *Tipografia e Geometria*: Mantidas sem qualquer alteração de fontes, tamanhos, bordas ou proporções `2:3`.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Detecção Híbrida de Cache (`Set` em Memória + `img.complete`)**
  - *Abordagem Escolhida*: Combinar a verificação síncrona de `imgRef.current?.complete && imgRef.current?.naturalWidth > 0` com o registro em memória de URLs já decodificadas na sessão.
  - *Por Quê*: Garante que imagens vindas da rede tenham um fade-in elegante de `300ms ease-out`, enquanto imagens já em cache apareçam instantaneamente sem repetir a animação ao alternar abas.
- **Decisão 2: Liberação de `transform` Pós-Animação em Páginas (`mwFadeInUp`)**
  - *Abordagem Escolhida*: Animar `opacity: 0 -> 1` e `translateY(4px) -> translateY(0)` em `180ms` sem `animation-fill-mode: forwards`.
  - *Por Quê*: Uma vez concluída a animação de 180ms, o elemento volta ao estado natural (`transform: none`), impedindo a criação de um containing block que deslocaria modais ou gavetas `position: fixed`.

---

## 4. Technical Architecture & Data Strategy

### Arquitetura de Polimento e Fluidez 120Hz

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CAMADA GLOBAL DE INTERAÇÃO (CSS)                     │
│  • touch-action: manipulation & -webkit-tap-highlight-color: transparent│
│  • Curva nativa iOS: --mw-ease-sheet: cubic-bezier(0.32, 0.72, 0, 1)    │
│  • Curva elástica:   --mw-ease:       cubic-bezier(0.22, 1, 0.36, 1)    │
└───────────────────┬───────────────────────────────┬─────────────────────┘
                    │                               │
                    ▼                               ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────┐
│   PIPELINE DE IMAGENS (ZERO POP-IN)   │ │ NAVEGAÇÃO, ABAS E MODAIS      │
│  • PosterCard / Backdrops / Avatares  │ │ • TabViewPager & tabIndicator │
│  • Cache hit (complete): opacity-100  │ │ • ActionBottomSheet & Modals  │
│  • Rede (onLoad): fade-in 300ms       │ │ • Transição de página 180ms   │
│  • Press: scale(0.96) / Hover: (1.02) │ │   (opacity + translateY 4px)  │
└───────────────────┬───────────────────┘ └───────────────┬───────────────┘
                    │                                     │
                    └─────────────────┬───────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             CARROSSÉIS HORIZONTAIS ([data-h-scroll="true"])             │
│  • align-items: flex-start (sem content-visibility nos cards)           │
│  • -webkit-overflow-scrolling: touch & overscroll-behavior-x: contain   │
│  • touch-action: pan-x pan-y & scrollbar-width: none                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Mapeamento Interativo de Componentes e Estados

- **Pôsteres, Backdrops e Avatares**:
  - `PosterCard`: Transição da imagem ajustada para `transition-opacity duration-300 ease-out` com detecção instantânea via `imgRef.current?.complete && imgRef.current?.naturalWidth > 0`. Feedback tátil `.poster-card-optimized` com `active:scale-[0.96]` no toque e `hover:scale-[1.02]` restrito a `@media (hover: hover) and (min-width: 768px)` (desativado quando o popover de menu do card está aberto para não deslocar o menu).
  - `Backdrop` e imagens secundárias (miniaturas de Diário, Busca, Perfil, Carrossel Similar e Filmografia de Pessoa): recebem fade-in suave de `300ms ease-out` com verificação imediata de cache (`complete`).
- **Abas, Navegação Inferior e Modais**:
  - `TabViewPager`, `ActorTabPanel`, `tabIndicator`, `ActionBottomSheet`, `LogModal`, `PosterLightbox` e barra `.bottom-nav`: padronizados com `cubic-bezier(0.32, 0.72, 0, 1)` para desaceleração contínua e natural.
  - Entrada de conteúdo (`.mw-page-in` / `.mw-fade`): anima `opacity: 0 -> 1` e `transform: translateY(4px) -> translateY(0)` em `180ms cubic-bezier(0.32, 0.72, 0, 1)` sem reter `transform` após o término.
- **Carrosséis Horizontais (`[data-h-scroll="true"]`, `.similar-carousel`)**:
  - Configurados com `scrollbar-width: none`, `::-webkit-scrollbar { display: none; }`, `-webkit-overflow-scrolling: touch`, `overscroll-behavior-x: contain` e `touch-action: pan-x pan-y`, permitindo rolagem vertical fluida mesmo quando o toque começa sobre um trilho horizontal.
