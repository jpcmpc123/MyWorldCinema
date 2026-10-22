import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Heart, MoreHorizontal, Star } from 'lucide-react';
import { tmdb } from '../services/tmdb';
import { useMovieState, useOpenActionSheet, useMovieActions } from '../context/AppContext';
import { useLongPress } from '../hooks/useLongPress';
import { useLanguage } from '../i18n/LanguageContext';

// Cache em memória de URLs de pôsteres já carregados na sessão para renderização instantânea (0ms, sem flash)
const loadedPosterUrls = new Set<string>();

export function markPosterUrlLoaded(url: string | null | undefined): void {
  if (url) loadedPosterUrls.add(url);
}

export function isPosterUrlLoaded(url: string | null | undefined): boolean {
  return Boolean(url && loadedPosterUrls.has(url));
}

interface PosterCardProps {
  movie: {
    id: number;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    poster_path: string | null;
    release_date?: string;
    first_air_date?: string;
    vote_average?: number;
  };
  size?: 'fluid' | 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  rank?: number;
  tv?: boolean;
  enableLongPressActions?: boolean;
  disableHoverActions?: boolean;
  faded?: boolean;
  linkState?: Record<string, unknown>;
  priority?: boolean;
  eager?: boolean;
}

const PosterCardBase: React.FC<PosterCardProps> = ({
  movie,
  size = 'md',
  rank,
  tv = false,
  enableLongPressActions = false,
  disableHoverActions = false,
  faded = false,
  linkState,
  priority = false,
  eager = false,
}) => {
  const openActionSheet = useOpenActionSheet();
  const { watched, liked, inWatchlist, rating, overridePoster } = useMovieState(movie.id);
  const { toggleWatched, toggleLikeMovie, setMovieRating, toggleWatchlist, openLogModal } = useMovieActions();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [openLeft, setOpenLeft] = useState(false);
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Fecha a abinha (popover) ao clicar fora ou apertar Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Custom poster override (Set film poster) applies site-wide
  const displayPosterPath = overridePoster || movie.poster_path;

  const isMobileViewport =
    typeof window !== 'undefined' && window.innerWidth < 640;

  // Em celulares (4 colunas ~85px CSS), w185 tem 185px reais (~15KB vs ~95KB do w342/w500),
  // carregando até 6x mais rápido em redes móveis sem perda visual.
  const urlW185 = displayPosterPath ? tmdb.getImageUrl(displayPosterPath, 'w185') : '';
  const urlW342 = displayPosterPath ? tmdb.getImageUrl(displayPosterPath, 'w342') : '';
  const urlW500 = displayPosterPath ? tmdb.getImageUrl(displayPosterPath, 'w500') : '';

  const primarySrc = !displayPosterPath
    ? ''
    : size === 'lg'
      ? isMobileViewport
        ? urlW342
        : urlW500
      : isMobileViewport
        ? urlW185
        : urlW342;

  const posterSizes = {
    fluid: 'w-full min-w-0',
    sm: 'w-24 min-w-24',
    md: 'w-36 min-w-36 md:w-40 md:min-w-40',
    lg: 'w-48 min-w-48 md:w-56 md:min-w-56',
  };

  const displayTitle =
    movie.title || movie.name || movie.original_title || movie.original_name || '';
  const rawDate = movie.release_date || movie.first_air_date || '';
  const year = rawDate ? rawDate.slice(0, 4) : '';
  const tooltipLabel = year ? `${displayTitle} (${year})` : displayTitle;

  // Estado de carregamento do pôster: se já estiver no cache em memória, nasce carregado (sem piscar)
  const [isLoaded, setIsLoaded] = useState<boolean>(() =>
    Boolean(
      primarySrc &&
        (loadedPosterUrls.has(primarySrc) ||
          (urlW185 && loadedPosterUrls.has(urlW185)) ||
          (urlW342 && loadedPosterUrls.has(urlW342))),
    ),
  );
  const [retryCount, setRetryCount] = useState(0);
  const [hasError, setHasError] = useState(false);

  useLayoutEffect(() => {
    if (!displayPosterPath) {
      setIsLoaded(false);
      setHasError(false);
      setRetryCount(0);
      return;
    }
    const alreadyCached =
      loadedPosterUrls.has(primarySrc) ||
      (urlW185 && loadedPosterUrls.has(urlW185)) ||
      (urlW342 && loadedPosterUrls.has(urlW342));

    if (alreadyCached) {
      setIsLoaded(true);
      setHasError(false);
      return;
    }

    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      markPosterUrlLoaded(primarySrc);
      setIsLoaded(true);
      setHasError(false);
      return;
    }

    setIsLoaded(false);
    setHasError(false);
    setRetryCount(0);
  }, [displayPosterPath, primarySrc, urlW185, urlW342]);

  const activeSrc =
    retryCount === 0
      ? primarySrc
      : retryCount === 1
        ? urlW342 || primarySrc
        : `${primarySrc}${primarySrc.includes('?') ? '&' : '?'}r=${retryCount}`;

  const longPressHandlers = useLongPress(
    () => {
      if (enableLongPressActions) {
        openActionSheet({ id: movie.id, title: displayTitle, release_date: rawDate });
      }
    },
    { threshold: 500 }
  );

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!menuOpen && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setOpenLeft(rect.right + 200 > window.innerWidth);
    }
    setMenuOpen((prev) => !prev);
  };

  const currentStars = hoverStar !== null ? hoverStar : (rating ?? 0);

  const handlePrefetch = () => {
    if (tv) {
      tmdb.getTVDetails(movie.id).catch(() => {});
    } else {
      tmdb.getMovieDetails(movie.id).catch(() => {});
    }
  };

  return (
    <div
      ref={cardRef}
      onMouseLeave={() => {
        if (menuOpen) setMenuOpen(false);
        setHoverStar(null);
      }}
      className={`group relative flex flex-col ${posterSizes[size]} ${
        menuOpen ? 'z-50' : 'hover:z-30'
      }`}
    >
      {/* Balão superior no hover (Desktop): "Title (Year)" */}
      {!disableHoverActions && tooltipLabel && (
        <div
          className={`hidden md:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 pointer-events-none transition-opacity duration-150 ${
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <div className="relative bg-[#445566] text-[#e2ebf3] font-bold text-[11.5px] leading-tight px-2.5 py-1.5 rounded-[4px] whitespace-nowrap shadow-lg">
            {tooltipLabel}
            <span
              className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-[#445566]"
              aria-hidden="true"
            />
          </div>
        </div>
      )}

      {/* Poster Wrapper */}
      <div
        className={`relative aspect-[2/3] rounded-[4px] bg-[#232a31] border border-white/12 transition-[box-shadow,opacity] duration-150 shadow-md ${
          !disableHoverActions
            ? menuOpen
              ? 'ring-2 ring-[#ddeeff]'
              : 'hover:ring-2 hover:ring-[#ddeeff] group-hover:ring-2 group-hover:ring-[#ddeeff]'
            : 'hover:ring-2 hover:ring-[#00e054] group-hover:ring-2 group-hover:ring-[#00e054]'
        }`}
        {...(enableLongPressActions ? longPressHandlers : {})}
        style={enableLongPressActions ? { touchAction: 'manipulation' } : undefined}
      >
        {rank !== undefined && (
          <div className="absolute top-1.5 left-1.5 z-20 bg-black/85 text-white font-bold text-xs px-2 py-0.5 rounded border border-white/20">
            #{rank}
          </div>
        )}

        <Link
          to={`${tv ? '/tv' : '/film'}/${movie.id}`}
          state={{ initialMovie: movie, fromPoster: true, ...linkState }}
          onPointerDown={handlePrefetch}
          onMouseEnter={handlePrefetch}
          onTouchStart={handlePrefetch}
          className={`relative block w-full h-full rounded-[4px] overflow-hidden transition-opacity duration-150 ${
            faded
              ? menuOpen
                ? 'opacity-100'
                : 'opacity-25 group-hover:opacity-100'
              : ''
          }`}
        >
          {/* Título centralizado (estilo Letterboxd) exibido enquanto o pôster carrega ou se ausente */}
          {(!isLoaded || !displayPosterPath || hasError) && (
            <div
              className="absolute inset-0 flex items-center justify-center p-2 text-center bg-[#232a31] select-none"
              aria-hidden={Boolean(displayPosterPath && !hasError)}
            >
              <span className="text-[11px] sm:text-xs leading-[1.3] font-normal text-[#9ab] line-clamp-4 break-words">
                {displayTitle}
              </span>
            </div>
          )}

          {displayPosterPath && !hasError && (
            <img
              ref={(el) => {
                imgRef.current = el;
                if (el && el.complete && el.naturalWidth > 0 && !isLoaded) {
                  markPosterUrlLoaded(primarySrc);
                  setIsLoaded(true);
                }
              }}
              src={activeSrc}
              srcSet={
                retryCount === 0
                  ? `${urlW185} 185w, ${urlW342} 342w, ${urlW500} 500w`
                  : undefined
              }
              sizes={
                size === 'sm'
                  ? '60px'
                  : size === 'lg'
                    ? '(max-width: 640px) 110px, 280px'
                    : '(max-width: 640px) 60px, (max-width: 1024px) 150px, 200px'
              }
              alt={displayTitle}
              onLoad={() => {
                markPosterUrlLoaded(primarySrc);
                if (urlW185) markPosterUrlLoaded(urlW185);
                setIsLoaded(true);
              }}
              onError={() => {
                if (retryCount < 2) {
                  setRetryCount((prev) => prev + 1);
                } else {
                  setHasError(true);
                }
              }}
              className={`relative z-10 w-full h-full object-cover transition-opacity duration-150 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading={priority || eager ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding="async"
            />
          )}
        </Link>

        {/* Barra inferior adaptativa no hover (Desktop): [ 👁  ♥  ••• ] */}
        {!disableHoverActions && (
          <div
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className={`hidden md:flex absolute bottom-1 left-1/2 -translate-x-1/2 z-30 items-center justify-around bg-[#14181c]/90 rounded-[3px] w-[calc(100%-6px)] max-w-[104px] py-1 px-0.5 shadow-lg transition-opacity duration-150 ${
              menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {/* Assistido (Olho) */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleWatched(movie.id);
              }}
              title={watched ? t('action_watched') : t('action_watch')}
              className="flex items-center justify-center p-0.5 cursor-pointer transition-transform active:scale-90"
            >
              <Eye
                className={`w-[15px] h-[15px] stroke-[2.2] transition-colors ${
                  watched ? 'text-[#00e054]' : 'text-[#ddeeff] hover:text-white'
                }`}
              />
            </button>

            {/* Curtir (Coração) */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleLikeMovie(movie.id);
              }}
              title={liked ? t('action_liked') : t('action_like')}
              className="flex items-center justify-center p-0.5 cursor-pointer transition-transform active:scale-90"
            >
              <Heart
                className={`w-[15px] h-[15px] transition-colors ${
                  liked
                    ? 'text-[#ff8000] fill-[#ff8000]'
                    : 'text-[#ddeeff] fill-[#ddeeff] hover:text-white hover:fill-white'
                }`}
              />
            </button>

            {/* Três Pontinhos (•••) */}
            <button
              type="button"
              onClick={handleToggleMenu}
              title={t('film_more_actions')}
              className="flex items-center justify-center p-0.5 cursor-pointer transition-transform active:scale-90"
            >
              <MoreHorizontal
                className={`w-[15px] h-[15px] stroke-[2.4] transition-colors ${
                  menuOpen ? 'text-white' : 'text-[#99aabb] hover:text-white'
                }`}
              />
            </button>
          </div>
        )}

        {/* Abinha Popover Lateral (clique nos três pontinhos •••) */}
        {!disableHoverActions && menuOpen && (
          <div
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className={`hidden md:block absolute bottom-1 z-50 w-[184px] bg-[#8899aa] text-[#232a32] rounded-[4px] shadow-[0_10px_30px_rgba(0,0,0,0.65)] divide-y divide-[#718292] text-[12.5px] font-normal select-none ${
              openLeft
                ? 'right-[calc(min(50%+52px,100%-3px)+6px)]'
                : 'left-[calc(min(50%+52px,100%-3px)+6px)]'
            }`}
          >
            {/* Seta triangular apontando para os três pontinhos */}
            <span
              aria-hidden="true"
              className={`absolute bottom-2.5 w-0 h-0 border-y-[6px] border-y-transparent ${
                openLeft
                  ? '-right-[6px] border-l-[6px] border-l-[#8899aa]'
                  : '-left-[6px] border-r-[6px] border-r-[#8899aa]'
              }`}
            />

            {/* Linha 1: 5 Estrelas Interativas */}
            <div
              className="py-2.5 px-3 flex items-center justify-center gap-1"
              onMouseLeave={() => setHoverStar(null)}
            >
              {[1, 2, 3, 4, 5].map((starIdx) => {
                const active = currentStars >= starIdx;
                return (
                  <button
                    key={starIdx}
                    type="button"
                    onMouseEnter={() => setHoverStar(starIdx)}
                    onClick={() => {
                      const nextVal = rating === starIdx ? 0 : starIdx;
                      setMovieRating(movie.id, nextVal);
                    }}
                    className="p-0.5 cursor-pointer transition-transform hover:scale-110"
                    title={`${starIdx} ★`}
                  >
                    <Star
                      className={`w-5 h-5 transition-colors ${
                        active
                          ? 'text-[#00e054] fill-[#00e054]'
                          : 'text-[#4e5d6c] fill-[#4e5d6c]'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Linha 2: Show your activity */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                navigate('/reviews');
              }}
              className="w-full py-2 px-3 text-center hover:bg-[#99aabb] hover:text-[#14181c] transition-colors cursor-pointer block"
            >
              {t('film_show_activity')}
            </button>

            {/* Linha 3: Review or log film... */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openLogModal({
                  id: movie.id,
                  title: displayTitle,
                  poster_path: movie.poster_path,
                  release_date: rawDate,
                });
              }}
              className="w-full py-2 px-3 text-center hover:bg-[#99aabb] hover:text-[#14181c] transition-colors cursor-pointer block"
            >
              {t('review_or_log')}
            </button>

            {/* Linha 4: Add to watchlist / Remove from watchlist */}
            <button
              type="button"
              onClick={() => {
                toggleWatchlist({
                  id: movie.id,
                  title: displayTitle,
                  poster_path: movie.poster_path,
                  release_date: rawDate,
                });
                setMenuOpen(false);
              }}
              className="w-full py-2 px-3 text-center hover:bg-[#99aabb] hover:text-[#14181c] transition-colors cursor-pointer block"
            >
              {inWatchlist ? t('abs_remove_watchlist') : t('abs_add_watchlist')}
            </button>

            {/* Linha 5: Add to lists... */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                navigate('/list/new');
              }}
              className="w-full py-2 px-3 text-center hover:bg-[#99aabb] hover:text-[#14181c] transition-colors cursor-pointer block"
            >
              {t('add_to_lists')}
            </button>

            {/* Linha 6: Show in lists */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                navigate('/lists');
              }}
              className="w-full py-2 px-3 text-center hover:bg-[#99aabb] hover:text-[#14181c] transition-colors cursor-pointer block"
            >
              {t('show_in_lists')}
            </button>

            {/* Linha 7: Where to watch */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                navigate(`${tv ? '/tv' : '/film'}/${movie.id}`, {
                  state: { initialMovie: movie, fromPoster: true },
                });
              }}
              className="w-full py-2 px-3 text-center hover:bg-[#99aabb] hover:text-[#14181c] transition-colors cursor-pointer rounded-b-[4px] block"
            >
              {t('film_where_watch')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Memoizado: só re-renderiza se as props mudarem (pôster por pôster),
// em vez do grid inteiro a cada mudança de estado global.
export const PosterCard = React.memo(PosterCardBase);
