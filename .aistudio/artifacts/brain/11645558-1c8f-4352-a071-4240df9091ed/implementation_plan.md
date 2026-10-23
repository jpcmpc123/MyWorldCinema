# Backdrop Mobile Sem Degradê no Topo e Integrado à Barra de Horas (Edge-to-Edge)

Remover completamente qualquer degradê ou escurecimento na parte superior do backdrop no celular e configurar o layout mobile em tela cheia (*edge-to-edge*) para que a imagem do backdrop suba limpa até o topo da tela, por trás da barra de horas e notificações, exatamente como na referência da Imagem 1, mantendo o computador (desktop) inalterado.

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisões confirmadas pelas suas respostas:

- **Zero degradê ou efeito no topo do backdrop (Confirmado)**: O degradê preto superior (`to bottom, #000000 ...`) que havia sido aplicado no topo do backdrop mobile será totalmente removido. A parte superior da imagem ficará 100% limpa e sem efeito.
- **Nenhum escurecimento na parte superior (Confirmado)**: O backdrop manterá apenas a fusão inferior com o fundo `#14181c` (onde entram o título e o pôster), deixando o topo da fotografia com brilho e cores originais.
- **Escopo exclusivo no celular (Confirmado)**: Todas as alterações serão aplicadas estritamente na visualização mobile (`max-width: 767px` / PWA mobile), sem tocar no layout do computador (`>= 768px`).

## 1. Overview & Core Concept

- **O que será feito**:
  1. **Remoção total do degradê escuro no topo do backdrop mobile**: Na máscara `.backdrop-wrapper > .backdropmask:before` para telas mobile (`max-width: 767px`), será removida a camada `linear-gradient(to bottom, #000000 0%, ...)`, preservando apenas o degradê da base (`to top, #14181c ...`).
  2. **Integração com a barra de horas e notificações (Edge-to-Edge Mobile)**:
     - Configurar a barra de status do PWA mobile para modo translúcido/transparente (`apple-mobile-web-app-status-bar-style="black-translucent"` e `theme-color` transparente nas páginas de filme e série no celular) junto com `viewport-fit=cover`.
     - Garantir que o container do backdrop nas páginas de Filme e Série comece no limite absoluto do topo da tela (`top: 0`, cobrindo inclusive a área `env(safe-area-inset-top, 0px)` da barra de horas e notificações), posicionando os botões flutuantes de voltar (`←`) e menu (`⋮`) logo abaixo da área segura das horas.
     - Ativar também o modo *edge-to-edge* com barra de status transparente na configuração Android do projeto para que a imagem ocupe toda a faixa atrás do relógio e ícones de notificação.

## 2. User Experience & Visual Design

- **Topo do Backdrop Limpo (Como na Imagem 1)**:
  - Ao abrir qualquer página de filme (`/film/:id`) ou série (`/tv/:id`) no celular, a imagem do backdrop aparece nítida e sem nenhuma faixa ou sombra preta artificial no topo.
  - A imagem se estende até a borda superior da tela em dispositivos com suporte a *edge-to-edge* (`viewport-fit=cover`), enquanto a base do backdrop continua se fundindo suavemente na cor `#14181c` atrás do título e do pôster.
- **Botões Flutuantes (`←` e `⋮`)**:
  - Os dois botões circulares continuam sobre o backdrop no celular, respeitando automaticamente o espaçamento da barra de horas (`env(safe-area-inset-top)`) quando o conteúdo desenha por trás das notificações.

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Máscara Mobile Apenas na Base**
  - *Abordagem Escolhida*: Usar exclusivamente `linear-gradient(to top, #14181c 0%, #14181c 3%, rgba(20, 24, 28, 0.9) 10%, rgba(20, 24, 28, 0.55) 20%, rgba(20, 24, 28, 0.2) 32%, transparent 42%)` em `@media (max-width: 767px)`.
  - *Por quê*: Elimina qualquer escurecimento ou linha escura no topo da foto, mantendo a transição suave apenas na parte inferior onde começa o texto do filme.
- **Decisão 2: Barra de Status Transparente Dinâmica nas Rotas de Detalhe**
  - *Abordagem Escolhida*: Nas rotas `/film/:id` e `/tv/:id` no celular, atualizar dinamicamente as metatags `theme-color` para transparente e configurar `black-translucent`, restaurando `#000000` nas demais telas que possuem cabeçalho preto sólido.
  - *Por quê*: Permite que o navegador/PWA mobile não pinte um bloco preto sólido separado quando em modo *edge-to-edge*, mantendo a barra superior preta nas telas de catálogo e busca.

## 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────────────┐
│                   Visualização Mobile (< 768px)                      │
│       (Desktop >= 768px permanece 100% inalterado)                   │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│            Páginas de Detalhe (/film/:id e /tv/:id)                  │
│  1. Meta theme-color transparente + status-bar black-translucent     │
│  2. Backdrop ancorado no topo absoluto (sem degradê no topo)         │
│  3. Botões flutuantes (← e ⋮) posicionados abaixo da safe-area-top   │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 Máscara CSS (.backdropmask:before)                   │
│  • Topo (0% -> 58%): 100% Transparente (nenhum escurecimento)        │
│  • Base (58% -> 100%): Fusão suave para #14181c atrás do título      │
└──────────────────────────────────────────────────────────────────────┘
```
