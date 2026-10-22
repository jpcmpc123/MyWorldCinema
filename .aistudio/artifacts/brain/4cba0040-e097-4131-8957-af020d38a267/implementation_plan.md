# Redesign da Página de Pessoas (Desktop Letterboxd Layout)

Reformulação do layout desktop da página de perfil de atores, diretores e equipe para reproduzir fielmente a estrutura visual e interativa do Letterboxd (conforme as imagens de referência 2 e 3), mantendo a experiência mobile atual intacta.

## User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo foram alinhadas e confirmadas na etapa de perguntas:

- **Escopo de Plataforma Confirmado**: Aplicar o novo layout exclusivamente na versão Desktop/PC (`>= 768px`), preservando integralmente o layout e a navegação por abas deslizantes do app no mobile.
- **Filtros Completos na Barra Superior Confirmados**: Incluir todos os menus inline no padrão Letterboxd: seletor de função (`ACTOR ⌄`) à esquerda e filtros `DECADE ⌄`, `GENRE ⌄`, `SERVICE ⌄`, `Sort by POPULARITY ⌄` e filtro de visualização de assistidos (`👁 ⌄`) à direita.
- **Biografia Sempre Visível com Fallback Confirmado**: Exibir a biografia diretamente abaixo da foto na coluna lateral direita (eliminando a aba "Bio" separada no PC), utilizando fallback automático em inglês (TMDB `en-US` e resumo da Wikipedia quando o TMDB não possuir texto) para garantir que perfis como o de Andrew Koji sempre apresentem biografia.

---

## 1. Overview & Core Concept

- **What It Does**: Transforma a página de pessoa no PC em um layout de duas colunas estilo Letterboxd (`950px` de largura total: coluna principal de `670px` à esquerda para cabeçalho, barra de filtros inline e grade de 5 pôsteres por linha; coluna lateral de `230px` à direita alinhada ao topo da barra de filtros/pôsteres contendo o retrato `2:3`, biografia expansível com botão `more` e links externos `TMDB` / `Wikipedia`).
- **Target Audience / Persona**: Usuários no desktop que exploram filmografias de atores, diretores e produtores e desejam filtrar rapidamente por função, década, gênero, serviço de streaming e status de filmes assistidos sem sair da grade principal.
- **Key Value**: Elimina a necessidade de alternar entre uma aba "Bio" isolada e as abas de filmes, mantendo o retrato e a biografia sempre visíveis ao lado da filmografia, com controles de filtragem compactos e fiéis à referência.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Abertura de Perfil no PC**: O usuário clica no nome de um ator, diretor ou membro da equipe. A página abre na função correspondente (ex.: `FILMS STARRING` + nome em destaque `Keira Knightley`) sem animação de slide no desktop.
  2. **Troca de Função via Dropdown (`ACTOR ⌄`)**: No canto esquerdo da barra de filtros, o usuário clica no botão da função ativa (ex.: `ACTOR ⌄`). Abre-se um menu flutuante estilizado em tom azul-ardósia claro (`#899aa9` / `#99aabb`) listando todas as funções da pessoa com a contagem de títulos ao lado da função principal (ex.: `Actor 70`, `Executive Producer`). Selecionar outra função atualiza imediatamente o cabeçalho (`FILMS DIRECTED BY`, `FILMS PRODUCED BY`, etc.) e a grade de pôsteres.
  3. **Filtragem Inline (`DECADE`, `GENRE`, `SERVICE`, `Sort by`, `👁`)**: À direita da mesma barra, menus dropdown limpos e sem caixas pesadas permitem filtrar por década, gênero, serviço de streaming (Netflix, Prime Video, Disney+, Apple TV+, Max), ordenação (Popularidade, Avaliação, Data de Lançamento) e visibilidade de títulos já assistidos pelo usuário (Mostrar todos, Ocultar assistidos, Mostrar apenas assistidos).
  4. **Leitura de Biografia e Links Externos**: Na coluna direita (`230px`), logo abaixo da foto (`230x345px`), a biografia aparece truncada de forma limpa com um link inline `more` (ou `mais`) que expande o texto completo no local, seguido por `More details at [TMDB] [Wikipedia]`.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Editorial cinematográfico escuro fiel ao Letterboxd desktop.
  - *Color Palette & Mood*: Fundo principal `--color-lb-bg` (`#14181c`), textos primários em branco (`#ffffff`), metadados e rótulos de filtro em cinza-azulado (`#99aabb` / `#667788`), menus dropdown abertos em cinza-azulado claro (`#899aa9` com hover escuro/branco) e destaque verde (`#00e054`) no anel de foco dos pôsteres.
  - *Typography & Hierarchy*: Rótulo superior `FILMS STARRING` em `12px` uppercase com `tracking-[0.08em]` em `#99aabb`; nome da pessoa em `28px` bold branco; controles da barra de filtros em `11px` uppercase com linha divisória inferior sutil (`border-b border-[#2c3440]`); biografia lateral em `12.5px` (`#778899` / `#99aabb`) com altura de linha confortável (`leading-[1.55]`).
  - *Component Styling & Layout*: Container centralizado de `950px` (`max-w-[950px]`), dividido no desktop em `670px` (coluna esquerda: cabeçalho + barra de filtros + grade de 5 colunas de pôsteres com `gap-2.5`) + `50px` de espaçamento + `230px` (coluna direita: retrato `230x345px` alinhado com o topo da grade de pôsteres + biografia + links externos).

