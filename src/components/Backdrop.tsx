import React from 'react';

interface BackdropProps {
  /** URL da imagem de destaque (TMDB ou override do usuário) */
  src: string;
  /** Texto alternativo da imagem */
  alt?: string;
}

/**
 * Backdrop oficial extraído fielmente do Letterboxd:
 *
 * Estrutura DOM original do Letterboxd:
 * <div class="backdrop-container">
 *   <div id="backdrop" class="backdrop-wrapper backdrop-fade-in -loaded" data-backdrop="...">
 *     <div class="backdropimage js-backdrop-image" style="background-position: center 0px; background-image: url(...)"></div>
 *     <div class="backdropmask js-backdrop-fade"></div>
 *   </div>
 * </div>
 *
 * Funcionamento:
 * 1. O `.backdrop-container` posiciona-se de forma absoluta no topo (top: 0), com
 *    altura de 675px no desktop (16:9 de 1200px) e proporção 16:9 (padding-top: 56.25%) no mobile.
 * 2. O `.backdrop-wrapper` centraliza uma tela fixa de 1200px x 675px via `left: 50%; transform: translate(-50%)`.
 * 3. A `.backdropimage` renderiza a imagem com nitidez e saturação originais.
 * 4. A `.backdropmask:before` projeta as duas camadas de gradiente Letterboxd:
 *    - Gradiente horizontal 90deg com 28 stops que dissolve as bordas laterais no fundo #14181c.
 *    - Gradiente vertical que deixa os 41.48% superiores intactos e gradua suavemente até
 *      78.52% para fundir totalmente com o #14181c.
 * 5. A classe `backdrop-fade-in -loaded` executa a transição suave de 0.75s com curva cúbica
 *    `cubic-bezier(.165,.84,.44,1)` quando a imagem termina de carregar.
 */
export const Backdrop: React.FC<BackdropProps> = ({ src, alt = '' }) => {
  if (!src) return null;

  // Para URLs do TMDB, usa w780 (~45KB) na camada de background mobile e w1280 (~130KB) no desktop,
  // evitando baixar imagens 'original' (4K, 5–10MB) que deixavam o topo vazio em conexões 4G.
  const mobileSrc = src.includes('image.tmdb.org/t/p/')
    ? src.replace(/\/t\/p\/(original|w1280)\//, '/t/p/w780/')
    : src;
  const desktopSrc = src.includes('image.tmdb.org/t/p/')
    ? src.replace(/\/t\/p\/original\//, '/t/p/w1280/')
    : src;

  return (
    <div className="backdrop-container" aria-hidden="true" role="presentation">
      <div
        id="backdrop"
        className="backdrop-wrapper backdrop-fade-in -loaded"
        data-backdrop={desktopSrc}
      >
        <div
          className="backdropimage js-backdrop-image md:!bg-none"
          style={{
            backgroundImage: `url("${mobileSrc}")`,
          }}
          title={alt}
        >
          <img
            src={desktopSrc}
            srcSet={
              src.includes('image.tmdb.org/t/p/')
                ? `${mobileSrc} 780w, ${desktopSrc} 1280w`
                : undefined
            }
            sizes="(max-width: 767px) 100vw, 1200px"
            alt={alt}
            fetchPriority="high"
            decoding="async"
            className="hidden md:block w-full h-full object-cover object-top select-none pointer-events-none"
          />
        </div>
        <div className="backdropmask js-backdrop-fade" />
      </div>
    </div>
  );
};
