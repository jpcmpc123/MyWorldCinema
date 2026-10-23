import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Eye, Heart, Clock, Minus, Star, PenLine, ListPlus, Image as ImageIcon, Share2, ImagePlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../i18n/LanguageContext';
import { tmdb } from '../services/tmdb';
import { PosterLightbox } from './PosterLightbox';

export interface ActionBottomSheetTarget {
  id: number;
  title: string;
  release_date?: string;
}

interface ActionBottomSheetProps {
  open: boolean;
  onClose: () => void;
  movie: ActionBottomSheetTarget;
  onPickImage?: (mode: 'poster' | 'backdrop') => void;
  onViewPoster?: () => void;
}

const clamp = (min: number, max: number, val: number) => Math.min(max, Math.max(min, val));

// Render rating like "★★★★½" (Letterboxd style)
const ratingToStars = (rating: number): string => {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return '★'.repeat(full) + (half ? '½' : '');
};

// Cache poster paths per film id so reopening the sheet doesn't refetch
const posterCache: Record<number, string | null> = {};

export const ActionBottomSheet: React.FC<ActionBottomSheetProps> = ({
  open,
  onClose,
  movie,
  onPickImage,
  onViewPoster,
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
    openLogModal,
  } = useApp();

  const watched = isMovieWatched(movie.id);
  const liked = isMovieLiked(movie.id);
  const inWatchlist = isMovieInWatchlist(movie.id);
  const rating = ratingsMap[movie.id] ?? 0;

  const [dragRating, setDragRating] = useState<number | null>(null);
  const displayRating = dragRating ?? rating;
  const starsRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const lastTapRef = useRef(0);
  const [posterPath, setPosterPath] = useState<string | null>(posterCache[movie.id] ?? null);
  const [showPosterLightbox, setShowPosterLightbox] = useState(false);
  // Contador de "pop" para os ícones Watch/Like/Watchlist
  const [bump, setBump] = useState(0);

  // Lazily resolve the film's poster for the "View poster" row (skip row if unavailable)
  useEffect(() => {
    if (!open) return;
    const cached = posterCache[movie.id];
    if (cached) {
      setPosterPath(cached);
      return;
    }
    let cancelled = false;
    tmdb
      .getMovieDetails(movie.id)
      .then((details) => {
        const path = details?.poster_path ?? null;
        posterCache[movie.id] = path;
        if (!cancelled) setPosterPath(path);
      })
      .catch(() => {
        /* no poster -> row stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, [open, movie.id]);

  // Lock page scroll while the sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const computeRatingFromClientX = (clientX: number): number => {
    const el = starsRef.current;
    if (!el) return displayRating || 0.5;
    const rect = el.getBoundingClientRect();
    const x = clamp(0, rect.width, clientX - rect.left);
    const computed = Math.round((x / rect.width) * 10) / 2;
    return clamp(0.5, 5, computed);
  };

  const applyRating = (clientX: number) => {
    const next = computeRatingFromClientX(clientX);
    setDragRating(next);
    setMovieRating(movie.id, next);
  };

  const handleStarsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);

    // Double-tap on the current rating clears it (set to 0)
    const next = computeRatingFromClientX(e.clientX);
    const now = Date.now();
    if (now - lastTapRef.current < 350 && Math.abs(next - rating) < 0.01) {
      lastTapRef.current = 0;
      setDragRating(null);
      setMovieRating(movie.id, 0);
      return;
    }
    lastTapRef.current = now;

    applyRating(e.clientX);
  };

  const handleStarsPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    applyRating(e.clientX);
  };

  const handleStarsPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragRating(null);
  };

  const handleShare = async () => {
    const shareData = { title: movie.title, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${movie.title} — ${shareData.url}`);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${movie.title} — ${shareData.url}`);
      } catch {
        /* clipboard unavailable */
      }
    }
    onClose();
  };

  const handleViewPoster = () => {
    onClose();
    if (onViewPoster) {
      onViewPoster();
      return;
    }
    if (posterPath) {
      setShowPosterLightbox(true);
    }
  };

  const year = movie.release_date ? movie.release_date.slice(0, 4) : '';

  const rowClass =
    'w-full text-left px-4 py-3 text-sm text-white flex items-center gap-3 hover:bg-white/5 transition-colors';
  const rowIconClass = 'w-4 h-4 text-lb-muted shrink-0';

  return createPortal(
    <div
      className={`fixed inset-0 z-50 md:hidden ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/75 transition-opacity duration-250 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sheet — a folga inferior (65px + safe-area) mantém a última linha acima
          da BottomNav fixa de 60px; max-height evita estourar telas baixas. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={movie.title}
        className={`absolute bottom-0 left-0 right-0 bg-[#2c3440] rounded-t-2xl shadow-2xl transform transition-transform duration-[250ms] [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] max-h-[85vh] overflow-y-auto pb-[calc(65px+env(safe-area-inset-bottom,0px))] ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag handle (click to close) */}
        <div className="pt-3 pb-1 cursor-pointer" onClick={onClose}>
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
        </div>

        {/* Header: title + year */}
        <div className="text-center pb-3 px-6">
          <h2 className="text-white font-bold text-base truncate">{movie.title}</h2>
          {year && <p className="text-lb-muted text-xs mt-0.5">{year}</p>}
        </div>

        {/* Three big status buttons (ícone faz "pop" sutil ao alternar) */}
        <div className="flex items-stretch px-4 py-2 border-y border-white/5">
          <button
            onClick={() => {
              setBump((k) => k + 1);
              toggleWatched(movie.id);
            }}
            aria-label={watched ? t('abs_marked_watched') : t('abs_mark_watched')}
            className={`flex-1 flex flex-col items-center gap-1 py-2 transition-colors ${
              watched ? 'text-[#00e054]' : 'text-lb-text hover:text-white'
            }`}
          >
            <Eye key={`w${bump}`} className={`w-7 h-7 ${watched && bump > 0 ? 'mw-icon-pop' : ''}`} />
            <span className="text-[10px] uppercase tracking-wide text-lb-text">
              {watched ? t('action_watched') : t('action_watch')}
            </span>
          </button>
          <button
            onClick={() => {
              setBump((k) => k + 1);
              toggleLikeMovie(movie.id);
            }}
            aria-label={liked ? t('abs_unlike') : t('action_like')}
            className={`flex-1 flex flex-col items-center gap-1 py-2 transition-colors ${
              liked ? 'text-orange-500' : 'text-lb-text hover:text-white'
            }`}
          >
            <Heart
              key={`l${bump}`}
              className={`w-7 h-7 ${liked ? 'fill-orange-500' : ''} ${liked && bump > 0 ? 'mw-icon-pop' : ''}`}
            />
            <span className="text-[10px] uppercase tracking-wide text-lb-text">{t('action_like')}</span>
          </button>
          <button
            onClick={() => {
              setBump((k) => k + 1);
              toggleWatchlist({
                id: movie.id,
                title: movie.title,
                poster_path: posterPath,
                release_date: movie.release_date ?? '',
              });
            }}
            aria-label={inWatchlist ? t('abs_remove_watchlist') : t('abs_add_watchlist')}
            className={`flex-1 flex flex-col items-center gap-1 py-2 transition-colors ${
              inWatchlist ? 'text-[#40bcf4]' : 'text-lb-text hover:text-white'
            }`}
          >
            <span className="relative">
              <Clock key={`wl${bump}`} className={`w-7 h-7 ${inWatchlist && bump > 0 ? 'mw-icon-pop' : ''}`} />
              {inWatchlist && (
                <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#40bcf4] flex items-center justify-center">
                  <Minus className="w-2.5 h-2.5 text-[#2c3440]" strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-lb-text">{t('action_watchlist')}</span>
          </button>
        </div>

        {/* Draggable star rating */}
        <div className="flex flex-col items-center gap-1.5 py-4">
          <div
            ref={starsRef}
            className="inline-flex items-center gap-1 touch-none select-none px-4 cursor-pointer"
            onPointerDown={handleStarsPointerDown}
            onPointerMove={handleStarsPointerMove}
            onPointerUp={handleStarsPointerUp}
            onPointerCancel={handleStarsPointerUp}
          >
            {[0, 1, 2, 3, 4].map((starIndex) => {
              const fillAmount = Math.max(0, Math.min(1, displayRating - starIndex));
              const isFull = fillAmount >= 1;
              const isHalf = fillAmount >= 0.5 && fillAmount < 1;
              return (
                <div key={starIndex} className="relative">
                  <Star className="w-8 h-8 text-lb-border stroke-[1.5]" />
                  {(isFull || isHalf) && (
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: isFull ? '100%' : '50%' }}
                    >
                      <Star className="w-8 h-8 text-[#00e054] fill-[#00e054] stroke-[#00e054]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <span className="text-xs text-lb-muted tabular-nums">
            {displayRating > 0 ? `${ratingToStars(displayRating)} (${displayRating}/5)` : t('abs_not_rated')}
          </span>
        </div>

        {/* Action list */}
        <div>
          <button
            className={`${rowClass} border-t border-white/5`}
            onClick={() => {
              openLogModal({
                id: movie.id,
                title: movie.title,
                poster_path: posterPath,
                release_date: movie.release_date ?? '',
              });
              onClose();
            }}
          >
            <PenLine className={rowIconClass} />
            {t('review_or_log')}
          </button>
          <button
            className={`${rowClass} border-t border-white/5`}
            onClick={() => {
              onClose();
              navigate('/list/new');
            }}
          >
            <ListPlus className={rowIconClass} />
            {t('add_to_lists')}
          </button>
          {posterPath && (
            <button className={`${rowClass} border-t border-white/5`} onClick={handleViewPoster}>
              <ImageIcon className={rowIconClass} />
              {t('view_poster')}
            </button>
          )}
          {onPickImage && (
            <>
              <button
                className={`${rowClass} border-t border-white/5`}
                onClick={() => {
                  onPickImage('poster');
                  onClose();
                }}
              >
                <ImagePlus className={rowIconClass} />
                {t('set_poster')}
              </button>
              <button
                className={`${rowClass} border-t border-white/5`}
                onClick={() => {
                  onPickImage('backdrop');
                  onClose();
                }}
              >
                <ImagePlus className={rowIconClass} />
                {t('set_backdrop')}
              </button>
            </>
          )}
          <button className={`${rowClass} border-t border-white/5`} onClick={handleShare}>
            <Share2 className={rowIconClass} />
            {t('share')}…
          </button>
        </div>
      </div>

      {posterPath && (
        <PosterLightbox
          open={showPosterLightbox}
          src={tmdb.getImageUrl(posterPath, 'w780')}
          srcSet={`${tmdb.getImageUrl(posterPath, 'w500')} 500w, ${tmdb.getImageUrl(posterPath, 'w780')} 780w, ${tmdb.getImageUrl(posterPath, 'original')} 1280w`}
          alt={movie.title}
          onClose={() => setShowPosterLightbox(false)}
        />
      )}
    </div>,
    document.body,
  );
};
