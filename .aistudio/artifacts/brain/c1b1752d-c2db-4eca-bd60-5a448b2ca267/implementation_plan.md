# Página de Filmes e Séries Semelhantes no PC (Estilo Letterboxd)

Reformulação da visualização desktop (`md+`) de Filmes e Séries Semelhantes para reproduzir fielmente o layout de duas colunas do Letterboxd — incluindo as 3 abas interativas (**ALL / TODOS**, **THEMES / TEMAS**, **NANOGENRES / NANOGÊNEROS**), barra de filtros rápidos (**DECADE**, **SERVICE**, **👁 Watched**) e a coluna lateral com o pôster grande da obra de origem sobreposto ao mini-backdrop em vinheta — mantendo o layout mobile (`< 768px`) intacto.

## Revisão e Decisões Confirmadas

> [!IMPORTANT]
> As escolhas abaixo foram confirmadas com base nas respostas e nas imagens de referência enviadas:

- **Escopo confirmada para Filmes e Séries no PC**: O novo layout de duas colunas com pôster lateral, estatísticas e mini-backdrop será exibido tanto para **Filmes Semelhantes** quanto para **Séries Semelhantes** no desktop (`md+`), preservando a grade de 4 colunas com barra preta no celular.
- **Três abas completas (`ALL`, `THEMES`, `NANOGENRES`)**:
  - **ALL (Todos)**: Exibe a faixa informativa (*"Existem N filmes semelhantes a [Título]."* / *"There are N films similar to [Title]."*) e a grade de **5 colunas** de pôsteres.
  - **THEMES (Temas)**: Agrupa obras semelhantes em seções temáticas baseadas nos gêneros e temas da obra principal, cada seção com título em destaque, contagem de títulos ao lado e uma grade compacta de **8 colunas × 2 linhas (16 pôsteres)**.
  - **NANOGENRES (Nanogêneros)**: Agrupa combinações de 3 palavras-chave/tags da obra (ex.: *"Gory, Ghosts, Thrills"* + contagem de filmes) seguidas por grades de **8 colunas × 2 linhas (16 pôsteres)** que compartilham esses elementos.

---

## 1. Visão Geral e Conceito

- **O que faz**: Transforma a página de obras semelhantes no computador em uma página dedicada no padrão Letterboxd, conectada aos dados reais da obra de origem (título, ano, pôster, backdrop, estatísticas, gêneros e palavras-chave do TMDB).
- **Público e Contexto**: Usuários navegando no PC que clicam na seção *"Filmes Semelhantes"* / *"Séries Semelhantes"* dentro da página de um filme ou série.
- **Valor Principal**: Oferece descoberta visual rica por similaridade direta (**ALL**), por atmosferas e temas (**THEMES**) e por micro-combinações de tags (**NANOGENRES**), sem perder os filtros de década, serviço de streaming e status de assistido.

---

## 2. Experiência do Usuário e Design Visual

- **Fluxo do Usuário**:
  1. Na página de um filme ou série no PC, o usuário clica no cabeçalho *"Filmes Semelhantes"* / *"ALL"* (ou *"Séries Semelhantes"*).
  2. A página abre no layout de duas colunas (`950px` centralizados):
     - **Topo Direito**: Mini-backdrop da obra de origem com máscara de vinheta suave fundindo-se ao fundo `#14181c`.
     - **Coluna Principal (Esquerda, `670px`)**:
       - Kicker em caixa alta (`SIMILAR FILMS FOR` / `FILMES SEMELHANTES A`) + título em fonte serifada negrito (`26px`) + ano de lançamento (`18px`), clicáveis para voltar à página da obra.
       - Barra de navegação com borda inferior (`#2c3440`): à esquerda as abas `ALL`, `THEMES` e `NANOGENRES` (aba ativa branca com sublinhado branco; inativas em verde `#00e054`); à direita os menus dropdown `DECADE ⌄`, `SERVICE ⌄` e `👁 ⌄`.
       - Conteúdo dinâmico conforme a aba selecionada (`ALL` em 5 colunas; `THEMES` e `NANOGENRES` em seções de 8 colunas × 2 linhas).
     - **Coluna Lateral (Direita, `230px`)**:
       - Pôster oficial (`230×345px`) posicionado sobre a base do mini-backdrop.
       - Linha de estatísticas (`👁 assistidos`, `⊞ avaliações`, `🧡 curtidas`).
       - Link de ação com borda superior/inferior (`Browse all similar films ›` / `Explorar todos os filmes semelhantes ›`).
       - Crédito discreto `POWERED BY Nanocrowd` no rodapé da barra lateral (sem anúncios).

