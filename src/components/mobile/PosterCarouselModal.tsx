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
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [ratePopoverOpen, setRatePopoverOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const isDraggingHorizontallyRef = useRef<boolean | null>(null);
  const didMoveRef = useRef<boolean>(false);
  const animTimeoutRef = useRef<number | null>(null);
  const endTriggeredForLengthRef = useRef<number>(0);

  const getPosterUrl = useCallback(
    (item: CarouselMovieItem | undefined) => {
      if (!item) return null;
      const override = movieOverrides[item.id];
      return (
        override?.poster ||
        (item.poster_path ? tmdb.getImageUrl(item.poster_path, 'w342') : null)
      );
    },
    [movieOverrides],
  );

  const getBgUrl = useCallback(
    (item: CarouselMovieItem | undefined) => {
      if (!item) return null;
      const override = movieOverrides[item.id];
      return (
        override?.poster ||
        (item.poster_path ? tmdb.getImageUrl(item.poster_path, 'w185') : null)
      );
    },
    [movieOverrides],
  );

  // Sincroniza o índice inicial ao abrir
  useEffect(() => {
    if (!open) {
      setRatePopoverOpen(false);
      setDragOffsetPx(0);
      setIsAnimating(false);
      endTriggeredForLengthRef.current = 0;
      return;
    }
    const safeIdx = Math.max(0, Math.min(initialIndex, Math.max(0, items.length - 1)));
    setActiveIndex(safeIdx);
    setDragOffsetPx(0);
    setIsAnimating(false);
  }, [open, initialIndex]);

  // Pré-carrega de forma leve apenas o próximo pôster imediato (activeIndex + 1)
  useEffect(() => {
    if (!open || items.length === 0 || typeof Image === 'undefined') return;
    const nextItem = items[activeIndex + 1];
    const nextUrl = getPosterUrl(nextItem);
    if (nextUrl) {
      const img = new Image();
      img.src = nextUrl;
    }
  }, [open, activeIndex, items, getPosterUrl]);

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

  // Fecha no ESC e permite navegação por setas no teclado
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && activeIndex < items.length - 1) {
        setActiveIndex((i) => i + 1);
      }
      if (e.key === 'ArrowLeft' && activeIndex > 0) {
        setActiveIndex((i) => i - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, activeIndex, items.length]);

  // Dispara carregamento de mais itens apenas quando faltar pouco para o fim
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

  useEffect(() => {
    return () => {
      if (animTimeoutRef.current !== null) {
        window.clearTimeout(animTimeoutRef.current);
      }
    };
  }, []);

  if (!open || items.length === 0 || typeof document === 'undefined') return null;

  const safeActiveIdx = Math.min(activeIndex, items.length - 1);
  const currentItem = items[safeActiveIdx] || items[0];
  const prevItem = safeActiveIdx > 0 ? items[safeActiveIdx - 1] : undefined;
  const nextItem = safeActiveIdx < items.length - 1 ? items[safeActiveIdx + 1] : undefined;

  const currentYear = currentItem.release_date ? currentItem.release_date.slice(0, 4) : '';
  const isWatched = isMovieWatched(currentItem.id);
  const isLiked = isMovieLiked(currentItem.id);
  const inWatchlist = isMovieInWatchlist(currentItem.id);
  const currentRating = ratingsMap[currentItem.id] || 0;

  const viewportWidth =
    containerRef.current?.clientWidth ||
    (typeof window !== 'undefined' ? window.innerWidth : 360);

  // Progresso normalizado do arrasto (-1 ao puxar para o próximo, +1 ao puxar para o anterior)
  const dragRatio = Math.max(-1, Math.min(1, dragOffsetPx / Math.max(1, viewportWidth)));
  const absDragRatio = Math.abs(dragRatio);

  const neighborItem = dragRatio < 0 ? nextItem : dragRatio > 0 ? prevItem : undefined;
  const currentBgUrl = getBgUrl(currentItem);
  const neighborBgUrl = getBgUrl(neighborItem);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    if (animTimeoutRef.current !== null) {
      window.clearTimeout(animTimeoutRef.current);
      animTimeoutRef.current = null;
    }
    setIsAnimating(false);
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartTimeRef.current = performance.now();
    isDraggingHorizontallyRef.current = null;
    didMoveRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const dx = e.touches[0].clientX - touchStartXRef.current;
    const dy = e.touches[0].clientY - touchStartYRef.current;

    if (isDraggingHorizontallyRef.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      isDraggingHorizontallyRef.current = Math.abs(dx) >= Math.abs(dy);
    }

    if (!isDraggingHorizontallyRef.current) return;
    if (Math.abs(dx) > 8) {
      didMoveRef.current = true;
    }

    // Resistência elástica nas extremidades (primeiro e último pôster)
    let effectiveDx = dx;
    if ((safeActiveIdx === 0 && dx > 0) || (safeActiveIdx === items.length - 1 && dx < 0)) {
      effectiveDx = dx * 0.28;
    }

    setDragOffsetPx(effectiveDx);
  };

  const finishSwipe = () => {
    if (touchStartXRef.current === null) return;
    const dx = dragOffsetPx;
    const elapsed = Math.max(1, performance.now() - touchStartTimeRef.current);
    const velocity = dx / elapsed; // px/ms

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isDraggingHorizontallyRef.current = null;

    const threshold = viewportWidth * 0.22;
    let direction: -1 | 0 | 1 = 0;

    if ((dx < -threshold || velocity < -0.35) && safeActiveIdx < items.length - 1) {
      direction = 1; // Próximo pôster
    } else if ((dx > threshold || velocity > 0.35) && safeActiveIdx > 0) {
      direction = -1; // Pôster anterior
    }

    setIsAnimating(true);
    if (direction === 0) {
      setDragOffsetPx(0);
      animTimeoutRef.current = window.setTimeout(() => {
        setIsAnimating(false);
      }, 260);
    } else {
      // Anima até completar 100% da largura da página e então troca o índice ativo sem piscar
      const targetPx = direction === 1 ? -viewportWidth : viewportWidth;
      setDragOffsetPx(targetPx);
      setRatePopoverOpen(false);
      animTimeoutRef.current = window.setTimeout(() => {
        setIsAnimating(false);
        setDragOffsetPx(0);
        setActiveIndex((prev) =>
          Math.max(0, Math.min(items.length - 1, prev + direction)),
        );
      }, 250);
    }
  };

  const handlePosterClick = (item: CarouselMovieItem) => {
    if (didMoveRef.current) return;
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

  // Renderiza APENAS 3 painéis (anterior, atual e próximo) — super leve, zero corte de GPU!
  const slides: Array<{ item: CarouselMovieItem; offsetPercent: number; slotKey: string }> = [];
  if (prevItem) {
    slides.push({ item: prevItem, offsetPercent: -100, slotKey: `prev-${prevItem.id}` });
  }
  slides.push({ item: currentItem, offsetPercent: 0, slotKey: `curr-${currentItem.id}` });
  if (nextItem) {
    slides.push({ item: nextItem, offsetPercent: 100, slotKey: `next-${nextItem.id}` });
  }

  const modalContent = (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[120] bg-[#14181c] flex flex-col overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label={currentItem.title}
    >
      {/* Fundo desfocado leve (usa apenas w185 escalado em no máximo 2 imagens, sem estourar memória da GPU) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#101418]">
        {currentBgUrl && (
          <img
            key={`bg-curr-${currentItem.id}`}
            src={currentBgUrl}
            alt=""
            aria-hidden="true"
            style={{
              opacity: (1 - absDragRatio) * 0.62,
              transform: `scale(${1.22 + absDragRatio * 0.08})`,
              transition: isAnimating
                ? 'opacity 250ms ease-out, transform 250ms ease-out'
                : 'opacity 180ms ease-out',
            }}
            className="absolute inset-0 w-full h-full object-cover blur-xl"
          />
        )}
        {neighborBgUrl && absDragRatio > 0.01 && (
          <img
            key={`bg-next-${neighborItem?.id}`}
            src={neighborBgUrl}
            alt=""
            aria-hidden="true"
            style={{
              opacity: absDragRatio * 0.62,
              transform: `scale(${1.3 - absDragRatio * 0.08})`,
              transition: isAnimating
                ? 'opacity 250ms ease-out, transform 250ms ease-out'
                : 'none',
            }}
            className="absolute inset-0 w-full h-full object-cover blur-xl"
          />
        )}
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

      {/* Pista virtualizada de 3 painéis (anterior, atual, próximo): leve, sem corte de tile e 60fps */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={finishSwipe}
        onTouchCancel={finishSwipe}
        className="relative z-10 flex-1 overflow-hidden touch-pan-y"
      >
        <div
          style={{
            transform: `translate3d(${dragOffsetPx}px, 0, 0)`,
            transition: isAnimating
              ? 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'none',
          }}
          className="relative w-full h-full"
        >
          {slides.map(({ item, offsetPercent, slotKey }) => {
            const posterUrl = getPosterUrl(item);
            return (
              <div
                key={slotKey}
                style={{ left: `${offsetPercent}%` }}
                className="absolute inset-y-0 w-full h-full flex items-center justify-center px-[9vw]"
              >
                <div
                  onClick={() => handlePosterClick(item)}
                  className="relative w-full max-w-[350px] aspect-[2/3] rounded-[6px] overflow-hidden border border-white/10 bg-[#1c2228] shadow-2xl cursor-pointer"
                >
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={item.title}
                      draggable={false}
                      className="w-full h-full object-cover select-none block"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-[#667788]">
                      <Film className="w-10 h-10 mb-2 opacity-60" />
                      <span className="text-xs font-semibold text-[#99aabb] line-clamp-2">
                        {item.title}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
