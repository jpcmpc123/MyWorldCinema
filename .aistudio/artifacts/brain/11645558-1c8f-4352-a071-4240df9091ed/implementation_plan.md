# Plano de Implementação — Criação e Exibição de Listas no Mobile (Estilo Letterboxd)

## 1. Visão Geral
Implementar a experiência mobile de criação de listas e a visualização da aba **Lists** dentro do perfil do usuário fielmente inspiradas no aplicativo mobile do Letterboxd, mantendo o layout desktop atual inalterado.

---

## 2. Aba `Lists` no Perfil do Usuário (Mobile)
Aplicado na aba **Lists** do perfil do usuário no mobile (`/:username/lists` renderizado no `TabViewPager` de perfil e na aba interna `lists` de `ProfilePage`):
- **Linhas de Lista Compactas**:
  - Cabeçalho de cada lista com o **título em destaque** à esquerda (branco, negrito) e a **contagem de filmes** à direita (`16 films`, `1 film`, etc. em tom cinza suave).
  - **Tira Horizontal de Pôsteres**: logo abaixo do título, exibir uma faixa horizontal de pôsteres lado a lado (`aspect-[2/3]`, cantos arredondados sutis, borda fina `border-white/10`), preenchendo a largura da linha conforme o padrão do app.
  - Divisória horizontal sutil (`border-b border-white/10`) separando cada lista.
- **Botão Flutuante de Nova Lista (`+`)**:
  - Botão flutuante verde (`bg-[#00e054]`, ícone `+` escuro centralizado, cantos arredondados `rounded-2xl`) fixado no canto inferior direito, posicionado acima da `BottomNav`, que leva diretamente para `/list/new`.

---

## 3. Fluxo Mobile de Criação de Lista (`/list/new`)
Substituir o formulário mobile de `CreateListPage.tsx` (visível apenas em `< 768px`, preservando integralmente o bloco `hidden md:block` do desktop) por uma experiência em tela cheia dividida em 3 sub-telas coordenadas:

### A. Tela Principal — `New List`
- **Top Bar Nativa Preta (`bg-black`)**:
  - Botão `✕` à esquerda para cancelar/voltar.
  - Título `New List` alinhado à esquerda/centro.
  - Botão `✓` à direita para salvar a lista (habilitado quando houver nome e ao menos 1 filme).
  - Ocultar o `Header` global e a `BottomNav` no mobile enquanto estiver em `/list/new` para fidelidade total às capturas.
- **Campos de Metadados**:
  - **List name**: caixa preenchida em tom ardósia escuro (`bg-[#2c3440]`), texto claro e placeholder `List name`.
  - **Add description...**: área de texto limpa logo abaixo, separada por linha divisória horizontal.
- **Seção de Entradas (`Add entries...` / `Edit entries...`)**:
  - Quando vazia: exibe o rótulo `Add entries...` que, ao ser tocado, abre diretamente a sub-tela de **Busca de Filmes** (`Name of film...`).
  - Quando já possui filmes: exibe o rótulo `Edit entries...` acompanhado da grade/linha de pôsteres adicionados. Ao tocar na área, abre a sub-tela **Films** (gerenciamento e ordenação).
  - Quando o modo **Ranked** estiver ativo, cada pôster exibe o selo circular numerado (`1`, `2`, `3`...) centralizado na borda inferior do pôster.
- **Rodapé Fixo de Tags e Toggles**:
  - Faixa `Add tags...` delimitada por linhas divisórias superior e inferior (permitindo digitar e gerenciar tags).
  - Barra inferior dividida em 2 botões toggle lado a lado:
    - **Public**: ícone de globo + rótulo `Public` (alterna visibilidade pública/privada).
    - **Ranked**: ícone de troféu com estrela + rótulo `Ranked` (quando ativado, destaca o ícone com selo de confirmação azul-claro e numera os pôsteres).

### B. Sub-tela de Gerenciamento — `Films`
- **Top Bar**: seta `←` para voltar à tela `New List` + título `Films`.
- **Lista de Filmes Adicionados**:
  - Cada linha exibe a miniatura do pôster à esquerda (com badge numérico no canto se ranqueada), o **título em negrito** seguido do **ano de lançamento** em cinza (`Buffet Infinity 2025`), botão para remover e o ícone de **6 pontos (`GripVertical`)** à direita.
  - Suporte a reordenação por arraste (drag-and-drop / touch reorder) e controles rápidos de posição.
- **Botão Flutuante (`+`)**:
  - Botão verde arredondado no canto inferior direito que abre a sub-tela de **Busca de Filmes**.

### C. Sub-tela de Busca — `Name of film...`
- **Top Bar de Busca**: seta `←` para voltar + campo `Name of film...` com foco automático e botão `✕` para limpar.
- **Buscas Recentes (`RECENT SEARCHES`)**:
  - Quando o campo de busca está vazio, exibe a seção `RECENT SEARCHES` (persistida em `localStorage`) listando os termos buscados recentemente para toque rápido.
- **Resultados em Tempo Real (TMDB)**:
  - Conforme o usuário digita, exibe os filmes correspondentes com pôster, título, ano e diretor; ao tocar em um filme, ele é adicionado à lista, o termo é salvo nas buscas recentes e o usuário retorna para a visualização da lista.

---

## 4. Arquivos que Serão Modificados
- `src/components/Header.tsx` e `src/components/BottomNav.tsx`: ocultar o cabeçalho global e a barra inferior no mobile quando a rota ativa for `/list/new`.
- `src/pages/CreateListPage.tsx`: implementar as 3 sub-telas mobile (`New List`, `Films` e `Search`) mantendo o layout desktop intacto.
- `src/pages/ListsPage.tsx` e `src/pages/ProfilePage.tsx`: atualizar a visualização mobile da aba `Lists` do perfil do usuário com a tira horizontal de pôsteres e o botão flutuante verde `+`.
