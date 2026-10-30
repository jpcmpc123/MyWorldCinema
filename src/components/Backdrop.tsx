import React, { useEffect, useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

const loadedImageUrls = new Set<string>();
const inFlightImagePromises = new Map<string, Promise<void>>();
const pinnedDecodedImages: HTMLImageElement[] = [];
const MAX_PINNED_DECODED_IMAGES = 16;
const MAX_LOADED_IMAGE_URLS = 350;

export function isImageUrlPreloaded(url: string | null | undefined): boolean {
  if (!url) return false;
  return loadedImageUrls.has(url);
}

export function preloadSingleImage(url: string): Promise<void> {
  if (!url || typeof Image === 'undefined') return Promise.resolve();
  if (loadedImageUrls.has(url)) return Promise.resolve();
  const existing = inFlightImagePromises.get(url);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'async';

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      inFlightImagePromises.delete(url);
      if (loadedImageUrls.size >= MAX_LOADED_IMAGE_URLS) {
        const oldest = loadedImageUrls.values().next().value;
        if (oldest) loadedImageUrls.delete(oldest);
      }
      loadedImageUrls.add(url);
      pinnedDecodedImages.push(img);
      if (pinnedDecodedImages.length > MAX_PINNED_DECODED_IMAGES) {
        pinnedDecodedImages.shift();
      }
      resolve();
    };

    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    };
    img.onerror = finish;
    img.src = url;

    if (img.complete && img.naturalWidth > 0) {
      if (typeof img.decode === 'function') {
        img.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    }
  });

  inFlightImagePromises.set(url, promise);
  return promise;
}

/**
 * URL HD rápida: w780 no mobile (<= 767px) e w1280 no desktop
 * para abertura instantânea sem bloquear a transição de página.
 */
export function getFastBackdropUrl(src: string | null | undefined, isMobile?: boolean): string {
  if (!src) return '';
  if (src.includes('image.tmdb.org/t/p/')) {
    const targetSize = isMobile ? '/t/p/w780/' : '/t/p/w1280/';
    return src.replace(/\/t\/p\/(original|w1280|w780|w500|w342)\//, targetSize);
  }
  return src;
}

/**
 * URL Ultra-HD (original = 1080p Full HD / 4K sem compressão agressiva)
 * decodificada em segundo plano para nitidez máxima.
 */
export function getHdBackdropUrl(src: string | null | undefined): string {
  if (!src) return '';
  if (src.includes('image.tmdb.org/t/p/')) {
    return src.replace(/\/t\/p\/(original|w1280|w780|w500|w342)\//, '/t/p/original/');
  }
  return src;
}

function shouldUpgradeToUltraHd(): boolean {
  if (typeof navigator === 'undefined') return true;
  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') return false;
  return true;
}

interface BackdropProps {
  /** URL da imagem de destaque (TMDB ou override do usuário) */
  src: string;
  /** Texto alternativo da imagem */
  alt?: string;
}

export const Backdrop: React.FC<BackdropProps> = ({ src, alt = '' }) => {
  const isMobile = useIsMobile();

  const fastSrc = getFastBackdropUrl(src, isMobile);
  const hdSrc = getHdBackdropUrl(src);
  const hasDistinctHd = Boolean(hdSrc && fastSrc && hdSrc !== fastSrc);

  // Se a versão Ultra-HD (original) já estiver decodificada no cache em memória,
  // renderiza direto em Ultra-HD desde o primeiro frame (0ms).
  const [hdDecoded, setHdDecoded] = useState<boolean>(() =>
    Boolean(hdSrc && isImageUrlPreloaded(hdSrc)),
  );
  const [hdPainted, setHdPainted] = useState<boolean>(() =>
    Boolean(hdSrc && isImageUrlPreloaded(hdSrc)),
  );

  useEffect(() => {
    if (!src) {
      setHdDecoded(false);
      setHdPainted(false);
      return;
    }
    if (isImageUrlPreloaded(hdSrc)) {
      setHdDecoded(true);
      setHdPainted(true);
      return;
    }

    setHdDecoded(false);
    setHdPainted(false);

    if (!hasDistinctHd || !shouldUpgradeToUltraHd()) return;

    let cancelled = false;
    // Aguarda o 1º paint (60ms) para fazer o download + img.decode() da imagem original 1080p/4K.
    const timer = window.setTimeout(() => {
      preloadSingleImage(hdSrc).then(() => {
        if (!cancelled) {
          setHdDecoded(true);
        }
      });
    }, 60);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [src, hdSrc, hasDistinctHd]);

  const baseTargetUrl = hasDistinctHd ? fastSrc : hdSrc;
  const [baseLoaded, setBaseLoaded] = useState<boolean>(() =>
    Boolean(baseTargetUrl && isImageUrlPreloaded(baseTargetUrl)),
  );

  useEffect(() => {
    if (!baseTargetUrl) {
      setBaseLoaded(false);
      return;
    }
    if (isImageUrlPreloaded(baseTargetUrl)) {
      setBaseLoaded(true);
      return;
    }
    setBaseLoaded(false);
  }, [baseTargetUrl]);

  if (!src) return null;

  const showBaseLayer = !hdPainted || !hasDistinctHd;
  const showHdLayer = hasDistinctHd && hdDecoded;

  return (
    <div className="backdrop-container" aria-hidden="true" role="presentation">
      <div
        id="backdrop"
        className="backdrop-wrapper backdrop-fade-in -loaded"
        data-backdrop={hdSrc || fastSrc}
      >
        <div
          className="backdropimage js-backdrop-image !bg-none overflow-hidden"
          title={alt}
        >
          {showBaseLayer && (
            <img
              ref={(el) => {
                if (el && el.complete && el.naturalWidth > 0 && !baseLoaded) {
                  loadedImageUrls.add(baseTargetUrl);
                  setBaseLoaded(true);
                }
              }}
              src={baseTargetUrl}
              alt={alt}
              fetchPriority="high"
              decoding="async"
              onLoad={() => {
                if (baseTargetUrl) loadedImageUrls.add(baseTargetUrl);
                setBaseLoaded(true);
              }}
              className={`w-full h-full object-cover object-top select-none pointer-events-none block transition-opacity duration-300 ease-out ${
                baseLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}
          {showHdLayer && (
            <img
              ref={(el) => {
                if (el && el.complete && el.naturalWidth > 0 && !hdPainted) {
                  setHdPainted(true);
                }
              }}
              src={hdSrc}
              alt={alt}
              fetchPriority="low"
              decoding="async"
              onLoad={() => setHdPainted(true)}
              className={`absolute inset-0 w-full h-full object-cover object-top select-none pointer-events-none block transition-opacity duration-300 ease-out ${
                hdPainted ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}
        </div>
        <div className="backdropmask js-backdrop-fade" />
      </div>
    </div>
  );
};
