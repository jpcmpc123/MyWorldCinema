import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Star, Play, X, Tv } from 'lucide-react';
import { tmdb, type TMDBMovieDetails } from '../services/tmdb';
import { WhereToWatch } from '../components/WhereToWatch';
import { PosterCard } from '../components/PosterCard';
import { Backdrop } from '../components/Backdrop';
import { openPersonProfile } from '../utils/personNav';
import { useLanguage } from '../i18n/LanguageContext';

// Página de série (/tv/:id) — versão simplificada da FilmPage:
// navegação/leitura apenas (sem log/diário/rating; o app registra FILMES).
export const SeriesDetailPage: React.FC = () => {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const tvId = Number(id);
  const location = useLocation();

  const locationState = location.state as {
    initialMovie?: {
      id: number;
      title?: string;
      name?: string;
      original_title?: string;
      original_name?: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      release_date?: string;
      first_air_date?: string;
      vote_average?: number;
      vote_count?: number;
      overview?: string;
    };
    fromPoster?: boolean;
  } | null;

  const previewShow = useMemo<TMDBMovieDetails | null>(() => {
    const init = locationState?.initialMovie;
    if (!init || Number(init.id) !== tvId) return null;
    const title = init.title || init.name || init.original_title || init.original_name || '';
    const date = init.release_date || init.first_air_date || '';
    return {
      id: tvId,
      title,
      original_title: init.original_title || init.original_name || title,
      poster_path: init.poster_path ?? null,
      backdrop_path: init.backdrop_path ?? null,
      overview: init.overview || '',
      release_date: date,
      vote_average: init.vote_average ?? 0,
      vote_count: init.vote_count ?? 0,
      popularity: 0,
      tagline: '',
      runtime: 0,
      status: '',
      budget: 0,
      revenue: 0,
      genres: [],
      production_companies: [],
      production_countries: [],
      spoken_languages: [],
      credits: { cast: [], crew: [] },
      similar: { results: [] },
      recommendations: { results: [] },
    };
  }, [locationState?.initialMovie, tvId]);

  const [show, setShow] = useState<TMDBMovieDetails | null>(() => previewShow);
  const [loading, setLoading] = useState<boolean>(() => !previewShow);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);

  useEffect(() => {
    if (!showTrailerModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTrailerModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showTrailerModal]);

  useEffect(() => {
    async function loadShow() {
      if (!tvId) return;
      window.scrollTo(0, 0);

      if (previewShow && previewShow.id === tvId) {
        setShow((prev) => (prev?.id === tvId ? prev : previewShow));
        setLoading(false);
      } else {
        setShow((prev) => (prev?.id === tvId ? prev : null));
        setLoading(true);
      }

      try {
        const details = await tmdb.getTVDetails(tvId);
        setShow(details);
      } catch (err) {
        console.error('Failed to load series details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadShow();
  }, [tvId, previewShow]);

  if (!show) {
    if (loading) {
      return (
        <div className="relative min-h-screen text-lb-text mw-slide-in-left max-w-[950px] mx-auto px-4 md:px-0 pt-16 md:pt-20">
          <div className="flex flex-col md:flex-row gap-6 items-start animate-pulse">
            <div className="w-[120px] md:w-[230px] aspect-[2/3] rounded bg-[#1c2228] flex-shrink-0" />
            <div className="flex-1 w-full space-y-3 pt-2">
              <div className="h-7 w-2/3 bg-[#1c2228] rounded" />
              <div className="h-4 w-1/3 bg-[#1c2228] rounded" />
              <div className="h-24 w-full bg-[#1c2228] rounded mt-4" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-[950px] mx-auto px-4 py-32 text-center">
        <h2 className="text-xl font-bold text-white mb-2 font-serif">{t('series_not_found')}</h2>
        <Link to="/series" className="text-sm text-lb-green hover:underline">
          {t('film_return_series')}
        </Link>
      </div>
    );
  }

  const showAny = show as unknown as Record<string, unknown>;
  const numberOfSeasons = showAny.number_of_seasons as number | undefined;

  const creators =
    show.credits?.crew.filter((c) => c.job === 'Creator' || c.job === 'Director') ?? [];
  const writers =
    show.credits?.crew
      .filter((c) => ['Screenplay', 'Writer', 'Author'].includes(c.job))
      .slice(0, 3) ?? [];
  const producers =
    show.credits?.crew
      .filter((c) => ['Producer', 'Executive Producer'].includes(c.job))
      .slice(0, 3) ?? [];

  const trailerVideo =
    show.videos?.results.find(
      (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'),
    ) || show.videos?.results.find((v) => v.site === 'YouTube');

  const releaseYear = show.release_date ? show.release_date.slice(0, 4) : '';
  const cast = show.credits?.cast?.slice(0, 18) ?? [];
  const similar = show.recommendations?.results?.slice(0, 6) ?? [];

  const backdropUrl = show.backdrop_path
    ? tmdb.getBackdropUrl(show.backdrop_path, 'w1280')
    : null;
  const posterUrl = show.poster_path ? tmdb.getImageUrl(show.poster_path, 'w780') : '';
  const posterSrcSet = show.poster_path
    ? `${tmdb.getImageUrl(show.poster_path, 'w342')} 342w, ${tmdb.getImageUrl(show.poster_path, 'w500')} 500w, ${tmdb.getImageUrl(show.poster_path, 'w780')} 780w`
    : undefined;

  return (
    <div className="relative mw-slide-in-left">
      {/* Backdrop hero */}
      {backdropUrl && (
        <div className="max-md:absolute max-md:inset-x-0 max-md:top-0 max-md:h-[calc(56.25vw+26px)] max-md:overflow-hidden max-md:z-0 max-md:[&_.backdrop-container]:!h-full max-md:[&_.backdrop-container]:!pt-0 max-md:[&_.backdropimage]:!bg-[length:110%_auto] max-md:[&_.backdropimage]:!bg-[position:-5vw_0]">
          <Backdrop src={backdropUrl} alt={show.title} />
        </div>
      )}

      <div
        className={`relative z-10 max-w-[950px] mx-auto px-4 md:px-0 pb-16 ${
          backdropUrl ? 'pt-[calc(56.25vw+11px)] md:pt-[472px]' : 'pt-20'
        }`}
      >
        <div className="flex flex-col md:flex-row gap-6 md:gap-[50px] items-start">
          {/* LEFT: poster + where to watch */}
          <div className="w-full md:w-[230px] flex-shrink-0 flex flex-col items-center md:items-start">
            <div className="hidden md:block letterboxd-poster-frame overflow-hidden flex-shrink-0">
              {posterUrl ? (
                <img
                  fetchPriority="high"
                  decoding="async"
                  src={posterUrl}
                  srcSet={posterSrcSet}
                  sizes="230px"
                  alt={show.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4 text-center text-xs text-lb-muted">
                  {show.title}
                </div>
              )}
            </div>

            <div className="w-[230px] mt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider uppercase text-lb-muted">
                  {t('film_where_watch')}
                </span>
                {trailerVideo && (
                  <button
                    onClick={() => setShowTrailerModal(true)}
                    className="inline-flex items-center gap-1.5 bg-[#202830] hover:bg-lb-elevated border border-lb-elevated text-white text-[11px] font-medium px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                  >
                    <Play className="w-2.5 h-2.5 fill-white text-white" />
                    <span>{t('trailer')}</span>
                  </button>
                )}
              </div>
              <WhereToWatch providers={show['watch/providers']} />
            </div>
          </div>

          {/* CENTER: title / year / creators / synopsis / tabs */}
          <div className="flex-1 min-w-0 md:px-2 space-y-3">
            <div className="flex gap-4 items-start">
              <div className="flex-1 min-w-0">
                {/* DESKTOP Masthead */}
                <div className="hidden md:block">
                  <h1 className="letterboxd-title text-[32px] inline mr-2.5">
                    {show.title}
                  </h1>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-lb-green border border-lb-green/50 rounded px-1.5 py-0.5 inline-flex items-center gap-1 shrink-0 mr-3 align-middle">
                    <Tv className="w-3 h-3" /> {t('nav_series')}
                  </span>
                  <div className="inline-block items-baseline">
                    {releaseYear && (
                      <Link
                        to={`/series/year/${releaseYear}`}
                        className="letterboxd-releasedate hover:text-white underline underline-offset-2 decoration-[#99aabb]/40 hover:decoration-white transition-colors mr-3 inline"
                      >
                        {releaseYear}
                      </Link>
                    )}
                    {creators.length > 0 && (
                      <span className="letterboxd-credits whitespace-nowrap mr-3 inline">
                        {t('created_by')}{' '}
                        {creators.map((c, i) => (
                          <span key={c.id}>
                            {i > 0 && ', '}
                            <Link
                              to={openPersonProfile(c.id, 'Writer')}
                              className="letterboxd-credits-name hover:text-lb-blue underline underline-offset-2 decoration-white/40 hover:decoration-lb-blue transition-colors"
                            >
                              {c.name}
                            </Link>
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>

                {/* MOBILE Masthead */}
                <div className="md:hidden">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1 className="font-serif font-bold text-[22px] text-white tracking-tight leading-tight">
                      {show.title}
                    </h1>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-lb-green border border-lb-green/50 rounded px-1.5 py-0.5 flex items-center gap-1 shrink-0">
                      <Tv className="w-3 h-3" /> {t('nav_series')}
                    </span>
                  </div>
                  {(releaseYear || creators.length > 0) && (
                    <p className="text-[11px] tracking-wider uppercase text-[#9ab] mt-1">
                      {releaseYear}
                      {releaseYear && creators.length > 0 ? ` \u2022 ${t('created_by').toUpperCase()}` : ''}
                    </p>
                  )}
                  {creators.length > 0 && (
                    <div className="text-sm font-semibold text-[#def] block mt-0.5">
                      {creators.map((c, i) => (
                        <span key={c.id}>
                          {i > 0 && ', '}
                          <Link to={openPersonProfile(c.id, 'Writer')}>
                            {c.name}
                          </Link>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pôster compacto à direita — SOMENTE mobile (padrão app Letterboxd) */}
              <div className="md:hidden w-[80px] shrink-0">
                <div className="w-full aspect-[2/3] rounded-[4px] overflow-hidden border border-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.7)] bg-lb-surface">
                  {show.poster_path && (
                    <img
                      loading="lazy"
                      decoding="async"
                      src={tmdb.getImageUrl(show.poster_path, 'w342')}
                      srcSet={posterSrcSet}
                      sizes="80px"
                      alt={show.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Tagline */}
            {show.tagline && show.tagline.trim().length > 0 && (
              <h4 className="letterboxd-tagline tagline-mobile-sm mt-[-2px] max-md:mt-6 mb-[10px]">
                {show.tagline.replace(/^"|"$/g, '')}
              </h4>
            )}

            {/* Overview / Synopsis */}
            <div
              className={`letterboxd-synopsis synopsis-mobile-sm cursor-pointer md:cursor-default ${
                !(show.tagline && show.tagline.trim().length > 0) ? 'max-md:mt-6' : ''
              }`}
              onClick={() => setShowFullSynopsis((v) => !v)}
            >
              <p className={showFullSynopsis ? '' : 'max-md:line-clamp-3'}>
                {show.overview}
                {!showFullSynopsis && <span className="md:hidden text-lb-muted"> {t('search_more')}</span>}
              </p>
            </div>

            {/* Rating / seasons chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {show.vote_average > 0 && (
                <span className="flex items-center gap-1 text-lb-green font-semibold">
                  <Star className="w-3.5 h-3.5 fill-lb-green" />
                  {(show.vote_average / 2).toFixed(1)}
                </span>
              )}
              {numberOfSeasons !== undefined && (
                <span className="text-lb-muted">
                  {numberOfSeasons} {numberOfSeasons === 1 ? t('film_season') : t('film_seasons')}
                </span>
              )}
              {show.runtime > 0 && <span className="text-lb-muted">~{show.runtime} min/ep</span>}
            </div>

            {/* Genres */}
            {show.genres && show.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {show.genres.map((g) => (
                  <Link
                    key={g.id}
                    to={`/series/genre/${g.id}`}
                    className="bg-[#202830] hover:bg-lb-elevated border border-lb-elevated hover:border-lb-green text-lb-white hover:text-white px-2.5 py-1 rounded text-xs transition-colors"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <section className="pt-4 space-y-2">
                <h2 className="text-[11px] uppercase tracking-wider font-bold text-lb-text border-b border-lb-elevated pb-1.5">
                  {t('tab_cast')}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {cast.map((actor) => (
                    <Link
                      to={openPersonProfile(actor.id, 'Actor')}
                      key={actor.id}
                      className="bg-[#202830] hover:bg-lb-elevated border border-lb-elevated hover:border-lb-border-light text-lb-white px-2.5 py-1 rounded text-xs inline-flex items-center gap-1.5 transition-colors"
                      title={actor.character ? `as ${actor.character}` : undefined}
                    >
                      <span className="font-medium">{actor.name}</span>
                      {actor.character && (
                        <span className="text-[10px] text-lb-muted">({actor.character})</span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Crew */}
            {(writers.length > 0 || producers.length > 0) && (
              <section className="pt-2 space-y-2">
                <h2 className="text-[11px] uppercase tracking-wider font-bold text-lb-text border-b border-lb-elevated pb-1.5">
                  {t('tab_crew')}
                </h2>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                  {writers.length > 0 && (
                    <div>
                      <span className="text-lb-muted uppercase block text-[10px] font-bold">
                        {t('crew_writers')}
                      </span>
                      <span className="text-white font-medium">
                        {writers.map((w, i) => (
                          <span key={w.id}>
                            {i > 0 && ', '}
                            <Link
                              to={openPersonProfile(w.id, 'Writer')}
                              className="hover:text-lb-green underline underline-offset-2 decoration-white/30 hover:decoration-lb-green transition-colors"
                            >
                              {w.name}
                            </Link>
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                  {producers.length > 0 && (
                    <div>
                      <span className="text-lb-muted uppercase block text-[10px] font-bold">
                        {t('crew_producers')}
                      </span>
                      <span className="text-white font-medium">
                        {producers.map((p, i) => (
                          <span key={p.id}>
                            {i > 0 && ', '}
                            <Link
                              to={openPersonProfile(p.id, 'Producer')}
                              className="hover:text-lb-green underline underline-offset-2 decoration-white/30 hover:decoration-lb-green transition-colors"
                            >
                              {p.name}
                            </Link>
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Similar */}
            {similar.length > 0 && (
              <section className="pt-4 space-y-2">
                <h2 className="text-[11px] uppercase tracking-wider font-bold text-lb-text border-b border-lb-elevated pb-1.5">
                  {t('film_similar_series')}
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {similar.map((m) => (
                    <PosterCard key={m.id} movie={m} size="fluid" tv disableHoverActions />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Trailer modal */}
      {showTrailerModal && trailerVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowTrailerModal(false)}
        >
          <div
            className="w-full max-w-3xl aspect-video bg-black rounded-lg overflow-hidden relative shadow-2xl border border-lb-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowTrailerModal(false)}
              className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black text-white rounded-full p-1.5 transition-colors cursor-pointer"
              aria-label={t('film_close_trailer')}
            >
              <X className="w-4 h-4" />
            </button>
            <iframe
              key={trailerVideo.key}
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${trailerVideo.key}?autoplay=1&rel=0`}
              title={`${show.title} ${t('series_trailer_title')}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SeriesDetailPage;
