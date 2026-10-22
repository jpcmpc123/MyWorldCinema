import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Star, Heart, ChevronDown } from 'lucide-react';
import { tmdb, type TMDBMovie } from '../services/tmdb';
import { tabDataCache } from '../services/tabDataCache';
import { PosterCard } from '../components/PosterCard';
import { useLanguage } from '../i18n/LanguageContext';

export const FilmsHubPage: React.FC = () => {
  const { t } = useLanguage();
  const [cachedHub] = useState(() => tabDataCache.getFilmsHub());
  const [popularFilms, setPopularFilms] = useState<TMDBMovie[]>(() =>
    cachedHub ? cachedHub.popular.slice(0, 16) : [],
  );
  const [justReviewedFilms, setJustReviewedFilms] = useState<TMDBMovie[]>(() =>
    cachedHub ? cachedHub.mostAnticipated.slice(0, 12) : [],
  );
  const [, setLoading] = useState(() => !cachedHub);

  // Search input in "{t('find_a_film').toUpperCase()}"
  const [findQuery, setFindQuery] = useState('');
  const [findResults, setFindResults] = useState<TMDBMovie[]>([]);
  const [, setIsSearching] = useState(false);
  const findRef = useRef<HTMLDivElement>(null);

  // Dropdown states
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const browseBarRef = useRef<HTMLDivElement>(null);

  // Carousel index for Popular Films This Week (showing 4 at a time)
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Close dropdowns on outside click (use click event and check container ref)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (browseBarRef.current && !browseBarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
      if (findRef.current && !findRef.current.contains(e.target as Node)) {
        setFindResults([]);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Search debounce
  useEffect(() => {
    if (!findQuery.trim() || findQuery.length < 2) {
      setFindResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await tmdb.searchMovies(findQuery.trim(), 1);
        setFindResults(res.results.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [findQuery]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      window.scrollTo(0, 0);
      try {
        // "Just reviewed" do hub desktop passa a ser também curado por data:
        // nada de lançados na fileira de inéditos
        const hub = await tmdb.getFilmsHubSections();
        tabDataCache.setFilmsHub(hub);
        setPopularFilms(hub.popular.slice(0, 16));
        setJustReviewedFilms(hub.mostAnticipated.slice(0, 12));
      } catch (err) {
        console.error('Failed to load films hub:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const decades = [
    '2020s', '2010s', '2000s', '1990s', '1980s', '1970s',
    '1960s', '1950s', '1940s', '1930s', '1920s', '1910s',
    '1900s', '1890s', '1880s', '1870s', '1860s',
  ];

  const handleDropdownToggle = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const handlePrevCarousel = () => {
    setCarouselIndex((prev) => (prev - 4 < 0 ? Math.max(0, popularFilms.length - 4) : prev - 4));
  };

  const handleNextCarousel = () => {
    setCarouselIndex((prev) => (prev + 4 < popularFilms.length ? prev + 4 : 0));
  };

  const currentPopularBatch = popularFilms.slice(carouselIndex, carouselIndex + 4);

  return (
    <div className="max-w-[950px] mx-auto px-4 py-6 space-y-8 select-none pb-20">
      {/* 1. TOP BROWSE BAR (Matching exact screenshot: BROWSE BY, YEAR v, RATING v, POPULAR v, GENRE v, SERVICE v, OTHER v, {t('find_a_film').toUpperCase()}) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-lb-elevated pb-2.5 text-xs">
        {/* Left: BROWSE BY + Dropdowns */}
        <div ref={browseBarRef} className="flex flex-wrap items-center gap-3 font-semibold uppercase tracking-wider text-[11px] text-lb-muted">
          <span className="text-lb-muted font-bold shrink-0">{t('browse_by').toUpperCase()}</span>

          {/* Grouped dropdown container, Letterboxd style */}
          <div className="inline-flex items-center border border-[#2c3440] rounded-[3px] divide-x divide-[#2c3440] bg-[#14181c]">

          {/* YEAR Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => handleDropdownToggle(e, 'year')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] tracking-wider uppercase transition-colors cursor-pointer ${
                openDropdown === 'year'
                  ? 'bg-lb-elevated text-white font-bold'
                  : 'text-[#9ab] hover:text-white'
              }`}
            >
              <span>{t('filter_year').toUpperCase()}</span>
              <ChevronDown className="w-3 h-3 text-lb-muted" />
            </button>

            {openDropdown === 'year' && (
                <div className="absolute left-0 top-7 w-36 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 max-h-80 overflow-y-auto normal-case font-normal text-xs divide-y divide-lb-elevated/40 mw-pop-in">
                <Link
                  to="/films/browse"
                  onClick={() => setOpenDropdown(null)}
                  className="block px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated"
                >
                  {t('common_all')}
                </Link>
                {decades.map((dec) => (
                  <Link
                    key={dec}
                    to={`/films/decade/${dec}`}
                    onClick={() => setOpenDropdown(null)}
                    className="block px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated font-mono"
                  >
                    {dec}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* RATING Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => handleDropdownToggle(e, 'rating')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] tracking-wider uppercase transition-colors cursor-pointer ${
                openDropdown === 'rating'
                  ? 'bg-lb-elevated text-white font-bold'
                  : 'text-[#9ab] hover:text-white'
              }`}
            >
              <span>{t('filter_rating').toUpperCase()}</span>
              <ChevronDown className="w-3 h-3 text-lb-muted" />
            </button>

            {openDropdown === 'rating' && (
                <div className="absolute left-0 top-7 w-44 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 normal-case font-normal text-xs mw-pop-in">
                <Link
                  to="/films/browse?sort=vote_average.desc"
                  onClick={() => setOpenDropdown(null)}
                  className="block px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated"
                >
                  {t('hub_highest_first')}
                </Link>
                <Link
                  to="/films/browse?sort=vote_average.asc"
                  onClick={() => setOpenDropdown(null)}
                  className="block px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated"
                >
                  {t('hub_lowest_first')}
                </Link>
              </div>
            )}
          </div>

          {/* POPULAR Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => handleDropdownToggle(e, 'popular')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] tracking-wider uppercase transition-colors cursor-pointer ${
                openDropdown === 'popular'
                  ? 'bg-lb-elevated text-white font-bold'
                  : 'text-[#9ab] hover:text-white'
              }`}
            >
              <span>{t('filter_popular').toUpperCase()}</span>
              <ChevronDown className="w-3 h-3 text-lb-muted" />
            </button>

            {openDropdown === 'popular' && (
                <div className="absolute left-0 top-7 w-36 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 normal-case font-normal text-xs mw-pop-in">
                <Link
                  to="/films/browse?sort=vote_count.desc"
                  onClick={() => setOpenDropdown(null)}
                  className="block px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated"
                >
                  {t('hub_all_time')}
                </Link>
                <Link
                  to={`/films/year/${new Date().getFullYear()}`}
                  onClick={() => setOpenDropdown(null)}
                  className="block px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated"
                >
                  {t('hub_this_year')}
                </Link>
                <Link
                  to="/films/browse?sort=popularity.desc"
                  onClick={() => setOpenDropdown(null)}
                  className="block px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated"
                >
                  {t('hub_this_week')}
                </Link>
              </div>
            )}
          </div>

          {/* GENRE Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => handleDropdownToggle(e, 'genre')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] tracking-wider uppercase transition-colors cursor-pointer ${
                openDropdown === 'genre'
                  ? 'bg-lb-elevated text-white font-bold'
                  : 'text-[#9ab] hover:text-white'
              }`}
            >
              <span>{t('filter_genre').toUpperCase()}</span>
              <ChevronDown className="w-3 h-3 text-lb-muted" />
            </button>

            {openDropdown === 'genre' && (
                <div className="absolute left-0 top-7 w-40 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 max-h-80 overflow-y-auto normal-case font-normal text-xs mw-pop-in">
                {tmdb.genres.map((g) => (
                  <Link
                    key={g.id}
                    to={`/films/browse?genre=${g.id}`}
                    onClick={() => setOpenDropdown(null)}
                    className="block px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* SERVICE Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => handleDropdownToggle(e, 'service')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] tracking-wider uppercase transition-colors cursor-pointer ${
                openDropdown === 'service'
                  ? 'bg-lb-elevated text-white font-bold'
                  : 'text-[#9ab] hover:text-white'
              }`}
            >
              <span>{t('filter_service').toUpperCase()}</span>
              <ChevronDown className="w-3 h-3 text-lb-muted" />
            </button>

            {openDropdown === 'service' && (
                <div className="absolute left-0 top-7 w-44 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 normal-case font-normal text-xs mw-pop-in">
                {tmdb.streamingServices.map((s) => (
                  <Link
                    key={s.id}
                    to={`/films/browse?service=${s.id}`}
                    onClick={() => setOpenDropdown(null)}
                    className="block px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* OTHER Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => handleDropdownToggle(e, 'other')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] tracking-wider uppercase transition-colors cursor-pointer ${
                openDropdown === 'other'
                  ? 'bg-lb-elevated text-white font-bold'
                  : 'text-[#9ab] hover:text-white'
              }`}
            >
              <span>{t('common_other')}</span>
              <ChevronDown className="w-3 h-3 text-lb-muted" />
            </button>

            {openDropdown === 'other' && (
                <div className="absolute left-0 top-7 w-36 bg-[#202830] border border-[#334150] rounded-xs shadow-2xl py-1 z-50 normal-case font-normal text-xs mw-pop-in">
                <Link
                  to="/films/browse?genre=99"
                  onClick={() => setOpenDropdown(null)}
                  className="block px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated"
                >
                  {t('hub_documentary')}
                </Link>
                <Link
                  to="/films/browse?genre=16"
                  onClick={() => setOpenDropdown(null)}
                  className="block px-3 py-1.5 text-lb-text hover:text-white hover:bg-lb-elevated"
                >
                  {t('hub_animation')}
                </Link>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Right: {t('find_a_film').toUpperCase()} search box */}
        <div ref={findRef} className="relative flex items-center gap-2">
          <span className="text-[11px] font-bold text-lb-muted uppercase tracking-wider shrink-0">
            {t('find_a_film').toUpperCase()}
          </span>
          <div className="relative">
            <input
              type="text"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              placeholder=""
              className="bg-[#202830] border border-lb-elevated focus:border-lb-green text-xs text-white rounded px-2.5 py-1 w-44 sm:w-56 focus:outline-none transition-colors"
            />

            {findResults.length > 0 && (
                <div className="absolute right-0 top-8 w-64 bg-lb-surface border border-lb-elevated rounded shadow-2xl overflow-hidden z-50 mw-pop-in">
                {findResults.map((m) => (
                  <Link
                    key={m.id}
                    to={`/film/${m.id}`}
                    className="p-2 flex items-center gap-2.5 hover:bg-lb-elevated block"
                  >
                    <img loading="lazy" decoding="async"
                      src={tmdb.getImageUrl(m.poster_path, 'w92')}
                      alt={m.title}
                      className="w-7 h-10 object-cover rounded bg-lb-bg shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{m.title}</p>
                      <p className="text-[10px] text-lb-muted">{m.release_date?.slice(0, 4)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. POPULAR FILMS THIS WEEK (Matching exact screenshot 4 large posters with Watched, Star, Heart stats and navigation arrows) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-lb-elevated pb-1.5">
          <h2 className="text-[11px] uppercase tracking-widest font-bold text-lb-muted">
            {t('hub_popular_films_week')}
          </h2>
          <Link
            to="/films/browse?sort=popularity.desc"
            className="text-[10px] uppercase font-bold tracking-wider text-lb-muted hover:text-white"
          >
            {t('home_more')}
          </Link>
        </div>

        <div className="relative group/carousel">
          {/* Left Arrow Button */}
          {popularFilms.length > 4 && (
            <button
              onClick={handlePrevCarousel}
              className="absolute -left-5 sm:-left-7 md:-left-8 top-[calc(50%-17px)] -translate-y-1/2 z-20 text-[#667788] hover:text-white transition-colors cursor-pointer p-1.5 focus:outline-none select-none"
              title={t('common_previous')}
              aria-label={t('common_previous')}
            >
              <svg
                className="w-4 h-9 sm:w-[18px] sm:h-[40px]"
                viewBox="0 0 16 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M11 6L3 18L11 30"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {/* 4 Large Featured Film Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {currentPopularBatch.map((movie, idx) => {
              // Exact MyWorld member counts format
              const basePop = movie.popularity || 100;
              const watchedCount = Math.round(basePop * 2.2 + (idx + 1) * 60).toLocaleString() + 'K';
              const ratingCount = Math.round(basePop * 0.4 + (idx + 1) * 20).toLocaleString() + 'K';
              const likedCount = Math.round(basePop * 0.75 + (idx + 1) * 35).toLocaleString() + 'K';

              return (
                <div key={movie.id} className="flex flex-col space-y-2">
                  {/* Poster */}
                  <PosterCard movie={movie} size="fluid" priority />

                  {/* MyWorld Triple Stats (Watched, Rating, Liked) */}
                  <div className="flex items-center justify-between text-[11px] font-semibold pt-1 px-1">
                    {/* Watched (Green Eye) */}
                    <span className="flex items-center gap-1 text-lb-green" title={t('common_watched')}>
                      <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{watchedCount}</span>
                    </span>

                    {/* Rated (Blue Stars) */}
                    <span className="flex items-center gap-1 text-lb-blue" title={t('common_rated')}>
                      <Star className="w-3 h-3 fill-lb-blue" />
                      <span>{ratingCount}</span>
                    </span>

                    {/* Liked (Orange Heart) */}
                    <span className="flex items-center gap-1 text-lb-orange" title={t('common_liked')}>
                      <Heart className="w-3 h-3 fill-lb-orange" />
                      <span>{likedCount}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Arrow Button */}
          {popularFilms.length > 4 && (
            <button
              onClick={handleNextCarousel}
              className="absolute -right-5 sm:-right-7 md:-right-8 top-[calc(50%-17px)] -translate-y-1/2 z-20 text-[#667788] hover:text-white transition-colors cursor-pointer p-1.5 focus:outline-none select-none"
              title={t('common_next')}
              aria-label={t('common_next')}
            >
              <svg
                className="w-4 h-9 sm:w-[18px] sm:h-[40px]"
                viewBox="0 0 16 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 6L13 18L5 30"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </section>

      {/* 3. JUST REVIEWED... Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-lb-elevated pb-1.5">
          <h2 className="text-[11px] uppercase tracking-widest font-bold text-lb-muted">
            {t('hub_just_reviewed')}
          </h2>
          <span className="text-[10px] text-lb-muted font-mono">
            4.027.046.426 {t('hub_films_watched')}
          </span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
          {justReviewedFilms.map((m, idx) => (
            <PosterCard key={m.id} movie={m} size="fluid" priority={idx < 6} />
          ))}
        </div>
      </section>
    </div>
  );
};
