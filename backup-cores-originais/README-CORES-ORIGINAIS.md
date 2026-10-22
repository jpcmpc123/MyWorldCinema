# Backup das Configurações Originais de Cores (PC & Celular)

Esta pasta (`backup-cores-originais/`) guarda uma cópia exata dos arquivos de estilo e componentes principais de tema do projeto antes de qualquer alteração de paleta, permitindo restaurar 100% do visual original tanto no **PC (Desktop)** quanto no **Celular (Mobile)**.

---

## Arquivos Salvos Neste Backup

1. `index.css` — Cópia integral de `src/index.css` (variáveis `@theme`, `:root`, degradê de fundo do PC, vinheta do Backdrop PC/Mobile, barra de abas mobile `.main-tabs-container`, indicador deslizante `.tab-indicator` e barra inferior `.bottom-nav`).
2. `index.html` — Cópia de `index.html` (`theme-color` mobile e classes de fundo do `<body>`).
3. `manifest.webmanifest` — Cópia de `public/manifest.webmanifest` (`background_color` e `theme_color` do PWA mobile).
4. `components/Header.tsx` — Cabeçalho responsivo (barra superior do PC + cabeçalho preto e abas do celular).
5. `components/BottomNav.tsx` — Barra de navegação inferior exclusiva do celular.
6. `components/Backdrop.tsx` — Componente de imagem de fundo dos filmes/séries.
7. `components/ActionBottomSheet.tsx` — Gaveta de ações mobile (Watch, Like, Watchlist, estrelas).
8. `components/StarRating.tsx` — Componente de estrelas de avaliação.

---

## Tabela de Referência Rápida (Valores Originais)

### 1. Variáveis Globais (`@theme` em `src/index.css`)
```css
@theme {
  --color-lb-bg: #14181c;
  --color-lb-surface: #1c2228;
  --color-lb-elevated: #2c3440;
  --color-lb-border: #303844;
  --color-lb-border-light: #445566;
  --color-lb-green: #00e054;
  --color-lb-green-hover: #00c54a;
  --color-lb-blue: #40bcf4;
  --color-lb-orange: #ff8000;
  --color-lb-red: #ff3344;
  --color-lb-text: #99aabb;
  --color-lb-muted: #7c8ea0;
  --color-lb-white: #ffffff;
}
```

### 2. Variáveis de Navegação Mobile e Geral (`:root` em `src/index.css`)
```css
:root {
  color-scheme: dark;
  --lb-bg-main: #14181c;
  --lb-bg-header: #000000;
  --lb-bottom-bar: #3d4a57;
  --lb-bottom-pill-active: #28323c;
  --lb-blue-active: #40bcf4;
  --lb-green-accent: #00e054;
  --lb-icon-inactive: #b8c5d1;
}
```

### 3. Cores Específicas do PC (Desktop `>= 768px`)
- **Fundo Principal e Degradê Superior:** `#14181c` (de `0px` a `72px`) seguido de `linear-gradient(180deg, #202830 72px, #1e252c 140px, #1b2128 230px, #181d23 340px, #161a1f 450px, #14181c 560px)`.
- **Vinheta do Backdrop (`.backdropmask:before`):** Rampa lateral (`90deg`) e vertical dissolvendo para `#14181c`.
- **Contraste do Header sobre o Backdrop (`.site-header-bg`):** Degradê de `#14181c` (topo) para `#14181c00` (base).
- **Menu Dropdown do Usuário (PC):** Fundo `#8995a0`, borda `#73808c`, texto `#202830` e hover `#66727e`.

### 4. Cores Específicas do Celular (Mobile `< 768px`)
- **Header e Barra de Abas (`.main-tabs-container`, `.person-tabs-container`):** Fundo `#000000`, linha divisória inferior `#1f2937`.
- **Texto das Abas Mobile:** Inativo `#9ab`, hover `#dbe4ee`, ativo `#ffffff`.
- **Indicador Elástico da Aba Ativa (`.tab-indicator`):** `#00e054`.
- **Vinheta Mobile do Backdrop:** `linear-gradient(to top, #14181c 0%, #14181c 3%, rgba(20, 24, 28, 0.9) 10%, ...)`.
- **Barra Inferior (`.bottom-nav`):** Fundo `#3d4a57`, pílula ativa `#28323c`, ícone ativo `#40bcf4`, ícone inativo `#b8c5d1`, botão central `+` com borda e ícone em `#00e054`.

---

## Como Restaurar o Visual Original

Caso queira voltar às cores originais a qualquer momento, basta pedir para restaurar os arquivos da pasta `backup-cores-originais/` ou executar no terminal:

```bash
cp backup-cores-originais/index.css src/index.css
cp backup-cores-originais/index.html index.html
cp backup-cores-originais/manifest.webmanifest public/manifest.webmanifest
cp backup-cores-originais/components/* src/components/
```
