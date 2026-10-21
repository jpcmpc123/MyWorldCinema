# Fluidez em 60/120fps na Animação da Barra Verde das Abas

Otimização da animação elástica da barra verde indicadora de abas para rodar de forma contínua na GPU em 60/120fps — eliminando engasgos, atrasos de quadros durante o arrasto com o dedo e a parada intermediária entre as fases de estiramento e encolhimento, sem alterar o visual, as cores, o tamanho ou o comportamento elástico da aba.

## User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo refletem exatamente as suas escolhas confirmadas e mantêm 100% da aparência e do comportamento atual da barra verde.

- **Decisão Confirmada 1 — Foco no Arrasto com o Dedo e Encaixe**: A otimização prioriza o acompanhamento em tempo real do dedo durante o swipe horizontal entre abas e o encaixe final ao soltar, além do toque direto nas abas.
- **Decisão Confirmada 2 — Mesmo Efeito Elástico e Mesma Velocidade em 60/120fps**: O efeito de esticar na direção do movimento e recolher a cauda (~280ms no total) será preservado exatamente com a mesma velocidade e estética, apenas rodando com taxa de quadros nativa sem travamentos.

---

## 1. Overview & Core Concept

- **O que faz**: Faz a barra verde sob as abas (Filmes, Séries, Críticas, Listas, abas do Perfil e abas de Pessoa/Filme) acompanhar o dedo instantaneamente em cada quadro da tela (60Hz/120Hz) e concluir o movimento elástico sem engasgos na thread principal.
- **Público e Contexto**: Uso mobile e touch ao deslizar horizontalmente entre as abas ou tocar rapidamente para alternar seções.
- **Valor Principal**: Sensação tátil imediata e contínua de aplicativo nativo, eliminando a impressão de animação travada (~20fps) causada por refluxos de layout, re-renderizações durante o gesto e timers intermediários.

---

## 2. User Experience & Visual Design

- **Fluxo de Interação**:
  1. **Início do Arrasto**: Ao encostar e mover o dedo horizontalmente no conteúdo ou na própria faixa de abas, a barra verde responde no mesmo frame do toque, sem atraso inicial e sem disparar re-renderizações desnecessárias das abas vizinhas já expandidas.
  2. **Durante o Arrasto (Swipe Contínuo)**: A ponta dianteira avança suavemente em direção à aba vizinha enquanto a cauda segura na aba de origem, atualizando apenas `transform: translate3d(...) scaleX(...)` direto no compositor gráfico, sem consultas repetidas ao DOM ou leituras forçadas de geometria a cada pixel.
  3. **Ao Soltar o Dedo ou Tocar na Aba**: O encaixe elástico (esticar e recolher a cauda) executa em uma única linha de tempo contínua acelerada por hardware (280ms), sem pausar no meio do caminho enquanto a nova aba entra em foco.
