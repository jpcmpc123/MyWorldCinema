import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LayoutGrid, List as ListIcon, Star, Eye, ChevronDown } from 'lucide-react';
import { tmdb, type TMDBMovie } from '../services/tmdb';
import { PosterCard } from '../components/PosterCard';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../i18n/LanguageContext';

export const SeriesPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isMovieWatched, movieOverrides } = useApp();
  const { genre: urlGenre, decade: urlDecade, year: urlYear } = useParams<{
    genre?: string;
    decade?: string;
    year?: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const parsedYear = urlYear
    ? parseInt(urlYear, 10)
    : searchParams.get('year')
    ? parseInt(searchParams.get('year')!, 10)
    : undefined;

  const parsedDecade = urlDecade
    ? parseInt(urlDecade.replace('s', ''), 10)
    : searchParams.get('decade')
    ? parseInt(searchParams.get('decade')!.replace('s', ''), 10)
    : parsedYear
    ? Math.floor(parsedYear / 10) * 10
    : undefined;

  const currentGenre = urlGenre
    ? Number(urlGenre)
    : searchParams.get('genre')
    ? Number(searchParams.get('genre'))
    : undefined;
  const currentProvider = searchParams.get('service') ? Number(searchParams.get('service')) : undefined;
  const currentSort = searchParams.get('sort') || 'vote_count.desc';
  const currentPage = searchParams.get('page') ? Number(searchParams.get('page')) : 1;

  const [watchedFilter, setWatchedFilter] = useState<'all' | 'watched' | 'unwatched'>('all');
  const [fadeWatched, setFadeWatched] = useState<boolean>(false);
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [totalResults, setTotalResults] = useState(42000);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

  const allDecades = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1940, 1930];

  const currentDecadeIndex = parsedDecade !== undefined ? allDecades.indexOf(parsedDecade) : -1;
  const prevDecade =
    currentDecadeIndex >= 0 && currentDecadeIndex < allDecades.length - 1
      ? allDecades[currentDecadeIndex + 1]
      : null;
  const nextDecade = currentDecadeIndex > 0 ? allDecades[currentDecadeIndex - 1] : null;

  const decadeYears =
    parsedDecade !== undefined ? Array.from({ length: 10 }, (_, i) => parsedDecade + i) : [];

  const sortOptions = [
    { label: `${t('cat_series_popularity')} (${t('hub_this_week').toUpperCase()})`, value: 'popularity.desc' },
    { label: t('cat_series_popularity'), value: 'vote_count.desc' },
    { label: t('cat_average_rating'), value: 'vote_average.desc' },
    { label: t('cat_air_newest'), value: 'first_air_date.desc' },
    { label: t('cat_air_oldest'), value: 'first_air_date.asc' },
  ];

  const currentSortLabel =
    sortOptions.find((o) => o.value === currentSort)?.label || t('cat_series_popularity');
  const currentGenreName =
    tmdb.tvGenres.find((g) => g.id === currentGenre)?.name || t('cat_genre_upper');
  const currentServiceName =
    tmdb.streamingServices.find((s) => s.id === currentProvider)?.name || t('cat_service_upper');

  useEffect(() => {
    async function loadCatalog() {
      setLoading(true);
      window.scrollTo(0, 0);
      try {
        const isWeeklyTrending =
          currentSort === 'popularity.desc' &&
          !currentGenre &&
          parsedYear === undefined &&
          parsedDecade === undefined &&
          !currentProvider;

        const res = isWeeklyTrending
          ? await tmdb.getCuratedPopularBatch('tv', currentPage, 72)
          : currentSort === 'popularity.desc'
          ? await tmdb.getSectionMedia('tv', 'popular_week', currentPage, {
              genreId: currentGenre,
              year: parsedYear,
              decade: parsedYear ? undefined : parsedDecade,
              providerId: currentProvider,
            })
          : await tmdb.discoverTVBatch({
              genreId: currentGenre,
              year: parsedYear,
              decade: parsedYear ? undefined : parsedDecade,
              providerId: currentProvider,
              sortBy: currentSort,
              page: currentPage,
              pagesToFetch: 6,
            });
        setMovies(res.results);
        setTotalResults(res.total_results > 0 ? res.total_results : 42000);
        setTotalPages(Math.max(1, Math.min(res.total_pages, 500)));
      } catch (err) {
        console.error('Failed to load series catalog:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, [parsedDecade, parsedYear, currentGenre, currentProvider, currentSort, currentPage]);

  const updateParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (value === undefined || value === '') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.set('page', '1');
    if (key === 'genre' && urlGenre) {
      const qs = next.toString();
      navigate(`/series/browse${qs ? `?${qs}` : ''}`);
    } else {
      setSearchParams(next);
    }
    setOpenDropdown(null);
  };

  const handlePageChange = (newPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    setSearchParams(next);
  };

  const buildQueryFromCurrent = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    next.delete('decade');
    next.delete('year');
    if (currentGenre && !next.get('genre')) next.set('genre', String(currentGenre));
    const qs = next.toString();
    return qs ? `?${qs}` : '';
  };

  const handleDecadeChange = (newDecade: number | undefined) => {
    const qs = buildQueryFromCurrent();
    if (newDecade === undefined) {
      navigate(`/series/browse${qs}`);
    } else {
      navigate(`/series/decade/${newDecade}s${qs}`);
    }
    setOpenDropdown(null);
  };

  const handleYearChange = (newYear: number) => {
    const qs = buildQueryFromCurrent();
    navigate(`/series/year/${newYear}${qs}`);
    setOpenDropdown(null);
  };

  const handleDropdownToggle = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const filteredMovies =
    watchedFilter === 'watched'
      ? movies.filter((m) => isMovieWatched(m.id))
      : watchedFilter === 'unwatched'
      ? movies.filter((m) => !isMovieWatched(m.id))
      : movies;

  const selectedGenreObj = tmdb.tvGenres.find((g) => g.id === currentGenre);
  const selectedServiceObj = tmdb.streamingServices.find((s) => s.id === currentProvider);

  return (
    <div className="max-w-[950px] mx-auto px-4 py-6 space-y-5 select-none pb-20">
      {/* 1. TOP SUBHEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-lb-elevated pb-2 text-xs">
        <div className="flex items-center gap-3">
          <Link
            to="/series"
            className="text-white hover:text-lb-green font-bold uppercase tracking-wider text-sm transition-colors"
          >
            SERIES
          </Link>
        </div>

        <div ref={filterBarRef} className="flex flex-wrap items-center gap-3 sm:gap-4 font-semibold text-[11px] uppercase tracking-wider text-lb-muted">
          {/* Decade Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => handleDropdownToggle(e, 'decade')}
              className={`flex items-center gap-1 hover:text-white transition-colors cursor-pointer ${
                openDropdown === 'decade' || parsedDecade !== undefined ? 'text-white' : ''
              }`}
            >
              <span>{parsedDecade !== undefined ? `${parsedDecade}s` : t('cat_decade_upper')}</span>
              <ChevronDown className="w-3 h-3 text-lb-muted" />
            </button>
            {openDropdown === 'decade' && (
              <div className="absolute right-0 sm:left-0 top-6 w-36 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 max-h-72 overflow-y-auto normal-case font-normal text-xs divide-y divide-lb-elevated/40">
                <button
                  onClick={() => handleDecadeChange(undefined)}
                  className={`w-full text-left px-3 py-1.5 transition-colors cursor-pointer ${
                    parsedDecade === undefined
                      ? 'bg-lb-elevated text-white font-bold'
                      : 'text-lb-text hover:text-white hover:bg-lb-elevated'
                  }`}
                >
                  {t('cat_all_decades')}
                </button>
                {allDecades.map((d) => (
                  <button
                    key={d}
                    onClick={() => handleDecadeChange(d)}
                    className={`w-full text-left px-3 py-1.5 transition-colors cursor-pointer ${
                      parsedDecade === d
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

          {/* Genre Dropdown (TV genres) */}
          <div className="relative">
            <button
              onClick={(e) => handleDropdownToggle(e, 'genre')}
              className={`flex items-center gap-1 hover:text-white transition-colors cursor-pointer ${
                openDropdown === 'genre' || currentGenre ? 'text-white' : ''
              }`}
            >
              <span>{currentGenreName}</span>
              <ChevronDown className="w-3 h-3 text-lb-muted" />
            </button>
            {openDropdown === 'genre' && (
              <div className="absolute right-0 sm:left-0 top-6 w-40 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 max-h-72 overflow-y-auto normal-case font-normal text-xs divide-y divide-lb-elevated/40">
                <button
                  onClick={() => updateParam('genre', undefined)}
                  className="w-full text-left px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated cursor-pointer"
                >
                  All Genres
                </button>
                {tmdb.tvGenres.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => updateParam('genre', String(g.id))}
                    className={`w-full text-left px-3 py-1.5 transition-colors cursor-pointer ${
                      currentGenre === g.id
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

          {/* Service Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => handleDropdownToggle(e, 'service')}
              className={`flex items-center gap-1 hover:text-white transition-colors cursor-pointer ${
                openDropdown === 'service' || currentProvider ? 'text-white' : ''
              }`}
            >
              <span>{currentServiceName}</span>
              <ChevronDown className="w-3 h-3 text-lb-muted" />
            </button>
            {openDropdown === 'service' && (
              <div className="absolute right-0 sm:left-0 top-6 w-44 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 normal-case font-normal text-xs divide-y divide-lb-elevated/40">
                <button
                  onClick={() => updateParam('service', undefined)}
                  className="w-full text-left px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated cursor-pointer"
                >
                  All Services
                </button>
                {tmdb.streamingServices.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => updateParam('service', String(s.id))}
                    className={`w-full text-left px-3 py-1.5 transition-colors cursor-pointer ${
                      currentProvider === s.id
                        ? 'bg-lb-elevated text-white font-bold'
                        : 'text-lb-text hover:text-white hover:bg-lb-elevated'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => handleDropdownToggle(e, 'sort')}
              className={`flex items-center gap-1 hover:text-white transition-colors cursor-pointer ${
                openDropdown === 'sort' ? 'text-white' : ''
              }`}
            >
              <span>Sort by {currentSortLabel}</span>
              <ChevronDown className="w-3 h-3 text-lb-muted" />
            </button>
            {openDropdown === 'sort' && (
              <div className="absolute right-0 top-6 w-56 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 normal-case font-normal text-xs divide-y divide-lb-elevated/40">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateParam('sort', opt.value)}
                    className={`w-full text-left px-3 py-1.5 transition-colors cursor-pointer ${
                      currentSort === opt.value
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

          {/* Watched Eye Filter Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => handleDropdownToggle(e, 'watched')}
              title={`Filter watched: ${watchedFilter}`}
              className={`flex items-center gap-1 hover:text-white transition-colors cursor-pointer ${
                watchedFilter !== 'all' ? 'text-lb-green' : 'text-lb-muted'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <ChevronDown className="w-3 h-3 text-lb-muted" />
            </button>

            {openDropdown === 'watched' && (
              <div className="absolute right-0 top-6 w-44 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 normal-case font-normal text-xs divide-y divide-lb-elevated/40">
                <button
                  onClick={() => { setFadeWatched((v) => !v); setOpenDropdown(null); }}
                  className="w-full text-left px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated cursor-pointer flex items-center justify-between"
                >
                  <span>{t('cat_fade_watched')}</span>
                  <span className={`text-[10px] font-bold ${fadeWatched ? 'text-lb-green' : 'text-lb-muted'}`}>
                    {fadeWatched ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  onClick={() => { setWatchedFilter('all'); setOpenDropdown(null); }}
                  className={`w-full text-left px-3 py-1.5 hover:text-white hover:bg-lb-elevated cursor-pointer ${
                    watchedFilter === 'all' ? 'text-white font-bold' : 'text-lb-text'
                  }`}
                >
                  All Series
                </button>
                <button
                  onClick={() => { setWatchedFilter('watched'); setOpenDropdown(null); }}
                  className={`w-full text-left px-3 py-1.5 hover:text-white hover:bg-lb-elevated cursor-pointer ${
                    watchedFilter === 'watched' ? 'text-white font-bold' : 'text-lb-text'
                  }`}
                >
                  Watched Only
                </button>
                <button
                  onClick={() => { setWatchedFilter('unwatched'); setOpenDropdown(null); }}
                  className={`w-full text-left px-3 py-1.5 hover:text-white hover:bg-lb-elevated cursor-pointer ${
                    watchedFilter === 'unwatched' ? 'text-white font-bold' : 'text-lb-text'
                  }`}
                >
                  Unwatched Only
                </button>
              </div>
            )}
          </div>

          {/* View Mode Icons */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-lb-elevated">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded cursor-pointer transition-colors ${
                viewMode === 'grid' ? 'text-white' : 'text-lb-muted hover:text-white'
              }`}
              title={t('common_grid_view')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded cursor-pointer transition-colors ${
                viewMode === 'list' ? 'text-white' : 'text-lb-muted hover:text-white'
              }`}
              title={t('common_list_view')}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. DECADE / YEAR CAROUSEL (Only shown when a decade or year is active) */}
      {parsedDecade !== undefined && (
        <div className="bg-lb-surface border border-lb-elevated rounded px-3 py-2 flex items-center justify-between text-xs select-none shadow-md">
          <button
            onClick={() => prevDecade && handleDecadeChange(prevDecade)}
            disabled={!prevDecade}
            className="text-lb-muted hover:text-white disabled:opacity-20 cursor-pointer p-1"
            title={prevDecade ? `Go to ${prevDecade}s` : ''}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto px-2">
            <button
              onClick={() => handleDecadeChange(parsedDecade)}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                !parsedYear
                  ? 'bg-lb-elevated text-white shadow'
                  : 'text-lb-text hover:text-white hover:bg-lb-elevated/50'
              }`}
            >
              {parsedDecade}s
            </button>

            {decadeYears.map((yr) => (
              <button
                key={yr}
                onClick={() => handleYearChange(yr)}
                className={`px-2.5 py-1 rounded text-xs font-semibold font-mono transition-all cursor-pointer ${
                  parsedYear === yr
                    ? 'bg-lb-green text-lb-bg font-bold shadow'
                    : 'text-lb-text hover:text-white hover:bg-lb-elevated/50'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          <button
            onClick={() => nextDecade && handleDecadeChange(nextDecade)}
            disabled={!nextDecade}
            className="text-lb-muted hover:text-white disabled:opacity-20 cursor-pointer p-1"
            title={nextDecade ? `Go to ${nextDecade}s` : ''}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. COUNT BANNER */}
      <div className="bg-[#1b2228] border border-lb-elevated py-2 px-4 rounded text-center text-xs text-lb-muted shadow-xs">
        <p className="tracking-wide">
          There are <span className="text-lb-white font-semibold">{totalResults.toLocaleString()}</span>{' '}
          {selectedGenreObj ? (
            <>
              <strong className="text-white font-bold">{selectedGenreObj.name.toLowerCase()}</strong>{' '}
            </>
          ) : null}
          series
          {parsedYear !== undefined ? (
            <>
              {' '}released in <strong className="text-white font-bold">{parsedYear}</strong>
            </>
          ) : parsedDecade !== undefined ? (
            <>
              {' '}released in the <strong className="text-white font-bold">{parsedDecade}s</strong>
            </>
          ) : null}
          {selectedServiceObj ? (
            <>
              {' '}available on <strong className="text-white font-bold">{selectedServiceObj.name}</strong>
            </>
          ) : null}
          .
        </p>
      </div>

      {/* 4. GRID / LIST (12 columns, 72 posters per page) */}
      {loading ? (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
          {[...Array(72)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-lb-surface rounded-xs border border-lb-elevated animate-pulse" />
          ))}
        </div>
      ) : filteredMovies.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
            {filteredMovies.slice(0, 72).map((movie, idx) => (
              <PosterCard
                key={movie.id}
                movie={movie}
                size="fluid"
                tv
                enableLongPressActions
                faded={fadeWatched && watchedFilter === 'all' && isMovieWatched(movie.id)}
                priority={idx < 12}
                eager={idx < 24}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto">
            {movies.map((movie) => (
              <div
                key={movie.id}
                className="bg-lb-surface border border-lb-elevated hover:border-lb-border-light rounded p-3 flex gap-4 transition-colors group"
              >
                <Link to={`/tv/${movie.id}`} className="shrink-0">
                  <img
                    src={tmdb.getImageUrl(movieOverrides[movie.id]?.poster || movie.poster_path, 'w185')}
                    alt={movie.title}
                    loading="lazy"
                    decoding="async"
                    className="w-14 h-21 object-cover rounded shadow border border-white/10 group-hover:border-lb-green transition-colors"
                  />
                </Link>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Link
                      to={`/tv/${movie.id}`}
                      className="font-bold text-white text-sm hover:text-lb-green transition-colors"
                    >
                      {movie.title}
                    </Link>
                    <span className="text-xs text-lb-muted">{movie.release_date?.slice(0, 4)}</span>
                    {movie.vote_average ? (
                      <span className="flex items-center gap-0.5 text-lb-green text-xs font-semibold ml-2">
                        <Star className="w-3 h-3 fill-lb-green" />
                        {(movie.vote_average / 2).toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-lb-text line-clamp-2 leading-relaxed">
                    {movie.overview || t('cat_no_synopsis')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-20 text-lb-muted text-xs bg-lb-surface rounded border border-lb-elevated">
          No series found for this selection.
        </div>
      )}

      {/* 5. PAGINATION */}
      <div className="flex items-center justify-between border-t border-lb-elevated pt-6 text-xs">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={`flex items-center gap-1 px-4 py-2 rounded font-bold uppercase transition-colors ${
            currentPage > 1
              ? 'bg-lb-surface border border-lb-elevated text-white hover:border-lb-green cursor-pointer'
              : 'opacity-40 cursor-not-allowed text-lb-muted'
          }`}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>

        <span className="text-lb-text font-semibold">
          Page <span className="text-white">{currentPage}</span> of {totalPages}
        </span>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={`flex items-center gap-1 px-4 py-2 rounded font-bold uppercase transition-colors ${
            currentPage < totalPages
              ? 'bg-lb-surface border border-lb-elevated text-white hover:border-lb-green cursor-pointer'
              : 'opacity-40 cursor-not-allowed text-lb-muted'
          }`}
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default SeriesPage;
