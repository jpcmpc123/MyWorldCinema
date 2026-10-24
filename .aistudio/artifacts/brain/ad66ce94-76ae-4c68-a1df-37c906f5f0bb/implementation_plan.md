# Organização e Otimização de Performance do Módulo Cine IA (Motor Laya 7D)

Reestruturação completa da inteligência artificial de recomendação de filmes (**Cine IA / Laya**) em um módulo unificado, desacoplado e de alta performance que roda nativamente tanto no aplicativo (Web e APK Android) quanto no servidor, eliminando latências desnecessárias e facilitando futuras expansões.

## User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo refletem suas escolhas confirmadas e definem como o motor de IA será organizado e otimizado.

- **Arquitetura Unificada (`src/ai/`)**: Toda a inteligência do recomendador (tipagens, dicionários bilíngues, regras semânticas, inferência neural linear 5D/7D e cascata de busca TMDB) ficará centralizada em módulos independentes e coesos, removendo quase 500 linhas de código hoje espalhadas entre a página de interface e a configuração do servidor.
- **Execução Direta com Cache em Memória**: O motor Laya + TMDB rodará diretamente no cliente com cache inteligente de resultados e deduplicação de chamadas em andamento, garantindo funcionamento idêntico e instantâneo na Web, em builds estáticos e no APK Android (sem cair em listas genéricas de filmes populares quando offline do servidor Node/Python).
- **Otimizações Pontuais de Desempenho**:
  - Remoção do atraso artificial de 900ms causado pela tentativa de conexão ao microserviço local na porta 8000 a cada pergunta quando o servidor Python não está ativo.
  - Pré-compilação única das expressões regulares de fronteira de palavra (hoje recriadas centenas de vezes a cada pergunta).
  - Carregamento sob demanda (*lazy chunk*) dos pesos do modelo (`weights_5d.json`, ~900 KB) apenas quando o usuário acessa a aba Cine IA, sem impactar o tempo de abertura inicial do app.

---

## 1. Overview & Core Concept

- **O que faz**: Recebe pedidos em linguagem natural (ex: *"Suspense psicológico coreano tenso dos anos 90"* ou *"Adorei Interestelar, quero algo parecido no espaço"*), classifica instantaneamente em 7 dimensões (**Gênero, Humor/Clima, Classificação Indicativa, Década, Origem/País, Ritmo e Contexto de Sessão**), detecta filmes de referência citados pelo usuário e executa uma busca em cascata no TMDB para retornar os 4 melhores filmes com pôster e metadados traduzidos.
- **Público e Contexto**: Usuários buscando recomendações rápidas e certeiras na aba **Cine IA**, tanto pelo navegador quanto pelo aplicativo Android (Capacitor).
- **Valor Principal**: Código limpo e modular para adicionar novos filtros, dimensões ou regras em segundos, combinado com resposta quase instantânea e zero dependência de servidor externo para funcionar em produção.

---

## 2. User Experience & Visual Design

- **Fluxo do Usuário**:
  1. Ao abrir a aba **Cine IA**, os pesos do modelo são pré-aquecidos em segundo plano sem travar a interface.
  2. O usuário digita um pedido livre ou toca em uma das sugestões rápidas.
  3. O classificador Laya 7D processa o texto em menos de 1ms, exibe as tags das decisões detectadas (ex: `Estilo Interestelar · Ficção Científica · Misterioso · Recente · 12+`) e apresenta os 4 pôsteres recomendados.
  4. Pedidos repetidos ou similares retornam instantaneamente do cache em memória, e um botão permite pedir novas variações para a mesma consulta.
- **Identidade Visual**:
  - Mantém fielmente a estética escura inspirada no Letterboxd (`#14181c`, superfícies `#1b2228`, destaque verde `#00e054` e tipografia limpa), preservando o comportamento responsivo do teclado virtual no celular.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Motor Isomórfico Unificado vs. Lógica Duplicada no Servidor**
  - *Abordagem Escolhida*: Centralizar o classificador Laya 7D e a cascata de descoberta do TMDB em módulos TypeScript puros reutilizados pela interface e pelo middleware de desenvolvimento.
  - *Por quê*: Elimina a duplicação de regras entre front-end e servidor e garante que o APK Android e o deploy estático tenham exatamente a mesma inteligência real do ambiente de desenvolvimento.
- **Decisão 2: Pré-compilação Léxica e Lazy Loading do Modelo Neural**
  - *Abordagem Escolhida*: Compilar os padrões de palavras-chave uma única vez na inicialização do módulo e importar o arquivo de pesos neurais (`weights_5d.json`) via chunk assíncrono separado.
  - *Por quê*: Reduz o custo de CPU por consulta em mais de 90% e mantém o bundle principal leve na tela inicial do aplicativo.
- **Decisão 3: Cache LRU de Recomendações e Filmes de Referência**
  - *Abordagem Escolhida*: Implementar cache em memória com tempo de expiração (TTL) para consultas completas e para buscas de filmes de referência no TMDB.
  - *Por quê*: Evita requisições repetidas à API do TMDB e torna a navegação entre sugestões instantânea.

---

## 4. Technical Architecture & Data Strategy

### Diagrama de Arquitetura e Componentes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Interface: CineIaPage                            │
│  (Histórico de Conversa, Sugestões Rápidas, Barra Fixa Mobile/Desktop)  │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Orquestrador: CineIA Service Engine                   │
│       (Cache LRU em Memória, Deduplicação de Chamadas, Fallback)        │
└───────────────┬─────────────────────────────────────────┬───────────────┘
                │                                         │
                ▼                                         ▼
┌───────────────────────────────┐         ┌───────────────────────────────┐
│   Classificador Laya 7D       │         │   Motor de Descoberta TMDB    │
│ ───────────────────────────── │         │ ───────────────────────────── │
│ • Inferência Linear 5D (Lazy) │         │ • Detector de Filme Referência│
│ • Regras Semânticas Pré-Comp. │         │ • Cascata Inteligente (4 Tiers│
│ • Dicionários e Labels PT/EN  │         │   preservando País + Gênero)  │
└───────────────────────────────┘         └───────────────────────────────┘
```

### Modelo de Dados e Estado
- **Decisões Tipadas (`LayaDecisions`)**: Estrutura padronizada contendo `genre`, `mood`, `content_rating`, `decade`, `origin`, `pacing` e `viewing_context`, além de `confidence` e `referenceMovie`.
- **Dicionários e Regras Isolados**: Tabelas de tradução (`pt-BR` e `en-US`), mapeamentos de IDs de gênero/país/década do TMDB e regras léxicas ficam isolados em um módulo de constantes e regras, permitindo adicionar novas categorias ou palavras-chave sem tocar na lógica do algoritmo.
- **Integração com Estado da Página**: A página `CineIaPage` consome apenas o serviço de alto nível e utilitários de formatação, mantendo o componente React enxuto e focado exclusivamente na experiência de chat e exibição dos pôsteres.
