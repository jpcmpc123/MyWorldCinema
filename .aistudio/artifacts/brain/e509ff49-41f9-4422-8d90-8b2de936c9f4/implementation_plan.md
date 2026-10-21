# Transição em Slide e Carregamento Imediato de Filmes/Séries

Implementar a abertura de pôsteres de filmes e séries no celular com animação em slide deslizando da esquerda para a direita, eliminando o spinner circular verde e exibindo instantaneamente os dados do pôster com carregamento progressivo do restante dos detalhes em segundo plano.

> [!IMPORTANT]
> **Decisões confirmadas com o usuário nas perguntas de alinhamento:**
> 1. **Eliminação do spinner redondo**: Ao tocar no pôster, a página abre de imediato renderizando as informações já disponíveis (título, pôster em alta resolução, ano e sinopse básica se houver), preenchendo elenco, ficha técnica, onde assistir e notas suavemente sem nenhuma roda de carregamento girando.
> 2. **Escopo da transição**: O efeito de slide vindo da esquerda para a direita será aplicado no ambiente mobile (`max-width: 767px`), mantendo a transição limpa e estável no desktop.

---

### 1. Visão Geral e Conceito Principal

- **O que faz**: Transforma a navegação de abertura de um filme ou série ao tocar em qualquer pôster (Home, Filmes, Séries, Pesquisa, Perfil, Diário ou Listas). Em vez de uma tela vazia com um círculo giratório (`animate-spin`), a tela de detalhes entra instantaneamente através de um slide lateral vindo da esquerda para a direita no celular.
- **Público-alvo**: Usuários em dispositivos móveis que navegam pelo catálogo e esperam a sensação tátil, ágil e fluida de um aplicativo nativo moderno (estilo Letterboxd / iOS).
- **Valor agregado**: Elimina a percepção de latência de rede ("zero perceived wait time"), mantendo a continuidade visual entre o pôster tocado e a tela de detalhes.

---

### 2. Experiência do Usuário e Design Visual

- **Fluxo do Usuário**:
  1. O usuário toca no pôster de um filme ou série em qualquer vitrine, carrossel ou grade mobile.
  2. A tela desliza da esquerda para a direita (`translateX(-100%)` até `translateX(0)`) com curva suave de desaceleração (`cubic-bezier(0.22, 1, 0.36, 1)` a 260ms), gerando efeito fluido a 60fps sem repinturas pesadas.
  3. O topo da página de detalhes já exibe imediatamente o pôster correspondente, título, ano e estrutura principal sem piscar.
  4. Detalhes aprofundados (elenco completo, equipe técnica, plataformas de streaming, filmes similares e avaliações) carregam em segundo plano e entram suavemente via fade progressivo, sem qualquer spinner circular giratório.

- **Identidade Visual e Animações**:
  - **Direção Estética**: Minimalismo escuro cinematográfico (Letterboxd dark aesthetic), paleta `#14181C` dominante, tipografia serifada editorial nos títulos e Inter no corpo.
  - **Motion Design**:
    - Animação mobile dedicada `.mw-slide-in-left` com aceleração por GPU (`will-change: transform`, `transform: translate3d(...)`).
    - Remoção global do spinner circular (`border-lb-green animate-spin`) nas telas de filme e série, substituindo por esqueletos escuros com gradiente estático ou preenchimento instantâneo dos campos.
    - Suporte a `prefers-reduced-motion` para acessibilidade.

---

### 3. Decisões Técnicas e Trade-Offs

- **Decisão 1: Transferência Imediata de Estado (Router State Cache)**
  - *Abordagem Escolhida*: Ao clicar em um `PosterCard`, o objeto do filme já em memória (`title`, `poster_path`, `release_date`, `vote_average`, etc.) é passado via `state` do `react-router-dom` (`<Link to="..." state={{ previewMovie: movie }}>`).
  - *Por que*: Permite que o `FilmPage` e `SeriesDetailPage` inicializem seu estado visual instantaneamente no primeiro milissegundo de renderização, antes mesmo da promessa do TMDB resolver.
  - *Alternativa descartada*: Esperar o `fetch` completo do TMDB antes de navegar (atrasaria o clique do usuário em centenas de milissegundos).

- **Decisão 2: Remoção do Fallback de Loading com Spinner Redondo**
  - *Abordagem Escolhida*: O componente `FilmPage` deixa de retornar o bloco de tela cheia com `<div className="w-10 h-10 border-3 border-lb-green border-t-transparent rounded-full animate-spin" />`. Ele sempre renderiza a casca completa da página com os dados já conhecidos, usando shimmer escuro apenas nas seções secundárias que ainda aguardam payload.
  - *Por que*: O usuário solicitou explicitamente a remoção do carregamento redondo em favor de exibição imediata.

---

### 4. Arquitetura Técnica e Estratégia de Dados

#### Diagrama de Sequência e Componentes

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuário toca em PosterCard no Mobile                      │
│    (Home / Filmes / Séries / Busca / Perfil)                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. PosterCard dispara navegação para /film/:id ou /tv/:id   │
│    - state: { initialMovie: movie, fromPoster: true }       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. FilmPage monta no Mobile                                 │
│    - Aplica classe `.mw-slide-in-left` (slide esq. -> dir.) │
│    - Inicializa `movie` com dados iniciais do state         │
│    - ZERO spinner circular na tela                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Busca detalhes complementares em background (TMDB)       │
│    - Sinopse completa, diretores, elenco, streaming         │
│    - Dados entram com transição suave (fade-in)             │
└─────────────────────────────────────────────────────────────┘
```

#### Arquivos Envolvidos na Implementação
1. `src/index.css`: Definição da keyframe e classe de animação `.mw-slide-in-left` (apenas para telas móveis, usando transform e opacidade de alto desempenho).
2. `src/components/PosterCard.tsx`: Inclusão do `state={{ initialMovie: movie }}` no `Link` de navegação do pôster.
3. `src/pages/FilmPage.tsx`:
   - Leitura do `location.state?.initialMovie` para alimentar imediatamente o estado.
   - Remoção do bloco com spinner redondo no carregamento.
   - Aplicação da classe de slide no container principal em mobile.
4. `src/pages/SeriesDetailPage.tsx`: Ajuste análogo de remoção de spinner e aplicação de carregamento imediato caso a rota direta de série seja acionada.