- **Identidade Visual e Tema**:
  - *Estética e Geometria Inalteradas*: A barra verde mantém exatamente a cor `#00e054`, altura de `4px`, bordas superiores arredondadas (`2px 2px 0 0`) e alinhamento cravado na largura da coluna ativa.
  - *Orçamento de Movimento*: Resposta imediata (latência zero no arrasto) e transição elástica de ~280ms usando exclusivamente propriedades de compositor (`transform`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1 — Animação Contínua na GPU (Web Animations API) em vez de 2 Fases com `setTimeout`**:
  - *Abordagem Escolhida*: Unificar as fases de estiramento e recolhimento da cauda em uma única animação contínua via Web Animations API (`Element.animate`) com keyframe intermediário de estiramento no compositor da GPU.
  - *Por quê*: O modelo anterior dividia a animação de 280ms em duas transições CSS separadas por um `setTimeout` de 85ms (~5 frames) e usava uma curva `cubic-bezier(0.4, 0, 0.2, 1)` na segunda fase que desacelerava a barra até quase parar aos 85ms antes de voltar a acelerar. Além disso, o `setTimeout` concorria com a navegação de rota do React na thread principal, atrasando a segunda fase e gerando a sensação visual de ~20fps.
  - *Alternativas Consideradas*: Manter duas transições CSS com `transitionend` ainda sofreria atraso quando a thread principal estivesse ocupada renderizando a nova aba e forçaria recálculo de estilo no meio do movimento.

- **Decisão 2 — Cache de Geometria e Eliminação de Refluxos Síncronos Durante o Swipe**:
  - *Abordagem Escolhida*: Pré-calcular e manter em cache as coordenadas (`left` e `width`) dos botões das abas no início do gesto e em redimensionamentos, aplicando as transformações do trilho e da barra verde diretamente no evento de toque sem `querySelectorAll` nem leituras de `offsetLeft`/`offsetWidth` a cada frame.
  - *Por quê*: Ler `offsetLeft`/`offsetWidth` imediatamente após alterar `style.transform` e classes CSS dentro do loop de arrasto força o navegador a recalcular o layout inteiro da página a cada frame (layout thrashing), derrubando a taxa de quadros no celular.

- **Decisão 3 — Atualização Direta no Frame de Toque e Sem Re-renderização Redundante**:
  - *Abordagem Escolhida*: Processar os eventos `touchmove` diretamente no frame nativo do toque (sem atrasar em um `requestAnimationFrame` secundário nem descartar micro-movimentos por trava de `lastX`), evitando chamadas redundantes de estado React (`peek`) quando os painéis adjacentes já estão montados e expandidos.
  - *Por quê*: Os eventos `touchmove` nos navegadores mobile já são sincronizados com o vsync da tela; postergá-los para o próximo `requestAnimationFrame` adiciona 1 frame de atraso e causa saltos visíveis na barra verde.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Diagrama de Arquitetura e Fluxo de Quadros (60/120fps)**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GESTO DE SWIPE / TOQUE NAS ABAS                      │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│   Durante Arrasto (Swipe)     │               │  Ao Soltar / Toque na Aba     │
│  (Sincronizado ao VSync)      │               │  (Encaixe Elástico 280ms)     │
└───────────────┬───────────────┘               └───────────────┬───────────────┘
                │                                               │
                ▼                                               ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│ Cache de Geometria das Abas   │               │ Web Animations API (GPU)      │
│ (Zero offsetLeft/DOM query    │               │ Keyframes contínuos:          │
│  durante os frames do gesto)  │               │  0%   -> Posição visual atual │
└───────────────┬───────────────┘               │  32%  -> Estiramento elástico │
                │                               │  100% -> Encaixe na aba alvo  │
                ▼                               └───────────────┬───────────────┘
┌───────────────────────────────┐                               │
│ Compositor GPU Direto         │◄──────────────────────────────┘
│ translate3d(X, 0, 0) scaleX() │
│ (Zero Layout Thrashing)       │
└───────────────────────────────┘
```

- **Mapeamento de Estado e Interação**:
  - **Cache de Geometria das Abas**: As medidas horizontais de cada aba são cacheadas quando o layout monta ou redimensiona e reutilizadas durante todos os frames do arrasto, eliminando chamadas a `querySelectorAll` e leituras de layout (`offsetLeft`/`offsetWidth`) durante o movimento do dedo.
  - **Interpolação Contínua no Arrasto (`followTabIndicator`)**: Cancela qualquer animação anterior na GPU sem forçar reflow síncrono repetido e aplica `translate3d` + `scaleX` diretamente a cada evento de movimento, sem deduplicação conflitante entre `pointermove` e `touchmove`.
  - **Transição Elástica em Keyframes na GPU (`animateElasticIndicator` e `settleTabIndicator`)**: Substitui o par `transition` + `setTimeout` por uma animação contínua no compositor com 3 quadros-chave (origem visual exata lida da matriz atual → pico de estiramento elástico → encaixe final na aba de destino), mantendo o estado final sincronizado sem saltos ou interrupções quando a rota muda.
