import React, { useEffect, useState } from 'react';

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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!src) return;
    setLoaded(false);

    const img = new Image();
    img.src = src;

    if (img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    } else {
      img.onload = () => setLoaded(true);
      img.onerror = () => setLoaded(false);
    }
  }, [src]);

  if (!src) return null;

  return (
    <div className="backdrop-container" aria-hidden="true" role="presentation">
      <div
        id="backdrop"
        className={`backdrop-wrapper backdrop-fade-in ${loaded ? '-loaded' : ''}`}
        data-backdrop={src}
      >
        <div
          className="backdropimage js-backdrop-image"
          style={{
            backgroundImage: `url("${src}")`,
          }}
          title={alt}
        />
        <div className="backdropmask js-backdrop-fade" />
      </div>
    </div>
  );
};
