# Plano de Implementação: Modo Carrossel Suave (Catálogo/Filtros e Listas)

## Objetivo
Adicionar o botão de **Carrossel** ao lado do botão de **Filtros** no cabeçalho mobile das páginas de catálogo/resultados (`BrowseResultsPage`) — deixando apenas os dois ícones à direita do título, exatamente como nos prints — e implementar o visualizador de **Carrossel em Tela Cheia** ultra-suave com fundo desfocado dinâmico e barra inferior de 4 ações (**Watch**, **Like**, **Rate**, **Watchlist**), atualizando também o carrossel existente nos 3 pontinhos das **Listas** (`ListDetailPage`).

---

## Alterações Planejadas

### 1. Novo Componente Reutilizável de Carrossel (`src/components/mobile/PosterCarouselModal.tsx`)
- **Fundo Dinâmico Desfocado**:
  - Exibe o pôster do filme/série ativo ampliado e com desfoque suave (`blur-2xl scale-125 opacity-55`) sobre fundo escuro (`#14181c`), acompanhando em tempo real a troca de pôster durante o deslize.
- **Cabeçalho Superior**:
  - **Título** centralizado em destaque e **Ano de lançamento** logo abaixo (incluindo a posição `#1`, `#2` quando aberto a partir de uma lista ranqueada).
  - Botão de fechar (`✕`) alinhado à direita, respeitando o `safe-area-inset-top`.
- **Deslize Horizontal Ultra-Suave (Swipe Track)**:
  - Carrossel horizontal nativo com aceleração de hardware (`snap-x snap-mandatory overflow-x-auto no-scrollbar`) e espaçamento lateral (`px-[12vw] gap-4`) que mantém o pôster principal centralizado e mostra as bordas dos pôsteres vizinhos durante o movimento.
  - Cálculo instantâneo do item ativo via `requestAnimationFrame` no evento de rolagem para atualizar título, ano, fundo desfocado e status dos botões sem atraso.
  - Toque no pôster central abre a página de detalhes do filme ou série (`/film/:id` ou `/tv/:id`).
  - Carregamento automático de mais itens quando o usuário se aproxima do final da lista no catálogo (`onReachEnd`).
- **Barra Inferior com 4 Ações Rápidas**:
  1. **Watch (Assistido)**: Ícone de olho (`Eye`), fica verde (`#00e054`) quando marcado como assistido (`toggleWatched`).
  2. **Like (Curtir)**: Ícone de coração (`Heart`), fica laranja (`#ff8000`) quando curtido (`toggleLikeMovie`).
  3. **Rate (Avaliar)**: Ícone de estrela (`Star`), exibe a nota atual ou abre seletor rápido de estrelas (0.5 a 5 estrelas com suporte a meia estrela) logo acima da barra para avaliar instantaneamente (`setMovieRating`).
  4. **Watchlist**: Ícone de relógio com selo `+` quando fora da Watchlist e relógio azul preenchido (`#40bcf4`) com selo `-` quando adicionado à Watchlist (`toggleWatchlist`), idêntico aos prints enviados.

### 2. Cabeçalho Mobile do Catálogo e Filtros (`src/pages/BrowseResultsPage.tsx`)
- Na barra superior mobile, manter à direita do título **apenas**:
  1. **Botão de Carrossel** (ícone de card central maior ladeado por dois cards menores).
  2. **Botão de Filtros** (ícone de 3 linhas horizontais em formato de funil, com indicador verde quando houver filtros ativos).
- Conectar o botão de Carrossel ao novo `<PosterCarouselModal />`, passando os filmes/séries filtrados atuais e carregando mais páginas automaticamente ao deslizar até o fim.

### 3. Atualização do Carrossel nas Listas (`src/pages/ListDetailPage.tsx`)
- Substituir o modal de carrossel antigo acionado pela opção **"Ver em carrossel"** no menu de 3 pontinhos (`⋮`) pelo novo `<PosterCarouselModal />`, garantindo o mesmo visual com fundo desfocado e os 4 botões de ação na parte inferior.