- **Interactive Feedback & Motion**:
  - Abertura e fechamento instantâneo dos menus dropdown ao clicar ou ao clicar fora (`mousedown` / `Escape`).
  - Destaque visual claro quando qualquer filtro (`Decade`, `Genre`, `Service`, `Watched`) estiver ativo, incluindo opção rápida para limpar/redefinir no próprio menu.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Substituição das Abas Horizontais pelo Menu Dropdown de Função no Desktop**
  - *Chosen Approach*: No desktop, substituir a barra de abas (`Bio`, `Ator`, `Produção Executiva`) pelo dropdown `ACTOR ⌄` à esquerda da barra de filtros e posicionar a biografia permanentemente abaixo da foto na coluna direita.
  - *Why*: Reproduz exatamente as imagens 2 e 3 do Letterboxd, economizando espaço vertical e permitindo ler a biografia enquanto se navega pelos filmes de qualquer função.
  - *Alternatives Considered*: Manter abas horizontais no topo foi descartado por divergir diretamente do modelo visual solicitado nas imagens 2 e 3.

- **Decision 2: Fallback em Cascata para Biografia (PT → EN → Wikipedia)**
  - *Chosen Approach*: Caso a biografia em português no TMDB esteja vazia, buscar automaticamente a versão `en-US` no TMDB e, se ainda estiver vazia, consultar o resumo da API pública da Wikipedia (`rest_v1/page/summary`).
  - *Why*: Muitos atores e diretores possuem biografia em branco no TMDB em português ou até mesmo em inglês; o fallback garante que a coluna direita abaixo da foto nunca fique vazia.

- **Decision 3: Filtragem por Serviço de Streaming e Filmes Assistidos (`👁`)**
  - *Chosen Approach*: Integrar o filtro de visibilidade (`👁`) diretamente com o estado `isMovieWatched` do `AppContext` e o filtro de `Service` cruzando os títulos com os provedores de streaming do TMDB.
  - *Why*: Garante que todos os controles visíveis na barra das imagens 2 e 3 sejam 100% funcionais e interativos.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Desktop Person Page (950px)                       │
├──────────────────────────────────────────────┬──────────────────────────┤
│ Left Column (670px)                          │ Right Sidebar (230px)    │
│                                              │                          │
│  FILMS STARRING                              │                          │
│  Keira Knightley                             │                          │
│                                              │                          │
│  [ACTOR ⌄]   [DECADE ⌄][GENRE ⌄][SERVICE ⌄]  │  ┌────────────────────┐  │
│              [Sort by POPULARITY ⌄] [👁 ⌄]   │  │                    │  │
│  ──────────────────────────────────────────  │  │   Portrait Photo   │  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐          │  │    (230 x 345)     │  │
│  │ P1 │ │ P2 │ │ P3 │ │ P4 │ │ P5 │          │  │                    │  │
│  └────┘ └────┘ └────┘ └────┘ └────┘          │  └────────────────────┘  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐          │  Biography text with     │
│  │ P6 │ │ P7 │ │ P8 │ │ P9 │ │P10 │          │  inline "... more"       │
│  └────┘ └────┘ └────┘ └────┘ └────┘          │                          │
│                                              │  More details at         │
│                                              │  [TMDB] [Wikipedia]      │
└──────────────────────────────────────────────┴──────────────────────────┘
```

- **Data Model & State**:
  - `activeRole`: `PersonRole` (inicializado sempre em uma função de filmografia como `Actor` ou `Director` no desktop, nunca em `'Bio'`).
  - `openDropdown`: `'role' | 'decade' | 'genre' | 'service' | 'sort' | 'watched' | null` (controla qual menu customizado está aberto na barra).
  - `serviceFilter`: `number | null` (ID do provedor de streaming selecionado, filtrando os créditos da pessoa que estão disponíveis no serviço).
  - `watchedFilter`: `'all' | 'unwatched' | 'watched' | 'fade'` (filtra ou esmaece filmes já assistidos conforme o ícone de olho `👁` do Letterboxd, exatamente como o `faded` na imagem 2 em *The Imitation Game*).

- **Interactive Component & State Mapping**:
  - **Role Dropdown (`ACTOR ⌄`)**: Exibe todas as funções disponíveis para a pessoa com a contagem de créditos ao lado da função ativa. Ao selecionar, atualiza `activeTab` e fecha o menu.
  - **Filter Menus (`DECADE`, `GENRE`, `SERVICE`, `Sort by`, `👁`)**: Menus customizados sem bordas de `<select>` nativo, estilizados como texto inline com seta `⌄` e painel flutuante `#899aa9` / `#2c3440`. O filtro `👁` permite alternar entre mostrar todos, esmaecer assistidos (`Fade watched` — padrão visual da imagem 2 onde filmes assistidos ficam escurecidos), ocultar assistidos ou mostrar apenas assistidos.
  - **Right Sidebar Biography**: Exibe a foto em `230x345px` (abre `PosterLightbox` ao clicar), texto da biografia com truncamento e botão inline `more` / `less`, e botões de link externo para `TMDB` e `Wikipedia`.
