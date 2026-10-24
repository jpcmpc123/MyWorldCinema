import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { tmdb, type TMDBMovie } from '../services/tmdb';
import { tabDataCache } from '../services/tabDataCache';
import { PosterCard, preloadPoster } from '../components/PosterCard';
import { useApp } from '../context/AppContext';
import { MobileCatalogSections } from '../components/mobile/MobileCatalogSections';
import { useLanguage } from '../i18n/LanguageContext';
import { useIsMobile } from '../hooks/useIsMobile';

export const HomePage: React.FC = () => {
  const { lists, openLogModal } = useApp();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const [cachedHub] = useState(() => tabDataCache.getFilmsHub());

  const [popularFilms, setPopularFilms] = useState<TMDBMovie[]>(() =>
    cachedHub ? cachedHub.popular.slice(0, 18) : [],
  );
  const [topRatedFilms, setTopRatedFilms] = useState<TMDBMovie[]>(() =>
    cachedHub ? cachedHub.highestRated.slice(0, 24) : [],
  );
  const [nowPlayingFilms, setNowPlayingFilms] = useState<TMDBMovie[]>(() =>
    cachedHub ? cachedHub.mostAnticipated.slice(0, 18) : [],
  );
  const [mostWatchedFilms, setMostWatchedFilms] = useState<TMDBMovie[]>(() =>
    cachedHub ? cachedHub.mostWatched.slice(0, 18) : [],
  );
  const [featuredFilm, setFeaturedFilm] = useState<TMDBMovie | null>(() =>
    cachedHub ? (cachedHub.popular[0] || null) : null,
  );
  const [loading, setLoading] = useState<boolean>(() => !cachedHub);

  useEffect(() => {
    let cancelled = false;
    const warmUpVisiblePosters = (
      pop: TMDBMovie[],
      rated: TMDBMovie[],
      watched: TMDBMovie[],
      anticipated: TMDBMovie[],
    ) => {
      const task = () => {
        if (cancelled) return;
        for (const m of pop.slice(0, 8)) preloadPoster(m.poster_path);
        for (const m of rated.slice(0, 8)) preloadPoster(m.poster_path);
        for (const m of watched.slice(0, 6)) preloadPoster(m.poster_path);
        for (const m of anticipated.slice(0, 6)) preloadPoster(m.poster_path);
      };
      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      };
      if (typeof win.requestIdleCallback === 'function') {
        win.requestIdleCallback(task, { timeout: 250 });
      } else {
        window.setTimeout(task, 50);
      }
    };

    if (cachedHub) {
      warmUpVisiblePosters(
        cachedHub.popular,
        cachedHub.highestRated,
        cachedHub.mostWatched,
        cachedHub.mostAnticipated,
      );
    }

    async function loadData() {
      try {
        const hub = await tmdb.getFilmsHubSections();
        if (cancelled) return;
        tabDataCache.setFilmsHub(hub);
        setPopularFilms(hub.popular.slice(0, 18));
        setTopRatedFilms(hub.highestRated.slice(0, 24));
        setNowPlayingFilms(hub.mostAnticipated.slice(0, 18));
        setMostWatchedFilms(hub.mostWatched.slice(0, 18));
        setFeaturedFilm(hub.popular[0] || null);
        warmUpVisiblePosters(
          hub.popular,
          hub.highestRated,
          hub.mostWatched,
          hub.mostAnticipated,
        );
      } catch (err) {
        console.error('Failed to load homepage movies:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    const onRefresh = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ registerPromise?: (p: Promise<unknown>) => void }>;
      const task = loadData();
      customEvt.detail?.registerPromise?.(task);
    };
    window.addEventListener('mw:pull-to-refresh', onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('mw:pull-to-refresh', onRefresh);
    };
  }, []);

  const popularThisWeek = React.useMemo(() => popularFilms.slice(0, 4), [popularFilms]);

  return (
    <div className="space-y-6 md:space-y-12">
      {/* Hero Section — desktop only; mobile goes straight to PRO banner + sections */}
      {!isMobile && (
        <div className="hidden md:block relative min-h-[520px] overflow-hidden bg-lb-bg border-b border-lb-elevated">
          {featuredFilm && (
            <img
              src={tmdb.getBackdropUrl(featuredFilm.backdrop_path, 'w1280')}
              srcSet={
                featuredFilm.backdrop_path
                  ? `${tmdb.getBackdropUrl(featuredFilm.backdrop_path, 'w1280')} 1280w, ${tmdb.getBackdropUrl(featuredFilm.backdrop_path, 'original')} 1920w`
                  : undefined
              }
              sizes="100vw"
              alt={featuredFilm.title}
              className="absolute inset-0 w-full h-full object-cover object-top opacity-35 filter brightness-75 backdrop-mask"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-lb-bg via-lb-bg/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-lb-bg via-transparent to-lb-bg" />

          <div className="relative max-w-[950px] mx-auto px-4 min-h-[520px] flex flex-col justify-end pt-16 pb-12">
            <div className="max-w-2xl space-y-4">
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                {t('home_hero_1')}
                <br />
                <span className="text-lb-green">{t('home_hero_2')}</span>
                <br />
                {t('home_hero_3')}
              </h1>
              <p className="text-sm md:text-base text-lb-text">
                {t('home_hero_sub')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => openLogModal()}
                  className="bg-lb-green hover:bg-lb-green-hover text-lb-bg font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-sm transition-colors shadow-[0_0_15px_rgba(0,224,84,0.4)] cursor-pointer"
                >
                  {t('home_log_now')}
                </button>
                <Link
                  to="/films"
                  className="bg-lb-elevated/80 hover:bg-lb-border text-white font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-sm transition-colors border border-white/10"
                >
                  {t('explore_films')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* pt-4 no mobile: respiro entre a faixa de abas e a primeira seção
          (o hero hidden não gera espaçamento no mobile) */}
      <div className="max-w-[950px] mx-auto px-4 pt-4 md:pt-0 space-y-8 md:space-y-14">
        {/* 4 seções de catálogo do app (Popular / Highest rated / Most watched /
            Most anticipated) — estrutura compartilhada com a aba Series */}
        {isMobile && (
          <MobileCatalogSections
            basePath="/films"
            popular={popularFilms}
            topRated={topRatedFilms}
            mostWatched={mostWatchedFilms}
            anticipated={nowPlayingFilms}
            loading={loading}
          />
        )}

        {/* Popular this week — DESKTOP: no mobile a seção vive no MobileCatalogSections */}
        {!isMobile && (
          <section className="hidden md:block space-y-4">
            <div className="flex items-center justify-between border-b border-lb-elevated pb-2">
              <h2 className="text-xs uppercase tracking-widest font-bold text-lb-text">
                {t('sec_popular_week')}
              </h2>
              <Link
                to="/films"
                className="text-xs font-semibold text-lb-muted hover:text-lb-green flex items-center transition-colors"
              >
                <span>{t('home_more')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-4 gap-2.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="aspect-[2/3] bg-lb-surface animate-pulse rounded border border-lb-elevated" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2.5">
                {popularThisWeek.map((movie) => (
                  <PosterCard key={movie.id} movie={movie} size="fluid" enableLongPressActions priority />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Second Row: Popular Lists */}
        {lists.length > 0 && (
        <div className="grid grid-cols-1 gap-10">
          {/* Popular Lists Sidebar (1 Column) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-lb-elevated pb-2">
              <h2 className="text-xs uppercase tracking-widest font-bold text-lb-text">
                {t('sec_popular_lists')}
              </h2>
              <Link to="/lists" className="text-xs font-semibold text-lb-muted hover:text-lb-green">
                {t('home_all')}
              </Link>
            </div>

            <div className="space-y-4">
              {lists.map((list) => (
                <Link
                  key={list.id}
                  to={`/list/${list.id}`}
                  className="block bg-lb-surface border border-lb-elevated rounded-lg p-3 hover:border-lb-green transition-colors group"
                >
                  {/* Overlapping mini posters */}
                  <div className="flex items-center -space-x-4 mb-3 overflow-hidden pb-1">
                    {list.movies.slice(0, 4).map((m, idx) => (
                      <img
                        key={idx}
                        loading="lazy"
                        decoding="async"
                        src={tmdb.getImageUrl(m.poster_path, 'w342')}
                        srcSet={`${tmdb.getImageUrl(m.poster_path, 'w342')} 342w, ${tmdb.getImageUrl(m.poster_path, 'w500')} 500w`}
                        sizes="48px"
                        alt={m.title}
                        className="w-12 aspect-[2/3] object-cover rounded shadow border border-white/10 group-hover:translate-y-[-2px] transition-transform"
                        style={{ zIndex: 10 - idx }}
                      />
                    ))}
                  </div>

                  <h3 className="text-xs font-bold text-white group-hover:text-lb-green transition-colors truncate">
                    {list.title}
                  </h3>
                  <div className="flex items-center justify-between text-[11px] text-lb-muted mt-1 tabular-nums">
                    <span>{list.movies.length} {t('home_films_word')}</span>
                    <span>{list.likesCount} {t('home_likes_word')}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
        )}

        {/* Top Rated Showcase — desktop only (no mobile, "Highest rated" cobre) */}
        {!isMobile && (
          <section className="hidden md:block space-y-4">
            <div className="flex items-center justify-between border-b border-lb-elevated pb-2">
              <h2 className="text-xs uppercase tracking-widest font-bold text-lb-text">
                {t('home_classics')}
              </h2>
              <Link
                to="/films/browse?sort=vote_average.desc"
                className="text-xs font-semibold text-lb-muted hover:text-lb-green flex items-center transition-colors"
              >
                <span>{t('home_browse_catalog')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
              {topRatedFilms.map((movie, idx) => (
                <PosterCard
                  key={movie.id}
                  movie={movie}
                  size="fluid"
                  enableLongPressActions
                  priority={idx < 4}
                  eager={idx < 8}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

