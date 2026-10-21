import React from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

interface BackdropProps {
  /** URL da imagem de destaque (TMDB ou override do usuário) */
  src: string;
  /** Texto alternativo da imagem */
  alt?: string;
}

export const Backdrop: React.FC<BackdropProps> = ({ src, alt = '' }) => {
  const isMobile = useIsMobile();
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
          style={
            isMobile
              ? {
                  backgroundImage: `url("${mobileSrc}")`,
                }
              : undefined
          }
          title={alt}
        >
          {!isMobile && (
            <img
              src={desktopSrc}
              alt={alt}
              fetchPriority="high"
              decoding="async"
              className="hidden md:block w-full h-full object-cover object-top select-none pointer-events-none"
            />
          )}
        </div>
        <div className="backdropmask js-backdrop-fade" />
      </div>
    </div>
  );
};

