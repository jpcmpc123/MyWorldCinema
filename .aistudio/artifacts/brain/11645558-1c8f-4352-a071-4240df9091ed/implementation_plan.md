# Plano de Implementação: Alta Resolução e Deslize Ultra-Fluido a 120fps no Carrossel

## Diagnóstico do Problema
1. **Baixa resolução**: Os pôsteres estavam configurados para `w342`, gerando pixelização e falta de nitidez em telas de celulares modernos (Full HD/AMOLED com DPI 2.5x a 3x).
2. **Travamento extremo**: O carrossel anterior utilizava eventos de toque com atualização de estado do React (`setDragOffsetPx`) a cada pixel movido, causando dezenas de re-renderizações por segundo na thread de JavaScript, bloqueando o processador do celular e eliminando a aceleração nativa de hardware.

---

## Soluções Planejadas

### 1. Alta Resolução Máxima (TMDB w780)
- Atualizar a resolução do pôster principal de `w342` para **`w780`** (`tmdb.getImageUrl(item.poster_path, 'w780')`), garantindo nitidez total e definição cristalina em qualquer celular.
- Manter o fundo desfocado elegante com `w500`/`w780` com desfoque suave e transição leve via CSS (`opacity` e `cross-fade`), sem filtros pesados que sobrecarreguem a GPU.

### 2. Deslize Nativo a 120fps no Compositor de Hardware
- Restaurar o scroll nativo com aceleração de hardware do navegador (`overflow-x-auto snap-x snap-mandatory` com `-webkit-overflow-scrolling: touch` e `overscroll-behavior-x: contain`).
- O deslize acontece diretamente na thread do compositor do navegador (GPU), rodando a 120Hz/60Hz sem nenhuma interferência ou re-renderização do React durante o movimento.
- A detecção do pôster ativo ocorre apenas após a rolagem ou via `requestAnimationFrame` leve, atualizando o título, ano e botões inferiores sem travar a animação de deslize.
- Cada pôster possui sua página completa (`w-full shrink-0 snap-center snap-always`), exibindo apenas um pôster na tela quando parado e transicionando com naturalidade e velocidade durante o deslize.

### 3. Eliminação de Cortes de Renderização
- Descartar transforms complexos com rotações ou sobreposições de dezenas de imagens que causavam o corte vertical de renderização no Chrome mobile.
- Carregamento imediato (`loading="eager"`) dos pôsteres adjacentes (anterior e próximo) para que o próximo pôster já esteja 100% renderizado antes do usuário deslizar.
