# Visualização Ampliada do Pôster na Página de Filme e Série

Implementação do visualizador de pôster (`PosterLightbox`) ao tocar/clicar no pôster dentro da página de detalhes de um filme ou série (`/film/:id` e `/tv/:id`), reproduzindo fielmente o visual e os gestos de celular e PC mostrados nas imagens de referência.

---

## Mudanças Propostas

### 1. Componente `PosterLightbox` (`src/components/PosterLightbox.tsx`)
- **Versão PC (`md+`)**:
  - Fundo escuro translúcido com desfoque suave da página atrás (`bg-[#14181c]/85 backdrop-blur-md`).
  - Pôster em alta resolução (`w780` / `original`) centralizado na tela (`max-h-[82vh] aspect-[2/3] shadow-2xl`).
  - Botão circular `✕` no canto superior direito (`w-10 h-10 rounded-full bg-[#2c3440]/80 hover:bg-[#3a4550] text-[#99aabb] hover:text-white`).
  - Fecha ao clicar no botão `✕`, ao clicar fora do pôster ou ao pressionar a tecla `ESC`.
- **Versão Celular (`< 768px`)**:
  - Pôster ocupando toda a largura da tela (`w-full aspect-[2/3]`) centralizado verticalmente sobre a página escurecida (`bg-black/65`), mantendo a página visível ao fundo no topo e na base como na referência mobile.
  - **Zoom no pôster**: Suporte a pinça com dois dedos (*pinch-to-zoom* de `1x` até `4x`) e duplo-toque (*double-tap*) para dar zoom in/out com pan livre quando ampliado.
  - **Arrastar para baixo para fechar (*Swipe-down to dismiss*)**: Quando em escala normal (`1x`), arrastar o pôster verticalmente para baixo acompanha o dedo em 60/120fps com redução progressiva da opacidade do fundo, fechando ao soltar após o limiar (ou voltando suavemente se soltar antes), além de fechar ao tocar na área escura fora do pôster.

### 2. Integração na Página de Filme/Série e Gaveta de Ações (`src/pages/FilmPage.tsx` e `src/components/ActionBottomSheet.tsx`)
- Em `FilmPage.tsx`:
  - Tornar o pôster de PC (`230x345px` na coluna esquerda) clicável (`cursor-pointer`) para abrir o `PosterLightbox`.
  - Tornar o pôster compacto de celular (`86px` à direita do cabeçalho) clicável para abrir o `PosterLightbox`.
- Em `ActionBottomSheet.tsx`:
  - Conectar a opção **"Ver pôster"** (*View poster*) da gaveta de ações mobile para abrir o `PosterLightbox` diretamente no app em vez de abrir uma aba externa.
