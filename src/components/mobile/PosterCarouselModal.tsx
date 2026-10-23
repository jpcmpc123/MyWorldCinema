import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Eye, Film, Heart, Star, X } from 'lucide-react';
import { tmdb } from '../../services/tmdb';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../i18n/LanguageContext';

export interface CarouselMovieItem {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
  tv?: boolean;
  rank?: number;
}

interface PosterCarouselModalProps {
  open: boolean;
  items: CarouselMovieItem[];
  initialIndex?: number;
  onClose: () => void;
  onReachEnd?: () => void;
}

function formatStarString(rating: number): string {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return '★'.repeat(full) + (half ? '½' : '');
}

export const PosterCarouselModal: React.FC<PosterCarouselModalProps> = ({
  open,
  items,
  initialIndex = 0,
  onClose,
  onReachEnd,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const {
    isMovieWatched,
    toggleWatched,
    isMovieLiked,
    toggleLikeMovie,
    isMovieInWatchlist,
    toggleWatchlist,
    ratingsMap,
    setMovieRating,
    movieOverrides,
  } = useApp();

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [scrollProgress, setScrollProgress] = useState(initialIndex);
  const [ratePopoverOpen, setRatePopoverOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const endTriggeredForLengthRef = useRef<number>(0);

  // Sincroniza página inicial ao abrir o carrossel
  useEffect(() => {
    if (!open) {
      setRatePopoverOpen(false);
      endTriggeredForLengthRef.current = 0;
      return;
    }
    const safeIdx = Math.max(0, Math.min(initialIndex, Math.max(0, items.length - 1)));
    setActiveIndex(safeIdx);
    setScrollProgress(safeIdx);

    requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track) return;
      const pageWidth = track.clientWidth;
      track.scrollTo({
        left: safeIdx * pageWidth,
        behavior: 'instant' as ScrollBehavior,
      });
    });
  }, [open, initialIndex]);

  // Oculta a barra de navegação inferior (.bottom-nav) e bloqueia o scroll da página por trás
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-carousel-open', 'true');
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.removeAttribute('data-carousel-open');
    };
  }, [open]);

  // Fecha no ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Dispara carregamento de mais itens ao se aproximar do fim
  useEffect(() => {
    if (!open || !onReachEnd || items.length === 0) return;
    if (
      activeIndex >= items.length - 4 &&
      endTriggeredForLengthRef.current !== items.length
    ) {
      endTriggeredForLengthRef.current = items.length;
      onReachEnd();
    }
  }, [open, activeIndex, items.length, onReachEnd]);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const track = trackRef.current;
      if (!track || track.clientWidth === 0) return;

      const rawProgress = track.scrollLeft / track.clientWidth;
      const clampedProgress = Math.max(0, Math.min(rawProgress, Math.max(0, items.length - 1)));
      const nextIdx = Math.round(clampedProgress);

      setScrollProgress(clampedProgress);
      setActiveIndex((prev) => {
        if (prev !== nextIdx) {
          setRatePopoverOpen(false);
        }
        return nextIdx;
      });
    });
  }, [items.length]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  if (!open || items.length === 0 || typeof document === 'undefined') return null;

  const currentItem = items[Math.min(activeIndex, items.length - 1)] || items[0];
  const currentYear = currentItem.release_date ? currentItem.release_date.slice(0, 4) : '';

  const isWatched = isMovieWatched(currentItem.id);
  const isLiked = isMovieLiked(currentItem.id);
  const inWatchlist = isMovieInWatchlist(currentItem.id);
  const currentRating = ratingsMap[currentItem.id] || 0;

  const handlePosterClick = (item: CarouselMovieItem) => {
    onClose();
    navigate(`${item.tv ? '/tv' : '/film'}/${item.id}`);
  };

  const handleToggleWatched = () => {
    toggleWatched(currentItem.id);
  };

  const handleToggleLike = () => {
    toggleLikeMovie(currentItem.id);
  };

  const handleToggleWatchlist = () => {
    toggleWatchlist({
      id: currentItem.id,
      title: currentItem.title,
      poster_path: currentItem.poster_path,
      release_date: currentItem.release_date || '',
    });
  };

  const handleSelectRating = (val: number) => {
    const nextRating = currentRating === val ? 0 : val;
    setMovieRating(currentItem.id, nextRating);
    setRatePopoverOpen(false);
  };

  // Camadas de fundo ao redor do pôster atual para criar a transformação suave (cross-fade + morph/zoom/parallax)
  const minBgIdx = Math.max(0, Math.floor(scrollProgress) - 1);
  const maxBgIdx = Math.min(items.length - 1, Math.ceil(scrollProgress) + 1);
  const bgIndices: number[] = [];
  for (let i = minBgIdx; i <= maxBgIdx; i++) {
    bgIndices.push(i);
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] bg-[#14181c] flex flex-col overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label={currentItem.title}
    >
      {/* Fundo dinâmico com transformação contínua (cross-fade + escala + deslocamento suave) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0d1014]">
        {bgIndices.map((idx) => {
          const item = items[idx];
          if (!item) return null;
          const override = movieOverrides[item.id];
          const bgUrl =
            override?.poster ||
            (item.poster_path ? tmdb.getImageUrl(item.poster_path, 'w500') : null);
          if (!bgUrl) return null;

          // offset = 0 quando o pôster está perfeitamente centralizado;
          // varia continuamente entre -1 e +1 conforme o usuário desliza entre páginas
          const offset = idx - scrollProgress;
          const absDist = Math.min(1, Math.abs(offset));
          const weight = 1 - absDist;
          // Curva suave (smoothstep) para a fusão e transformação entre os dois fundos
          const easedWeight = weight * weight * (3 - 2 * weight);
          const opacity = easedWeight * 0.68;
          const scale = 1.24 + absDist * 0.18;
          const translateX = offset * 14;
          const rotate = offset * 2.5;

          return (
            <img
              key={`bg-${item.tv ? 'tv' : 'm'}-${item.id}-${idx}`}
              src={bgUrl}
              alt=""
              aria-hidden="true"
              style={{
                opacity,
                transform: `translate3d(${translateX}%, 0, 0) scale(${scale}) rotate(${rotate}deg)`,
                transition:
                  'opacity 260ms cubic-bezier(0.22, 1, 0.36, 1), transform 360ms cubic-bezier(0.22, 1, 0.36, 1)',
                willChange: 'transform, opacity',
              }}
              className="absolute inset-0 w-full h-full object-cover blur-2xl"
            />
          );
        })}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/65" />
      </div>

      {/* Cabeçalho com Título + Ano centralizados e botão X à direita */}
      <header className="relative z-10 pt-[calc(14px+env(safe-area-inset-top,0px))] pb-2 px-4 flex items-start justify-between shrink-0">
        <div className="w-10 h-10 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0 flex flex-col items-center text-center px-2 pt-0.5">
          <h2 className="text-[19px] font-bold text-white leading-tight truncate max-w-full drop-shadow-sm">
            {currentItem.title}
          </h2>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            {typeof currentItem.rank === 'number' && (
              <span className="text-[13px] font-bold text-[#99aabb] tabular-nums">
                #{currentItem.rank}
              </span>
            )}
            {typeof currentItem.rank === 'number' && currentYear && (
              <span className="text-[12px] text-[#667788]">•</span>
            )}
            {currentYear && (
              <p className="text-[14px] text-[#c8d4e0] tabular-nums">{currentYear}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('list_close_carousel')}
          className="w-10 h-10 flex items-center justify-center text-[#d8e0e8] active:text-white shrink-0 cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>
      </header>

      {/* Pista paginada: cada pôster tem sua própria página inteira (100% da largura da tela) */}
      <div
        ref={trackRef}
        onScroll={handleScroll}
        style={{ WebkitOverflowScrolling: 'touch' }}
        className="relative z-10 flex-1 flex items-center overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {items.map((item, idx) => {
          const override = movieOverrides[item.id];
          const posterUrl =
            override?.poster ||
            (item.poster_path ? tmdb.getImageUrl(item.poster_path, 'w780') : null);
          const isNear = Math.abs(idx - activeIndex) <= 3;

          return (
            <div
              key={`${item.tv ? 'tv' : 'm'}-${item.id}-${idx}`}
              data-carousel-page
              className="snap-center snap-always shrink-0 w-full h-full flex items-center justify-center px-[9vw]"
            >
              <div
                onClick={() => handlePosterClick(item)}
                className="relative w-full max-w-[350px] aspect-[2/3] rounded-[6px] overflow-hidden border border-white/10 bg-[#1c2228] shadow-[0_20px_50px_rgba(0,0,0,0.65)] cursor-pointer"
              >
                {posterUrl && isNear ? (
                  <img
                    src={posterUrl}
                    alt={item.title}
                    draggable={false}
                    loading={Math.abs(idx - activeIndex) <= 1 ? 'eager' : 'lazy'}
                    className="w-full h-full object-cover select-none"
                  />
                ) : !posterUrl ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-[#667788]">
                    <Film className="w-10 h-10 mb-2 opacity-60" />
                    <span className="text-xs font-semibold text-[#99aabb] line-clamp-2">
                      {item.title}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Popover flutuante de avaliação por estrelas (0.5 a 5.0) */}
      {ratePopoverOpen && (
        <div className="relative z-20 mx-auto mb-2 px-4 py-2.5 rounded-2xl bg-[#1f262e]/95 backdrop-blur-md border border-white/15 shadow-2xl flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => {
            const fullVal = star;
            const halfVal = star - 0.5;
            const isFull = currentRating >= fullVal;
            const isHalf = !isFull && currentRating >= halfVal;

            return (
              <div key={star} className="relative w-8 h-8 flex items-center justify-center">
                <button
                  type="button"
                  aria-label={`${halfVal} stars`}
                  onClick={() => handleSelectRating(halfVal)}
                  className="absolute inset-y-0 left-0 w-1/2 z-10 cursor-pointer"
                />
                <button
                  type="button"
                  aria-label={`${fullVal} stars`}
                  onClick={() => handleSelectRating(fullVal)}
                  className="absolute inset-y-0 right-0 w-1/2 z-10 cursor-pointer"
                />
                <Star
                  className={`w-7 h-7 transition-colors ${
                    isFull
                      ? 'text-[#00e054] fill-[#00e054]'
                      : isHalf
                      ? 'text-[#00e054]'
                      : 'text-[#667788]'
                  }`}
                />
                {isHalf && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden w-1/2 flex items-center justify-start">
                    <Star className="w-7 h-7 text-[#00e054] fill-[#00e054] shrink-0" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Barra inferior com as 4 ações: Watch, Like, Rate, Watchlist */}
      <footer className="relative z-10 pt-2 pb-[calc(22px+env(safe-area-inset-bottom,0px))] px-3 grid grid-cols-4 items-center shrink-0">
        {/* 1. Watch */}
        <button
          type="button"
          onClick={handleToggleWatched}
          className="flex flex-col items-center justify-center gap-1.5 py-1 cursor-pointer active:scale-95 transition-transform"
        >
          <Eye
            strokeWidth={1.8}
            className={`w-8 h-8 transition-colors ${
              isWatched ? 'text-[#00e054]' : 'text-[#99aabb]'
            }`}
          />
          <span
            className={`text-[12px] font-normal leading-none ${
              isWatched ? 'text-white' : 'text-[#99aabb]'
            }`}
          >
            {isWatched ? t('action_watched') : t('action_watch')}
          </span>
        </button>

        {/* 2. Like */}
        <button
          type="button"
          onClick={handleToggleLike}
          className="flex flex-col items-center justify-center gap-1.5 py-1 cursor-pointer active:scale-95 transition-transform"
        >
          <Heart
            strokeWidth={1.8}
            className={`w-8 h-8 transition-colors ${
              isLiked ? 'text-[#ff8000] fill-[#ff8000]' : 'text-[#99aabb]'
            }`}
          />
          <span
            className={`text-[12px] font-normal leading-none ${
              isLiked ? 'text-white' : 'text-[#99aabb]'
            }`}
          >
            {isLiked ? t('action_liked') : t('action_like')}
          </span>
        </button>

        {/* 3. Rate */}
        <button
          type="button"
          onClick={() => setRatePopoverOpen((v) => !v)}
          className="flex flex-col items-center justify-center gap-1.5 py-1 cursor-pointer active:scale-95 transition-transform"
        >
          <Star
            strokeWidth={1.8}
            className={`w-8 h-8 transition-colors ${
              currentRating > 0
                ? 'text-[#00e054] fill-[#00e054]'
                : ratePopoverOpen
                ? 'text-white'
                : 'text-[#99aabb]'
            }`}
          />
          <span
            className={`text-[12px] font-normal leading-none ${
              currentRating > 0 ? 'text-[#00e054] tracking-tight' : 'text-[#99aabb]'
            }`}
          >
            {currentRating > 0 ? formatStarString(currentRating) : t('action_rate')}
          </span>
        </button>

        {/* 4. Watchlist */}
        <button
          type="button"
          onClick={handleToggleWatchlist}
          className="flex flex-col items-center justify-center gap-1.5 py-1 cursor-pointer active:scale-95 transition-transform"
        >
          {inWatchlist ? (
            <svg
              viewBox="0 0 28 28"
              className="w-8 h-8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="13" cy="13" r="10" fill="#40bcf4" />
              <path
                d="M13 8V13.5H8.5"
                stroke="#14181c"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="20.5"
                cy="20.5"
                r="5.2"
                fill="#c8d4e0"
                stroke="#14181c"
                strokeWidth="1.6"
              />
              <line
                x1="18.3"
                y1="20.5"
                x2="22.7"
                y2="20.5"
                stroke="#14181c"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg
              viewBox="0 0 28 28"
              className="w-8 h-8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="13"
                cy="13"
                r="9.2"
                stroke="#99aabb"
                strokeWidth="1.8"
              />
              <path
                d="M13 8.2V13.5H9"
                stroke="#99aabb"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="20.5"
                cy="20.5"
                r="4.8"
                fill="#c8d4e0"
              />
              <line
                x1="20.5"
                y1="18.2"
                x2="20.5"
                y2="22.8"
                stroke="#14181c"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
              <line
                x1="18.2"
                y1="20.5"
                x2="22.8"
                y2="20.5"
                stroke="#14181c"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            </svg>
          )}
          <span
            className={`text-[12px] font-normal leading-none ${
              inWatchlist ? 'text-white' : 'text-[#99aabb]'
            }`}
          >
            {t('action_watchlist')}
          </span>
        </button>
      </footer>
    </div>
  );

  return createPortal(modalContent, document.body);
};