- **Identidade Visual e Tema**:
  - *Paleta*: Fundo principal `#14181c`, faixa informativa `#283038`, divisórias `#2c3440`, texto secundário `#99aabb`, destaque de abas inativas `#00e054`, títulos em `#ffffff`.
  - *Tipografia*: Título da obra em `--font-serif` (`Tiempos Headline` / `Playfair Display`) 700; cabeçalhos de seção temática em sans-serif `16px` semibold com contagem em `#778899`.

---

## 3. Decisões de Produto e Arquitetura

- **Decisão 1: Geração Real de Seções para `THEMES` e `NANOGENRES` via TMDB**
  - *Abordagem Escolhida*: Ao abrir a página com `similarTo`, carregamos os detalhes da obra de origem (`getMovieDetails` / `getTVDetails`, que já trazem `genres`, `keywords` e `recommendations`/`similar`). Para **THEMES**, construímos seções combinando os gêneros e temas principais da obra e buscando/agrupando títulos correspondentes via `discover` por gênero/keyword. Para **NANOGENRES**, agrupamos trios de palavras-chave (`keywords`) da obra (ex.: *"Gory, Ghosts, Thrills"*) e populamos cada bloco com 16 pôsteres (2 fileiras de 8 colunas).
  - *Por quê*: Garante que qualquer filme ou série do catálogo tenha abas `THEMES` e `NANOGENRES` reais, ricas e fiéis às imagens de referência.
- **Decisão 2: Preservação Total do Mobile (`< 768px`)**
  - *Abordagem Escolhida*: O layout de duas colunas é exclusivo para telas `md+` (`>= 768px`) quando `similarTo` está presente; no celular, a visualização com barra superior preta e grade de 4 colunas permanece inalterada.

---

## 4. Arquitetura Técnica e Estratégia de Dados

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         BrowseResultsPage (similarTo)                     │
├───────────────────────────────────────────────┬───────────────────────────┤
│ Coluna Principal (670px, Desktop md+)         │ Sidebar Direita (230px)   │
│  ├─ Cabeçalho: SIMILAR FILMS FOR + Título/Ano │  ├─ Mini-Backdrop Vignette│
│  ├─ Barra de Abas & Filtros:                  │  ├─ Pôster (230×345px)    │
│  │   [ALL | THEMES | NANOGENRES]              │  ├─ Stats (👁 / ⊞ / 🧡)   │
│  │   [DECADE ⌄] [SERVICE ⌄] [👁 ⌄]            │  ├─ Link: Browse all ›    │
│  ├─ Aba ALL:                                  │  └─ Powered by Nanocrowd  │
│  │   ├─ Banner: "There are N films similar…"  │                           │
│  │   └─ Grade 5 colunas (PosterCard)          │                           │
│  ├─ Aba THEMES:                               │                           │
│  │   └─ Seções Temáticas (8 cols × 2 linhas)  │                           │
│  └─ Aba NANOGENRES:                           │                           │
│      └─ Trios de Keywords (8 cols × 2 linhas) │                           │
└───────────────────────────────────────────────┴───────────────────────────┘
```

- **Mapeamento de Estado e Interatividade**:
  - `activeSubTab ('all' | 'themes' | 'nanogenres')`: alterna instantaneamente entre a grade de 5 colunas (`all`) e as seções agrupadas de 8 colunas (`themes` e `nanogenres`).
  - `decadeDropdown` / `serviceDropdown` / `watchedDropdown`: menus suspensos no cabeçalho da barra que atualizam os parâmetros da URL (`decade`, `service`, `watched`, `fade`) e filtram os títulos exibidos em tempo real.
  - `sourceDetails`: armazena os metadados da obra de origem (título, ano, pôster, backdrop, votos, gêneros e keywords) para alimentar o cabeçalho, a sidebar e as abas `THEMES` e `NANOGENRES`.
