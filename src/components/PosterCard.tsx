import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Heart, MoreHorizontal, Star } from 'lucide-react';
import { tmdb } from '../services/tmdb';
import { useMovieState, useOpenActionSheet, useMovieActions } from '../context/AppContext';
import { useLongPress } from '../hooks/useLongPress';
import { useLanguage } from '../i18n/LanguageContext';

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

  // Fade-in do pôster: shimmer escuro enquanto carrega, imagem surge suave
  const [isLoaded, setIsLoaded] = useState(false);
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
        className={`relative aspect-[2/3] rounded-[4px] bg-lb-surface border border-white/12 transition-[box-shadow,opacity] duration-150 shadow-md ${
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
          className={`block w-full h-full rounded-[4px] overflow-hidden transition-opacity duration-150 ${
            faded
              ? menuOpen
                ? 'opacity-100'
                : 'opacity-25 group-hover:opacity-100'
              : ''
          }`}
        >
          {displayPosterPath ? (
            <>
              {/* Skeleton shimmer escuro atrás do pôster enquanto carrega */}
              {!isLoaded && <div className="absolute inset-0 mw-shimmer" aria-hidden="true" />}
              <img
                src={tmdb.getImageUrl(displayPosterPath, 'w500')}
                srcSet={`${tmdb.getImageUrl(displayPosterPath, 'w185')} 185w, ${tmdb.getImageUrl(displayPosterPath, 'w342')} 342w, ${tmdb.getImageUrl(displayPosterPath, 'w500')} 500w, ${tmdb.getImageUrl(displayPosterPath, 'w780')} 780w`}
                sizes={
                  size === 'sm'
                    ? '96px'
                    : size === 'lg'
                      ? '(max-width: 640px) 192px, 280px'
                      : '(max-width: 640px) 25vw, (max-width: 1024px) 22vw, 240px'
                }
                alt={displayTitle}
                onLoad={() => setIsLoaded(true)}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                loading="lazy"
                decoding="async"
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-2 text-center text-[11px] text-lb-muted bg-lb-surface">
              <span className="line-clamp-3">{displayTitle}</span>
            </div>
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
