# Backdrop estilo Letterboxd — Como funciona

Documento técnico da implementação do backdrop (imagem de destaque no topo das
páginas de filme/série), replicando o visual do Letterboxd
(ex.: https://letterboxd.com/film/spider-man-brand-new-day/).

## Arquivos envolvidos

| Arquivo | Papel |
| --- | --- |
| `src/components/Backdrop.tsx` | Componente reutilizável do backdrop (imagem + fades) |
| `src/components/Header.tsx` | Navbar transparente sobre o backdrop nas rotas `/film/:id` e `/tv/:id` |
| `src/pages/FilmPage.tsx` | Usa `<Backdrop>` + grid de 3 colunas com overlap por margem negativa |
| `src/pages/SeriesDetailPage.tsx` | Mesmo padrão da FilmPage |
| `src/index.css` | Fundo do body unificado em `#14181C` (crucial, ver abaixo) |

## Duas variantes

| Breakpoint | Faixa | Como a fusão é feita |
| --- | --- | --- |
| **Desktop (≥ 768px)** | 1200 × **675** px centralizados | `.backdropmask` — receita copiada do Letterboxd |
| **Mobile (< 768px)** | 100% × 230 px | `mask-image` na própria `<img>` + 2 gradientes |

### Desktop: a receita do próprio Letterboxd (extraída do HTML original)

Fontes (página salva de `/film/spider-man-brand-new-day/`):

```css
.backdrop-wrapper { z-index:0; width:1200px; height:675px; position:absolute; top:0; left:50%; transform:translate(-50%) }
.backdrop-wrapper > .backdropimage { background-repeat:no-repeat; background-size:100% 100%; width:100%; height:99.95%; position:absolute }
.backdrop-wrapper > .backdropmask { padding-top:500px; position:relative }
.backdrop-wrapper > .backdropmask:before {
  content:""; z-index:0; pointer-events:none; background-repeat:no-repeat;
  width:1200px; height:675px; display:block; position:absolute; top:0; left:50%; transform:translate(-50%);
  background-image: linear-gradient(90deg, #14181d 0%, … , #14181d 100%),   /* laterais */
                    linear-gradient(#14181d00 41.4815%, … , #14181d 78.5185% 100%); /* base */
}
```

Pontos que fazem diferença:

1. **Não é `mask-image`**: são DUAS camadas de gradiente da cor sólida do fundo
   (`#14181d`) com alfa variável. A rampa usa dezenas de stops (0.97%, 2.07%,
   3.29%…) — é essa rampa longa que dá o degradê perceptualmente suave.
2. **Base**: transparente até **41,48%** (a imagem aparece inteira no topo) e
   opaca a partir de **78,52%** — ou seja, a partir de ~530px o fundo já é
   sólido.
3. **Laterais**: opacas até ~16,67% de cada lado, transparentes no meio.
4. **Sem escurecimento no topo**: o contraste da navbar vem de outra camada
   (ver abaixo).

### Contraste da navbar (`.site-header-bg`)

```css
.site-header .site-header-bg {
  pointer-events:none; height:95px; opacity:var(--bg-alpha,.85);
  background-image:linear-gradient(#14181c 0%, #14181cf1 16.56%, #14181ccc 30.85%, #14181c9b 43.77%, #14181c64 56.23%, #14181c33 69.15%, #14181c0e 83.44%, #14181c00 100%);
  background-repeat:repeat-x; position:absolute; top:0; left:0; right:0;
}
.site-header:not(:hover):not(:focus-within):not(:has(:active)) { --bg-alpha:calc(2/3) }
```

No Header.tsx ela é renderizada só quando o header fica transparente por cima do
backdrop (`/film/:id` e `/tv/:id`).

### Régua vertical (igual ao original)

O original começa o conteúdo em **472px** (`.site-body` em y=72 + `padding-top:
400px`) com o título em y=469. Aqui a faixa é 675 e a margem negativa é
`md:-mt-[203px]` → 675 − 203 = **472** ✅ (o mobile continua `-mt-10` →
230 − 40 = 190).

### Mobile (inalterado)

Continua com `mask-image` na `<img>` (some só na base) + os dois gradientes de
fusão da camada `md:hidden`.

## Princípio central (histórico)

O "efeito de blur" do Letterboxd **não é blur**. É a fusão da imagem com a cor
de fundo da página (`#14181c`) por meio de gradientes. A imagem permanece
nítida no centro; apenas as extremidades desaparecem.

O efeito é composto por **duas camadas** dentro de um container centralizado de
`max-w-[1200px]` e altura `500px`/`560px`:

### 1. `mask-image` na `<img>` (transparência real)

Os pixels da imagem ficam 100% transparentes **antes** de tocar as bordas,
eliminando qualquer linha de corte visível:

```css
mask-image:
  linear-gradient(to right, transparent 0%, transparent 2%, black 22%, black 78%, transparent 98%, transparent 100%),
  linear-gradient(to top, transparent 0%, transparent 8%, black 55%, black 100%);
mask-composite: intersect;
/* + equivalentes -webkit- (source-in) */
```

### 2. Overlay de 4 gradientes (fusão com o fundo)

Um `<div>` sobre a imagem com `background` de 4 gradientes empilhados, todos na
cor exata do fundo da página:

- **Base**: `#14181c 0% → #14181c 10% → rgba(20,24,28,0.85) 30% → transparent 60%`
  — densa para que a área onde o texto começa já seja fundo sólido (legibilidade);
- **Laterais**: `#14181c 0–3% (sólido) → rgba(20,24,28,0.7) 10% → transparent 25%`
  — faixa sólida no início evita corte seco em imagens claras;
- **Topo**: `rgba(20,24,28,0.75) 0% → rgba(20,24,28,0.3) 12% → transparent 25%`
  — reforçado apenas para contraste da navbar transparente, sem criar faixa visível.

## Regras importantes (armadilhas já resolvidas)

1. **O fundo da página DEVE ser exatamente `#14181C` sólido.** O `body` tinha
   um gradiente (`#1C2228 → #14181C`) que causava uma linha vertical visível
   onde o container de 1200px terminava. Foi removido em `index.css`. Não
   reintroduzir gradiente/imagem de fundo no `body`.
2. **Nunca usar overlay escuro uniforme** sobre a imagem inteira — o centro
   deve manter brilho e contraste originais.
3. **Navbar transparente**: em `Header.tsx`, quando a rota é `/film/:id` ou
   `/tv/:id` (regex `/^\/(film|tv)\/\d+/`), o header usa
   `absolute inset-x-0 top-0 z-50 bg-transparent` + `text-shadow`/`drop-shadow`
   nos textos e ícones. Nas demais rotas permanece `sticky` com fundo sólido.
4. **Overlap do conteúdo**: o container principal da página usa margem negativa
   `-mt-[120px] md:-mt-[150px]` (com `relative z-10`) — o topo do pôster invade
   o backdrop, mas título e sinopse ficam sobre a área já escurecida pelo fade.
   Sem backdrop, usa `pt-20` (a navbar é `absolute` e não ocupa espaço no fluxo).

## Layout do cabeçalho do filme (padrão Letterboxd)

A FilmPage usa CSS Grid em telas `md+`:

```
grid-cols-[230px_minmax(0,1fr)_235px]
```

- **Coluna 1 (pôster)**: `md:row-span-2` — ocupa as duas linhas;
- **Linha 1, colunas 2–3**: cabeçalho (Título + Ano + Diretor + Tagline) com
  `md:col-span-2` — títulos longos cabem em uma linha;
- **Linha 2**: sinopse/tabs (coluna 2) e card de ações Watch/Like/Watchlist +
  Rate (coluna 3), naturalmente alinhados entre si.

## Uso

```tsx
import { Backdrop } from '../components/Backdrop';

// no topo do JSX da página:
{backdropUrl && <Backdrop src={backdropUrl} alt={movie.title} />}

// container de conteúdo logo em seguida:
<div className={`relative z-10 max-w-[960px] mx-auto px-4 pb-16 ${
  backdropUrl ? '-mt-[120px] md:-mt-[150px]' : 'pt-20'
}`}>
```
