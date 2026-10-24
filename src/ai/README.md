# Módulo Cine IA (`src/ai/`)

Arquitetura unificada e isomórfica do sistema de recomendação **Cine IA (Laya 7D + TMDB)**.
Funciona nativamente tanto no cliente (Web e APK Android via Capacitor) quanto no servidor Node/Vite.

## Estrutura dos Arquivos

- **`types.ts`**: Contratos TypeScript das 7 dimensões do Laya (`genre`, `mood`, `content_rating`, `decade`, `origin`, `pacing`, `viewing_context`), estrutura do modelo `Weights5DModel` e respostas de recomendação.
- **`constants.ts`**: Mapeamentos de filtros da API do TMDB (`TMDB_GENRE_MAP`, `DECADE_YEAR_MAP`, `ORIGIN_MAP`), dicionários bilíngues (`pt-BR` e `en-US`), sugestões rápidas e o formatador `formatDecisionLine()`.
- **`rules.ts`**: Base de conhecimento semântica e léxica das 7 dimensões. Todas as listas de palavras-chave são pré-compiladas em expressões regulares de fronteira exata uma única vez na inicialização (`compileTermListRegex`), garantindo classificação O(1) em sub-milissegundo.
- **`weightsLoader.ts`**: Carregador assíncrono sob demanda (*lazy chunk*) do checkpoint neural `weights_5d.json`, evitando impacto no carregamento inicial do aplicativo.
- **`classifier.ts`**: Motor de inferência `classifyLaya7D` (combina os pesos lineares 5D com as regras semânticas 7D) e extrator de filmes de referência (`extractReferenceMovieTitle`).
- **`tmdbRecommender.ts`**: Orquestrador `recommendMovies()` com cache LRU em memória (TTL de 10 min), deduplicação de chamadas simultâneas, rotação de filmes inéditos (`excludeIds`) e cascata de 4 tiers no TMDB Discover.
- **`index.ts`**: Ponto único de exportação de todo o módulo.

## Como Expandir Rapidamente

1. **Adicionar novas palavras-chave ou gírias a um gênero/clima/país**:
   Basta incluir o termo na lista correspondente em `src/ai/rules.ts` (`RAW_GENRE_RULES`, `RAW_MOOD_RULES`, `RAW_ORIGIN_RULES`, etc.). A compilação com fronteira de palavra e remoção de acentos é automática.
2. **Adicionar novas sugestões rápidas na tela inicial do Cine IA**:
   Edite `SUGGESTIONS_PT` e `SUGGESTIONS_EN` em `src/ai/constants.ts`.
3. **Ajustar critérios de busca ou filtros do TMDB**:
   Edite `buildDiscoverTiers()` em `src/ai/tmdbRecommender.ts`.
