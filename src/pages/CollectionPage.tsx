import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  Eye,
  LayoutGrid,
  List as ListIcon,
  SlidersHorizontal,
} from 'lucide-react';
import { tmdb, type TMDBMovie } from '../services/tmdb';
import { PosterCard } from '../components/PosterCard';
import { FiltersModal, type FiltersDraft } from '../components/mobile/FiltersModal';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../i18n/LanguageContext';

interface CollectionLocationState {
  collectionName?: string;
  initialParts?: TMDBMovie[];
}

export const CollectionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const collectionId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { isMovieWatched, isMovieInWatchlist } = useApp();

  const navState = (location.state as CollectionLocationState | null) ?? null;

  const [collectionName, setCollectionName] = useState<string>(navState?.collectionName || '');
  const [parts, setParts] = useState<TMDBMovie[]>(navState?.initialParts || []);
  const [loading, setLoading] = useState<boolean>(!(navState?.initialParts && navState.initialParts.length > 0));

  // Filter & Sort state (shared across mobile and desktop)
  const [decadeFilter, setDecadeFilter] = useState<number | undefined>(undefined);
  const [genreFilter, setGenreFilter] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('release_date.asc');
  const [watchedFilter, setWatchedFilter] = useState<'all' | 'watched' | 'unwatched'>('all');
  const [watchlistFilter, setWatchlistFilter] = useState<'any' | 'in' | 'out'>('any');
  const [fadeWatched, setFadeWatched] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'grid' | 'cards'>('grid');
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!collectionId || Number.isNaN(collectionId)) return;
    window.scrollTo(0, 0);

    let cancelled = false;
    async function loadCollection() {
      if (!(navState?.initialParts && navState.initialParts.length > 0)) {
        setLoading(true);
      }
      try {
        const col = await tmdb.getCollectionDetails(collectionId);
        if (cancelled) return;
        setCollectionName(col.name || navState?.collectionName || '');
        setParts(col.parts || []);
      } catch (err) {
        console.error('Failed to load collection details:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCollection();
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  const allDecades = useMemo(() => {
    const set = new Set<number>();
    for (const m of parts) {
      const y = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : 0;
      if (y >= 1880) set.add(Math.floor(y / 10) * 10);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [parts]);

  const sortOptions = [
    { label: t('cat_release_date'), value: 'release_date.asc' },
    { label: t('cat_release_newest'), value: 'release_date.desc' },
    { label: t('cat_film_popularity'), value: 'popularity.desc' },
    { label: t('cat_average_rating'), value: 'vote_average.desc' },
  ];

  const currentSortLabel =
    sortOptions.find((o) => o.value === sortBy)?.label || t('cat_release_date');
  const currentGenreName =
    tmdb.genres.find((g) => g.id === genreFilter)?.name || t('cat_genre_upper');

  const visibleParts = useMemo(() => {
    let list = [...parts];

    if (decadeFilter !== undefined) {
      list = list.filter((m) => {
        const y = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : 0;
        return y >= decadeFilter && y <= decadeFilter + 9;
      });
    }

    if (genreFilter !== undefined) {
      list = list.filter((m) => (m.genre_ids || []).includes(genreFilter));
    }

    if (watchedFilter === 'watched') {
      list = list.filter((m) => isMovieWatched(m.id));
    } else if (watchedFilter === 'unwatched') {
      list = list.filter((m) => !isMovieWatched(m.id));
    }

    if (watchlistFilter === 'in') {
      list = list.filter((m) => isMovieInWatchlist(m.id));
    } else if (watchlistFilter === 'out') {
      list = list.filter((m) => !isMovieInWatchlist(m.id));
    }

    list.sort((a, b) => {
      if (sortBy === 'release_date.desc') {
        return (b.release_date || '').localeCompare(a.release_date || '');
      }
      if (sortBy === 'popularity.desc') {
        return (b.popularity || 0) - (a.popularity || 0);
      }
      if (sortBy === 'vote_average.desc') {
        return (b.vote_average || 0) - (a.vote_average || 0);
      }
      if (sortBy === 'vote_average.asc') {
        return (a.vote_average || 0) - (b.vote_average || 0);
      }
      if (sortBy === 'title.asc') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return (a.release_date || '9999-12-31').localeCompare(b.release_date || '9999-12-31');
    });

    return list;
  }, [parts, decadeFilter, genreFilter, watchedFilter, watchlistFilter, sortBy, isMovieWatched, isMovieInWatchlist]);

  const handleDropdownToggle = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const applyMobileFilters = (draft: FiltersDraft) => {
    if (draft.sort === 'primary_release_date.asc') setSortBy('release_date.asc');
    else if (draft.sort === 'primary_release_date.desc') setSortBy('release_date.desc');
    else if (draft.sort) setSortBy(draft.sort);

    setFadeWatched(draft.fade !== '0');
    setGenreFilter(draft.genre ? Number(draft.genre) : undefined);
    setDecadeFilter(draft.decade ? parseInt(draft.decade.replace('s', ''), 10) : undefined);
    setWatchedFilter((draft.watched as 'all' | 'watched' | 'unwatched') || 'all');
    setWatchlistFilter((draft.watchlist as 'any' | 'in' | 'out') || 'any');
    setFiltersOpen(false);
  };

  const countBannerText =
    parts.length === 1
      ? t('collection_films_count_one')
      : t('collection_films_count_many').replace('{count}', String(parts.length));

  return (
    <div className="min-h-screen bg-[#14181c] select-none pb-24">
      {/* =====================================================================
          MOBILE HEADER (estilo app Android Letterboxd — igual à foto 1)
          ===================================================================== */}
      <header className="md:hidden bg-black fixed top-0 inset-x-0 z-40 h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => navigate(-1)}
            aria-label={t('common_back')}
            className="text-white shrink-0 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-white truncate">{collectionName}</h1>
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          aria-label={t('common_open_filters')}
          className="text-white p-1"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </header>
      <div className="md:hidden h-14 shrink-0" aria-hidden="true" />

      {/* =====================================================================
          MAIN CONTAINER (Mobile & Desktop)
          ===================================================================== */}
      <div className="max-w-[950px] mx-auto md:px-0 md:pt-8">
        {/* DESKTOP TOP HEADER + FILTER BAR (igual à foto 4 do Letterboxd PC) */}
        <div className="hidden md:flex items-baseline justify-between gap-4 border-b border-[#2c3440] pb-2.5">
          <h1 className="text-[24px] font-bold text-white tracking-tight leading-tight">
            {collectionName}
          </h1>

          <div
            ref={filterBarRef}
            className="flex flex-wrap items-center gap-4 font-semibold text-[11px] uppercase tracking-wider text-lb-muted"
          >
            {/* DECADE */}
            <div className="relative">
              <button
                onClick={(e) => handleDropdownToggle(e, 'decade')}
                className={`flex items-center gap-1 hover:text-white transition-colors cursor-pointer ${
                  openDropdown === 'decade' || decadeFilter !== undefined ? 'text-white' : ''
                }`}
              >
                <span>{decadeFilter !== undefined ? `${decadeFilter}s` : t('cat_decade_upper')}</span>
                <ChevronDown className="w-3 h-3 text-lb-muted" />
              </button>
              {openDropdown === 'decade' && (
                <div className="absolute right-0 top-6 w-36 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 normal-case font-normal text-xs divide-y divide-lb-elevated/40">
                  <button
                    onClick={() => {
                      setDecadeFilter(undefined);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 transition-colors cursor-pointer ${
                      decadeFilter === undefined
                        ? 'bg-lb-elevated text-white font-bold'
                        : 'text-lb-text hover:text-white hover:bg-lb-elevated'
                    }`}
                  >
                    {t('cat_all_decades')}
                  </button>
                  {allDecades.map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setDecadeFilter(d);
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-3 py-1.5 transition-colors cursor-pointer ${
                        decadeFilter === d
                          ? 'bg-lb-elevated text-white font-bold'
                          : 'text-lb-text hover:text-white hover:bg-lb-elevated'
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* GENRE */}
            <div className="relative">
              <button
                onClick={(e) => handleDropdownToggle(e, 'genre')}
                className={`flex items-center gap-1 hover:text-white transition-colors cursor-pointer ${
                  openDropdown === 'genre' || genreFilter !== undefined ? 'text-white' : ''
                }`}
              >
                <span>{currentGenreName}</span>
                <ChevronDown className="w-3 h-3 text-lb-muted" />
              </button>
              {openDropdown === 'genre' && (
                <div className="absolute right-0 top-6 w-40 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 max-h-72 overflow-y-auto normal-case font-normal text-xs divide-y divide-lb-elevated/40">
                  <button
                    onClick={() => {
                      setGenreFilter(undefined);
                      setOpenDropdown(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated cursor-pointer"
                  >
                    {t('common_all')}
                  </button>
                  {tmdb.genres.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => {
                        setGenreFilter(g.id);
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-3 py-1.5 transition-colors cursor-pointer ${
                        genreFilter === g.id
                          ? 'bg-lb-elevated text-white font-bold'
                          : 'text-lb-text hover:text-white hover:bg-lb-elevated'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SERVICE */}
            <div className="relative">
              <button
                onClick={(e) => handleDropdownToggle(e, 'service')}
                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              >
                <span>{t('cat_service_upper')}</span>
                <ChevronDown className="w-3 h-3 text-lb-muted" />
              </button>
              {openDropdown === 'service' && (
                <div className="absolute right-0 top-6 w-44 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 normal-case font-normal text-xs divide-y divide-lb-elevated/40">
                  <button
                    onClick={() => setOpenDropdown(null)}
                    className="w-full text-left px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated cursor-pointer"
                  >
                    {t('common_all')}
                  </button>
                </div>
              )}
            </div>

            {/* SORT BY */}
            <div className="relative">
              <button
                onClick={(e) => handleDropdownToggle(e, 'sort')}
                className={`flex items-center gap-1 hover:text-white transition-colors cursor-pointer ${
                  openDropdown === 'sort' ? 'text-white' : ''
                }`}
              >
                <span>
                  {t('flt_sort_by')} {currentSortLabel}
                </span>
                <ChevronDown className="w-3 h-3 text-lb-muted" />
              </button>
              {openDropdown === 'sort' && (
                <div className="absolute right-0 top-6 w-56 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 normal-case font-normal text-xs divide-y divide-lb-elevated/40">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSortBy(opt.value);
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-3 py-1.5 transition-colors cursor-pointer ${
                        sortBy === opt.value
                          ? 'bg-lb-elevated text-white font-bold'
                          : 'text-lb-text hover:text-white hover:bg-lb-elevated'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* EYE / FADE WATCHED */}
            <div className="relative">
              <button
                onClick={(e) => handleDropdownToggle(e, 'eye')}
                className={`flex items-center gap-0.5 hover:text-white transition-colors cursor-pointer ${
                  fadeWatched || watchedFilter !== 'all' ? 'text-lb-green' : ''
                }`}
                title={t('cat_fade_watched')}
              >
                <Eye className="w-3.5 h-3.5" />
                <ChevronDown className="w-3 h-3 text-lb-muted" />
              </button>
              {openDropdown === 'eye' && (
                <div className="absolute right-0 top-6 w-48 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1.5 z-50 normal-case font-normal text-xs space-y-1">
                  <button
                    onClick={() => setFadeWatched((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated cursor-pointer"
                  >
                    <span>{t('cat_fade_watched')}</span>
                    <span className={fadeWatched ? 'text-lb-green font-bold' : 'text-lb-muted'}>
                      {fadeWatched ? '✓' : ''}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* VIEW MODE */}
            <button
              onClick={() => setViewMode((m) => (m === 'grid' ? 'cards' : 'grid'))}
              className="text-lb-muted hover:text-white transition-colors cursor-pointer"
              title={t('common_toggle_view')}
            >
              {viewMode === 'grid' ? (
                <LayoutGrid className="w-3.5 h-3.5" />
              ) : (
                <ListIcon className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* DESKTOP BANNER: "There are X films in this collection." */}
        {!loading && parts.length > 0 && (
          <div className="hidden md:block bg-[#202830] text-[#99aabb] text-center text-[13px] py-2.5 rounded-[3px] my-4">
            {countBannerText}
          </div>
        )}

        {/* MOBILE & DESKTOP POSTER GRID */}
        {loading && visibleParts.length === 0 ? (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5 md:gap-3.5 px-3 md:px-0 py-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="aspect-[2/3] rounded-[4px] bg-[#1c2228] animate-pulse ring-1 ring-white/10"
              />
            ))}
          </div>
        ) : visibleParts.length === 0 ? (
          <p className="text-center text-sm text-[#9ab] py-16">
            {t('common_no_results_filters')}
          </p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5 md:gap-3.5 px-3 md:px-0 py-3 md:py-2">
            {visibleParts.map((movie, index) => {
              const faded = fadeWatched && isMovieWatched(movie.id);
              const stagger =
                !faded && index < 24 ? { animationDelay: `${index * 28}ms` } : undefined;
              return (
                <div
                  key={movie.id}
                  className={faded ? '' : 'mw-page-in'}
                  style={stagger}
                >
                  <PosterCard
                    movie={movie}
                    size="fluid"
                    faded={faded}
                    showDetails={viewMode === 'cards'}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FiltersModal
        open={filtersOpen}
        initial={{
          sort:
            sortBy === 'release_date.asc'
              ? 'primary_release_date.asc'
              : sortBy === 'release_date.desc'
              ? 'primary_release_date.desc'
              : sortBy,
          fade: fadeWatched ? '1' : '0',
          ...(genreFilter ? { genre: String(genreFilter) } : {}),
          ...(decadeFilter ? { decade: `${decadeFilter}s` } : {}),
          watched: watchedFilter,
          watchlist: watchlistFilter,
        }}
        onClose={() => setFiltersOpen(false)}
        onApply={applyMobileFilters}
      />
    </div>
  );
};

export default CollectionPage;
