import React, { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Eye,
  Heart,
  Clock,
  Play,
  X,
  Check,
  BarChart2,
  Layers,
  Copy,
  ArrowLeft,
  MoreVertical,
  Users,
  ChevronRight,
  Flag,
  Loader2,
  Globe,
  User,
} from 'lucide-react';
import { tmdb, type TMDBMovieDetails } from '../services/tmdb';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage, formatMoneyUSD, formatDatePt, regionNames, languageNames, type TranslationKey } from '../i18n/LanguageContext';
import { StarRating } from '../components/StarRating';
import { RatingHistogram, UnifiedPlatformBadges } from '../components/RatingHistogram';
import {
  fetchUnifiedRatings,
  getCachedUnifiedRatings,
  type UnifiedRatingsPayload,
} from '../services/unifiedRatings';
import { WhereToWatch } from '../components/WhereToWatch';
import { PosterCard, smartImgRef, smartImgOnLoad } from '../components/PosterCard';
import {
  Backdrop,
  preloadSingleImage,
  isImageUrlPreloaded,
  getFastBackdropUrl,
  getHdBackdropUrl,
} from '../components/Backdrop';
import { openPersonProfile, personRoleFromJob, type PersonRole } from '../utils/personNav';
import { useIsMobile } from '../hooks/useIsMobile';
import {
  animateElasticIndicator,
  placeTabIndicator,
  syncTabIndicatorToButton,
  type IndicatorPos,
} from '../utils/tabIndicator';

import { ImagePickerModal } from '../components/ImagePickerModal';
import { ActionBottomSheet } from '../components/ActionBottomSheet';
import { PosterLightbox } from '../components/PosterLightbox';

export { preloadSingleImage, isImageUrlPreloaded };

export type TabKey = 'cast' | 'crew' | 'details' | 'genres' | 'releases';

const FILM_MOBILE_TABS: { key: TabKey; labelKey: TranslationKey }[] = [
  { key: 'cast', labelKey: 'tab_cast' },
  { key: 'crew', labelKey: 'tab_crew' },
  { key: 'details', labelKey: 'tab_details' },
  { key: 'genres', labelKey: 'tab_genres' },
  { key: 'releases', labelKey: 'tab_releases' },
];

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(0) + 'K';
  }
  return num.toString();
}

export function getRequiredFilmImageUrls(
  movie: TMDBMovieDetails | null,
  isMobile: boolean,
  override?: { poster?: string; backdrop?: string },
  fromPersonProfilePath?: string | null,
  extraAvatarUrls?: (string | null | undefined)[],
): string[] {
  if (!movie) return [];
  const urls = new Set<string>();

  const effectiveBackdropPath = movie.backdrop_path || movie.poster_path;
  const rawBackdrop =
    override?.backdrop ||
    (effectiveBackdropPath ? tmdb.getBackdropUrl(effectiveBackdropPath, 'original') : null);

  if (rawBackdrop) {
    const fastBackdrop = getFastBackdropUrl(rawBackdrop, isMobile);
    if (isMobile) {
      if (fastBackdrop) urls.add(fastBackdrop);
    } else {
      const hdBackdrop = getHdBackdropUrl(rawBackdrop);
      const activeBackdrop = isImageUrlPreloaded(hdBackdrop) ? hdBackdrop : fastBackdrop;
      if (activeBackdrop) urls.add(activeBackdrop);
    }
  }

  const posterUrl =
    override?.poster ||
    (movie.poster_path ? tmdb.getImageUrl(movie.poster_path, isMobile ? 'w342' : 'w500') : '');
  if (posterUrl) urls.add(posterUrl);

  if (isMobile) {
    if (fromPersonProfilePath) {
      urls.add(tmdb.getProfileUrl(fromPersonProfilePath, 'w185'));
    }
    if (movie.credits?.cast?.length) {
      const initialCast = movie.credits.cast.slice(0, 10);
      for (const actor of initialCast) {
        if (actor.profile_path) {
          urls.add(tmdb.getProfileUrl(actor.profile_path, 'w185'));
        }
      }
    }
  } else {
    const providers = movie['watch/providers']?.results;
    const countryData =
      providers?.US || providers?.BR || (providers ? Object.values(providers)[0] : null);
    if (countryData) {
      const allProviders = [...(countryData.flatrate || []), ...(countryData.rent || [])]
        .filter((item, index, self) => index === self.findIndex((p) => p.provider_id === item.provider_id))
        .slice(0, 5);
      for (const p of allProviders) {
        if (p.logo_path) {
          urls.add(tmdb.getImageUrl(p.logo_path, 'w92'));
        }
      }
    }
  }

  // Pôsteres de Filmes Relacionados (coleção) e Semelhantes visíveis na tela
  const posterSize = isMobile ? 'w185' : 'w342';
  const related = (movie.collection_parts || [])
    .filter((item) => item.poster_path && item.id !== movie.id)
    .slice(0, isMobile ? 10 : 6);
  for (const item of related) {
    if (item.poster_path) {
      urls.add(tmdb.getImageUrl(item.poster_path, posterSize));
    }
  }

  const similar = (movie.similar?.results || [])
    .filter((item) => item.poster_path)
    .slice(0, isMobile ? 10 : 6);
  for (const item of similar) {
    if (item.poster_path) {
      urls.add(tmdb.getImageUrl(item.poster_path, posterSize));
    }
  }

  if (extraAvatarUrls) {
    for (const avatar of extraAvatarUrls) {
      if (avatar) urls.add(avatar);
    }
  }

  return Array.from(urls);
}

function areAllUrlsLoaded(urls: string[]): boolean {
  return urls.every((u) => isImageUrlPreloaded(u));
}

interface InitialMoviePayload {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  directors?: string[];
}

function buildPartialMovieDetails(
  raw: InitialMoviePayload | null | undefined,
  targetId: number,
  isTv: boolean,
): TMDBMovieDetails | null {
  if (!raw || Number(raw.id) !== targetId) return null;
  const title = raw.title || raw.name || raw.original_title || raw.original_name || '';
  const originalTitle = raw.original_title || raw.original_name || title;
  const releaseDate = raw.release_date || raw.first_air_date || '';
  const crew = Array.isArray(raw.directors) && raw.directors.length > 0
    ? raw.directors.map((name, idx) => ({
        id: -(idx + 1),
        name,
        job: isTv ? 'Creator' : 'Director',
        department: 'Directing',
        profile_path: null,
      }))
    : [];

  return {
    id: targetId,
    title,
    original_title: originalTitle,
    poster_path: raw.poster_path ?? null,
    backdrop_path: raw.backdrop_path ?? null,
    overview: raw.overview ?? '',
    release_date: releaseDate,
    vote_average: raw.vote_average ?? 0,
    vote_count: raw.vote_count ?? 0,
    popularity: raw.popularity ?? 0,
    tagline: '',
    runtime: 0,
    status: '',
    budget: 0,
    revenue: 0,
    genres: [],
    production_companies: [],
    production_countries: [],
    spoken_languages: [],
    credits: { cast: [], crew },
    similar: { results: [] },
    recommendations: { results: [] },
  };
}

export const FilmPage: React.FC<{ isTvRoute?: boolean; disableSlideAnimation?: boolean }> = ({
  isTvRoute,
  disableSlideAnimation = false,
}) => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isTv = isTvRoute ?? location.pathname.startsWith('/tv/');
  const movieId = Number(id);

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
    logs,
    reviews,
    movieOverrides,
    setMovieOverride,
  } = useApp();
  const { isAuthenticated, profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const locationState = location.state as {
    initialMovie?: InitialMoviePayload;
    previewMovie?: InitialMoviePayload;
    fromPerson?: { profile_path?: string | null };
  } | null;

  const fromPersonProfilePath = locationState?.fromPerson?.profile_path;

  const cachedDetails = useMemo<TMDBMovieDetails | null>(() => {
    if (!movieId) return null;
    const cached = tmdb.getCachedDetails(movieId, isTv ? 'tv' : 'movie');
    if (cached && Array.isArray(cached.credits?.cast) && Array.isArray(cached.similar?.results)) {
      return cached;
    }
    return null;
  }, [movieId, isTv]);

  const initialPartialMovie = useMemo<TMDBMovieDetails | null>(() => {
    if (!movieId) return null;
    return buildPartialMovieDetails(
      locationState?.initialMovie ?? locationState?.previewMovie,
      movieId,
      isTv,
    );
  }, [locationState?.initialMovie, locationState?.previewMovie, movieId, isTv]);

  const seedMovie = cachedDetails ?? initialPartialMovie;

  const [movie, setMovie] = useState<TMDBMovieDetails | null>(() => seedMovie);
  const [loading, setLoading] = useState<boolean>(() => !seedMovie);
  const [assetsReady, setAssetsReady] = useState<boolean>(() => Boolean(seedMovie));

  if (movie?.id !== movieId) {
    if (seedMovie) {
      setMovie(seedMovie);
      if (loading) setLoading(false);
      if (!assetsReady) setAssetsReady(true);
    } else {
      if (movie !== null) setMovie(null);
      if (!loading) setLoading(true);
      if (assetsReady) setAssetsReady(false);
    }
  }
  const [activeTab, setActiveTab] = useState<TabKey>('cast');
  const [hasChangedTab, setHasChangedTab] = useState<boolean>(false);

  // Nota Unificada (Letterboxd, IMDb, Metacritic, Rotten Tomatoes e TMDb)
  const [unifiedRatings, setUnifiedRatings] = useState<UnifiedRatingsPayload | null>(() =>
    getCachedUnifiedRatings(movieId, isTv),
  );
  const [unifiedLoading, setUnifiedLoading] = useState<boolean>(
    () => Boolean(movieId) && !getCachedUnifiedRatings(movieId, isTv),
  );

  // Sincroniza imediatamente o cache do localStorage ao trocar de filme/série
  useLayoutEffect(() => {
    const cachedUnified = getCachedUnifiedRatings(movieId, isTv);
    setUnifiedRatings(cachedUnified);
    setUnifiedLoading(Boolean(movieId) && !cachedUnified);
  }, [movieId, isTv]);

  // Busca assíncrona na MDBList (principal) / OMDb (fallback) apenas na página de detalhes
  const movieImdbId =
    movie?.external_ids?.imdb_id ||
    ((movie as unknown as { imdb_id?: string } | null)?.imdb_id ?? null);
  const movieVoteAvg = movie?.vote_average ?? 0;

  useEffect(() => {
    if (!movieId) return;
    const cachedUnified = getCachedUnifiedRatings(movieId, isTv);
    if (cachedUnified) {
      setUnifiedRatings(cachedUnified);
      setUnifiedLoading(false);
      return;
    }

    let cancelled = false;
    setUnifiedLoading(true);

    fetchUnifiedRatings({
      tmdbId: movieId,
      isTv,
      imdbId: movieImdbId,
      tmdbVoteAverage: movieVoteAvg,
    })
      .then((res) => {
        if (cancelled) return;
        if (res) {
          setUnifiedRatings(res);
        }
        setUnifiedLoading(false);
      })
      .catch(() => {
        if (!cancelled) setUnifiedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [movieId, isTv, movieImdbId, movieVoteAvg]);

  // Elastic green indicator refs for mobile tabs
  const filmTabsContainerRef = useRef<HTMLDivElement | null>(null);
  const filmTabButtonsRef = useRef<Map<TabKey, HTMLButtonElement>>(new Map());
  const filmIndicatorRef = useRef<HTMLSpanElement | null>(null);
  const filmPrevPosRef = useRef<IndicatorPos>({ left: 0, width: 0 });
  const filmTabMountedRef = useRef<boolean>(false);
  const prevActiveTabRef = useRef<TabKey>(activeTab);

  // Reset tab and scroll to top immediately when film changes (e.g. PUSH from /film/A to /film/B)
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    setActiveTab('cast');
    setHasChangedTab(false);
    filmPrevPosRef.current = { left: 0, width: 0 };
    filmTabMountedRef.current = false;
    prevActiveTabRef.current = 'cast';
  }, [movieId]);

  const handleSelectTab = (nextTab: TabKey) => {
    if (nextTab === activeTab) return;
    setHasChangedTab(true);
    setActiveTab(nextTab);

    const targetBtn = filmTabButtonsRef.current.get(nextTab);
    if (filmTabsContainerRef.current && targetBtn) {
      const container = filmTabsContainerRef.current;
      const targetScroll = targetBtn.offsetLeft - container.clientWidth / 2 + targetBtn.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
    }
  };

  // Posiciona a barra verde com animação elástica contínua na GPU ao trocar de aba,
  // ou com posicionamento imediato no carregamento inicial (sem animação e sem atraso).
  useLayoutEffect(() => {
    if (!movie || loading || !assetsReady) return;
    const indicator = filmIndicatorRef.current;
    const targetBtn = filmTabButtonsRef.current.get(activeTab);
    if (!indicator || !targetBtn) return;

    const isTabChange = filmTabMountedRef.current && prevActiveTabRef.current !== activeTab;
    prevActiveTabRef.current = activeTab;

    const syncIndicator = (immediate: boolean) => {
      const btn = filmTabButtonsRef.current.get(activeTab);
      const ind = filmIndicatorRef.current;
      if (!btn || !ind) return;
      const left = btn.offsetLeft;
      const width = btn.offsetWidth;
      if (width <= 0) return;

      if (immediate || !filmTabMountedRef.current || filmPrevPosRef.current.width <= 0) {
        filmTabMountedRef.current = true;
        placeTabIndicator(ind, left, width, filmPrevPosRef.current);
        ind.style.opacity = '1';
      } else {
        animateElasticIndicator(btn, ind, filmPrevPosRef.current, false);
        ind.style.opacity = '1';
      }
    };

    // Troca de aba por clique: roda a animação elástica contínua na GPU
    // Primeiro carregamento da página do filme ou re-render: posiciona imediatamente
    syncIndicator(!isTabChange);

    // Se for montagem inicial, confirma o alinhamento no próximo frame sem disparar animação
    if (!isTabChange) {
      const rafId = window.requestAnimationFrame(() => {
        const btn = filmTabButtonsRef.current.get(activeTab);
        const ind = filmIndicatorRef.current;
        if (!btn || !ind || btn.offsetWidth <= 0) return;
        placeTabIndicator(ind, btn.offsetLeft, btn.offsetWidth, filmPrevPosRef.current);
        ind.style.opacity = '1';
      });
      return () => window.cancelAnimationFrame(rafId);
    }
  }, [activeTab, movie?.id, loading, assetsReady, isMobile, t]);

  // Auto-correção não-intrusiva (fontes / resize / rotação): nunca interrompe animação em curso
  useEffect(() => {
    if (!movie || loading || !assetsReady) return;
    const handleSync = () => {
      const indicator = filmIndicatorRef.current;
      const targetBtn = filmTabButtonsRef.current.get(activeTab);
      if (indicator && targetBtn && targetBtn.offsetWidth > 0) {
        syncTabIndicatorToButton(targetBtn, indicator, filmPrevPosRef.current);
        indicator.style.opacity = '1';
        filmTabMountedRef.current = true;
      }
    };

    handleSync();
    window.addEventListener('resize', handleSync);
    window.addEventListener('orientationchange', handleSync);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(handleSync).catch(() => {});
    }

    let ro: ResizeObserver | null = null;
    if (filmTabsContainerRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handleSync);
      ro.observe(filmTabsContainerRef.current);
    }

    const timer = window.setTimeout(handleSync, 120);

    return () => {
      window.removeEventListener('resize', handleSync);
      window.removeEventListener('orientationchange', handleSync);
      ro?.disconnect();
      window.clearTimeout(timer);
    };
  }, [movie?.id, activeTab, loading, assetsReady, isMobile, t]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [imagePicker, setImagePicker] = useState<'poster' | 'backdrop' | null>(null);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [showPosterLightbox, setShowPosterLightbox] = useState(false);

  // Lock body scroll while the trailer modal is open + close on Escape
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
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadFilm(attempt = 1) {
      if (!movieId) return;
      if (attempt === 1) {
        const cached = tmdb.getCachedDetails(movieId, isTv ? 'tv' : 'movie');
        if (cached && Array.isArray(cached.credits?.cast) && Array.isArray(cached.similar?.results)) {
          setMovie(cached);
          setLoading(false);
          setAssetsReady(true);
          const urls = getRequiredFilmImageUrls(
            cached,
            isMobile,
            movieOverrides[movieId],
            fromPersonProfilePath,
          );
          urls.forEach((u) => {
            void preloadSingleImage(u);
          });
          return;
        }

        if (initialPartialMovie && initialPartialMovie.id === movieId) {
          setMovie((prev) => (prev && prev.id === movieId ? prev : initialPartialMovie));
          setLoading(false);
          setAssetsReady(true);
        } else {
          setMovie(null);
          setLoading(true);
          setAssetsReady(false);
        }
      }

      try {
        const details = isTv ? await tmdb.getTVDetails(movieId) : await tmdb.getMovieDetails(movieId);
        if (cancelled) return;
        setMovie((prev) => {
          // Preserva overview/poster/backdrop do initialMovie caso a API retorne algum campo vazio
          if (prev && prev.id === details.id) {
            return {
              ...details,
              overview: details.overview || prev.overview || '',
              poster_path: details.poster_path || prev.poster_path,
              backdrop_path: details.backdrop_path || prev.backdrop_path,
            };
          }
          return details;
        });
        setAssetsReady(true);
        setLoading(false);

        const urls = getRequiredFilmImageUrls(
          details,
          isMobile,
          movieOverrides[movieId],
          fromPersonProfilePath,
        );
        urls.forEach((u) => {
          void preloadSingleImage(u);
        });
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load movie details (attempt ' + attempt + '):', err);
        if (attempt < 5) {
          retryTimer = setTimeout(() => {
            if (!cancelled) loadFilm(attempt + 1);
          }, 450 * attempt);
          return;
        }
        setLoading(false);
      }
    }

    loadFilm(1);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [movieId, isTv, isMobile, initialPartialMovie]);

  // Se o filme pertence a uma coleção mas a busca da coleção demorou >4000ms na abertura,
  // preenchemos `collection_parts` assim que ela terminar em segundo plano.
  useEffect(() => {
    if (isTv || !movie?.belongs_to_collection?.id) return;
    if (movie.collection_parts && movie.collection_parts.length > 0) return;
    let cancelled = false;
    const colId = movie.belongs_to_collection.id;
    tmdb
      .getCollectionDetails(colId)
      .then((col) => {
        if (cancelled || !col.parts?.length) return;
        setMovie((prev) =>
          prev && prev.id === movie.id
            ? {
                ...prev,
                belongs_to_collection: prev.belongs_to_collection
                  ? { ...prev.belongs_to_collection, name: col.name || prev.belongs_to_collection.name }
                  : prev.belongs_to_collection,
                collection_parts: col.parts,
              }
            : prev,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isTv, movie?.id, movie?.belongs_to_collection?.id, movie?.collection_parts?.length]);

  const isStaleMovie = Boolean(movie && movie.id !== movieId);

  if (!movie || isStaleMovie || loading || !assetsReady) {
    if (loading || isStaleMovie || (movie && !assetsReady)) {
      return (
        <div
          key="film-loading"
          className="relative min-h-[calc(100dvh-60px)] md:min-h-screen bg-lb-bg flex items-center justify-center"
        >
          <div className="md:hidden absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 pt-2.5">
            <button
              onClick={() => navigate(-1)}
              aria-label={t('film_back')}
              className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white shadow-md active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
          <Loader2 className="w-9 h-9 animate-spin text-lb-green" />
        </div>
      );
    }

    return (
      <div className="max-w-[950px] mx-auto px-4 py-32 text-center">
        <h2 className="text-xl font-bold text-white mb-2 font-serif">{isTv ? t('series_not_found') : t('film_not_found')}</h2>
        <Link to={isTv ? '/series' : '/films'} className="text-sm text-lb-green hover:underline">
          {isTv ? t('film_return_series') : t('film_return_films')}
        </Link>
      </div>
    );
  }

  // Logs & Reviews
  const userLogsForMovie = logs.filter((l) => l.movieId === movie.id);
  const movieReviews = reviews.filter((r) => r.movieId === movie.id);
  const hasUserReviewed = userLogsForMovie.some((l) => l.reviewText && l.reviewText.trim().length > 0);

  // Coleção / Franquia ("Filmes Relacionados" / "Related Films")
  const collectionId = !isTv && movie.belongs_to_collection?.id ? movie.belongs_to_collection.id : null;
  const collectionName = movie.belongs_to_collection?.name || '';
  const collectionParts = (movie.collection_parts || []).filter((item) => item.poster_path);
  const relatedFilms = collectionParts.filter((item) => item.id !== movie.id);

  // Similar (mobile): carrossel horizontal com EXATAMENTE 20 títulos, só pôsteres.
  const displaySimilar = (movie.similar?.results || []).filter((item) => item.poster_path).slice(0, 20);
  const hasBottomSections = relatedFilms.length > 0 || displaySimilar.length > 0;

  const watched = isMovieWatched(movie.id) || userLogsForMovie.length > 0;
  const liked = isMovieLiked(movie.id) || userLogsForMovie.some((l) => l.liked);
  const inWatchlist = isMovieInWatchlist(movie.id);
  const userRating = ratingsMap[movie.id] || (userLogsForMovie[0]?.rating ? userLogsForMovie[0].rating : 0);

  const movieAny = movie as unknown as Record<string, unknown>;

  // Key Crew: diretor / criador usado no cabeçalho (com fallback para autor da obra original, roteirista ou produtor)
  const crewList = movie.credits?.crew ?? [];
  const director =
    crewList.find((c) => c.job === 'Creator' || c.job === 'Director' || c.job === 'Series Director') ||
    crewList.find((c) =>
      [
        'Original Creator',
        'Original Series Creator',
        'Original Story',
        'Original Concept',
        'Graphic Novel',
        'Comic Book',
        'Manga',
        'Novel',
        'Author',
        'Series Composition',
        'Screenplay',
        'Writer',
        'Story',
      ].includes(c.job)
    ) ||
    crewList.find((c) => c.department === 'Directing' || c.department === 'Writing') ||
    crewList.find((c) => c.job === 'Executive Producer' || c.job === 'Producer') ||
    crewList[0];

  const fallbackCreditName = !director
    ? movie.production_companies?.[0]?.name ||
      (movieAny.networks as { name?: string }[] | undefined)?.[0]?.name ||
      ''
    : '';

  // Trailer finding
  const videoList = movie.videos?.results ?? [];
  const trailerVideo =
    videoList.find(
      (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    ) || videoList.find((v) => v.site === 'YouTube');

  // Format release year (filmes usam release_date; séries usam first_air_date)
  const rawReleaseDate = movie.release_date || (movieAny.first_air_date as string) || '';
  const releaseYear = rawReleaseDate ? rawReleaseDate.slice(0, 4) : '';

  // Classificação indicativa principal: prioriza BR, fallback US
  // (filmes → release_dates; séries → content_ratings)
  const certification = (() => {
    if (isTv) {
      const ratings = movie.content_ratings?.results ?? [];
      return (
        ratings.find((r) => r.iso_3166_1 === 'BR')?.rating ||
        ratings.find((r) => r.iso_3166_1 === 'US')?.rating ||
        ratings[0]?.rating ||
        ''
      );
    }
    const rel = movie.release_dates?.results ?? [];
    const pick = (iso: string) =>
      rel
        .find((r) => r.iso_3166_1 === iso)
        ?.release_dates?.find((d) => d.certification)?.certification || '';
    return pick('BR') || pick('US') || '';
  })();

  // Mobile header extras: N seasons (TV) and trailer link (videos already fetched in details)
  const numberOfSeasons = (movie as unknown as { number_of_seasons?: number }).number_of_seasons;
  const episodeRuntime =
    (movieAny.last_episode_to_air as { runtime?: number } | undefined)?.runtime ||
    ((movieAny.episode_run_time as number[] | undefined)?.[0]);
  const displayRuntime = movie.runtime || episodeRuntime || (isTv ? 48 : 0);
  const trailerUrl = trailerVideo
    ? `https://www.youtube.com/watch?v=${trailerVideo.key}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${movie.title} trailer`)}`;

  const isOdyssey = movie.id === 1368337;
  const isPridePrejudice = movie.id === 4348;

  // Proportional MyWorld stats
  const watchedStat = isPridePrejudice ? 3300000 : isOdyssey ? 4800000 : Math.max(35000, (movie.vote_count || 100) * 350);
  const ratingsStat = isPridePrejudice ? 468000 : isOdyssey ? 594000 : Math.max(8000, (movie.vote_count || 100) * 50);
  const likesStat = isPridePrejudice ? 1300000 : isOdyssey ? 2100000 : Math.max(12000, (movie.vote_count || 100) * 140);
  const listsStat = isPridePrejudice ? 470 : isOdyssey ? 113 : Math.max(120, Math.round((movie.vote_count || 100) * 0.05));

  // Sharable film URL
  const shortUrl = window.location.href;

  const override = movieOverrides[movie.id];

  const effectiveBackdropPath = movie.backdrop_path || movie.poster_path;
  const backdropUrl =
    override?.backdrop ||
    (effectiveBackdropPath ? tmdb.getBackdropUrl(effectiveBackdropPath, 'original') : null);

  const posterPath = override?.poster || movie.poster_path;
  const isCustomFullPoster = Boolean(posterPath && posterPath.startsWith('http'));
  const posterUrl =
    override?.poster ||
    tmdb.getImageUrl(movie.poster_path, 'w780');
  const posterMobileUrl =
    override?.poster ||
    tmdb.getImageUrl(movie.poster_path, 'w342');
  const posterSrcSet =
    posterPath && !isCustomFullPoster
      ? `${tmdb.getImageUrl(posterPath, 'w500')} 500w, ${tmdb.getImageUrl(posterPath, 'w780')} 780w`
      : undefined;
  const posterMobileSrcSet =
    posterPath && !isCustomFullPoster
      ? `${tmdb.getImageUrl(posterPath, 'w185')} 185w, ${tmdb.getImageUrl(posterPath, 'w342')} 342w, ${tmdb.getImageUrl(posterPath, 'w500')} 500w`
      : undefined;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareTwitter = () => {
    const text = encodeURIComponent(`${movie.title} (${releaseYear}) on MyWorld: ${window.location.href}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const shareFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  };

  return (
    <div
      key={`film-ready-${movie.id}`}
      className="relative min-h-screen bg-lb-bg md:bg-transparent text-lb-text"
    >
      {/* 1. Cinematic Hero Vignette Backdrop */}
      {backdropUrl && (
        <div className="max-md:absolute max-md:inset-x-0 max-md:top-0 max-md:h-[calc(56.25vw+26px+env(safe-area-inset-top,0px))] max-md:overflow-hidden max-md:z-0 max-md:[&_.backdrop-container]:!h-full max-md:[&_.backdrop-container]:!pt-0">
          <Backdrop src={backdropUrl} alt={movie.title} />
        </div>
      )}

      {/* Floating back + overflow buttons over the backdrop — mobile only (app-style, sem backdrop-blur pesado na GPU) */}
      <div className="md:hidden absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
        <button
          onClick={() => navigate(-1)}
          aria-label={t('film_back')}
          className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white shadow-md active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowActionSheet(true)}
          aria-label={t('film_more_actions')}
          className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white shadow-md active:scale-95 transition-transform"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Main Content Container: 3-column Letterboxd layout (950px total) */}
      <div
        className={`relative z-10 max-w-[950px] mx-auto px-4 md:px-0 pb-16 ${
          backdropUrl ? 'pt-[calc(56.25vw+11px+env(safe-area-inset-top,0px))] md:pt-[472px]' : 'pt-20'
        }`}
      >
        <div className="flex flex-col md:flex-row md:gap-x-[50px] items-start">

          {/* ========================================================
              LEFT COLUMN (w-[230px]): Poster, Stats Bar, Where to Watch (Desktop only)
              Sticky: acompanha o rolamento da página até o fim do conteúdo
              ======================================================== */}
          {!isMobile && (
            <aside
              className="hidden md:flex w-[230px] flex-shrink-0 flex-col items-start sticky top-6 self-start z-10"
            >
              {/* Film Poster (230x345px standard Letterboxd frame) */}
              <button
                type="button"
                onClick={() => setShowPosterLightbox(true)}
                aria-label={t('view_poster')}
                className="letterboxd-poster-frame overflow-hidden flex-shrink-0 cursor-pointer group relative"
              >
                <img
                  ref={smartImgRef}
                  onLoad={smartImgOnLoad}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  src={posterUrl}
                  srcSet={posterSrcSet}
                  sizes="460px"
                  alt={movie.title}
                  className="w-full h-full object-cover mw-img-fade"
                />
                <span className="absolute inset-0 ring-inset ring-2 ring-transparent group-hover:ring-[#00e054] rounded-[4px] transition-opacity pointer-events-none" />
              </button>

              {/* Production Statistics List — 10px below poster, 12px font, #667788 */}
              <div className="flex w-[230px] items-center justify-between mt-2.5 py-1 letterboxd-stats-list select-none">
                <div className="flex items-center gap-1.5 hover:text-white transition-colors" title={`${watchedStat.toLocaleString()} ${t('film_stat_watched')}`}>
                  <Eye className="w-4 h-4 text-lb-green" />
                  <span className="font-normal">{formatNumber(watchedStat)}</span>
                </div>
                <div className="flex items-center gap-1.5 hover:text-white transition-colors" title={`${ratingsStat.toLocaleString()} ${t('film_stat_ratings')}`}>
                  <BarChart2 className="w-4 h-4 text-lb-blue" />
                  <span className="font-normal">{formatNumber(ratingsStat)}</span>
                </div>
                <div className="flex items-center gap-1.5 hover:text-white transition-colors" title={`${likesStat.toLocaleString()} ${t('film_stat_likes')}`}>
                  <Heart className="w-4 h-4 text-lb-orange fill-lb-orange" />
                  <span className="font-normal">{formatNumber(likesStat)}</span>
                </div>
                <div className="flex items-center gap-1.5 hover:text-white transition-colors" title={`${listsStat.toLocaleString()} ${t('film_stat_lists')}`}>
                  <Layers className="w-4 h-4 text-[#e5a00d]" />
                  <span className="font-normal">{formatNumber(listsStat)}</span>
                </div>
              </div>

              {/* Where to Watch — desktop only */}
              <div className="w-[230px] max-w-full mt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-lb-muted">
                    {t('film_where_watch')}
                  </span>
                  {trailerVideo ? (
                    <button
                      onClick={() => setShowTrailerModal(true)}
                      className="inline-flex items-center gap-1.5 bg-[#202830] hover:bg-lb-elevated border border-lb-elevated text-white text-[11px] font-medium px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                    >
                      <Play className="w-2.5 h-2.5 fill-white text-white" />
                      <span>{t('trailer')}</span>
                    </button>
                  ) : null}
                </div>

                {/* Providers Pill Box */}
                <WhereToWatch providers={movie['watch/providers']} />
              </div>
            </aside>
          )}

          {/* ========================================================
              RIGHT CONTENT AREA (w-[670px] no desktop):
              1. Masthead: Title + Year + Director (670px)
              2. Row: Center Column (390px) + Right Sidebar (230px)
              3. Bottom: Related Films + Similar Films (670px)
              ======================================================== */}
          <div className="w-full md:w-[670px] min-w-0 flex flex-col">
            {/* Masthead: Title + Year + Director */}
            <div className="w-full min-w-0 md:mt-[-3px] flex max-md:items-start max-md:relative md:items-baseline justify-between gap-4">
            {/* DESKTOP Masthead: Title (32px serif bold) + Year + Directed by (sem horas e sem idade no PC) */}
            <div className="hidden md:block flex-1 min-w-0">
              <h1 className="letterboxd-title text-[32px] inline mr-3">
                {movie.title}
              </h1>
              <div className="inline-block items-baseline">
                {releaseYear && (
                  <Link
                    to={isTv ? `/series/year/${releaseYear}` : `/films/year/${releaseYear}`}
                    className="letterboxd-releasedate hover:text-white underline underline-offset-[3px] decoration-[#667788] hover:decoration-white transition-colors mr-2.5 inline"
                  >
                    {releaseYear}
                  </Link>
                )}
                {director && (
                  <span className="letterboxd-credits whitespace-nowrap inline text-[#778899]">
                    {t(isTv ? 'created_by' : 'directed_by')}{' '}
                    <Link
                      to={openPersonProfile(
                        director.id,
                        !isTv
                          ? 'Director'
                          : personRoleFromJob(director.job) ?? (director.job === 'Creator' ? 'Creator' : 'Writer'),
                      )}
                      className="text-[17px] font-normal text-[#99aabb] hover:text-white underline underline-offset-[3px] decoration-[#667788] hover:decoration-white transition-colors"
                    >
                      {director.name}
                    </Link>
                  </span>
                )}
              </div>
            </div>

            {/* MOBILE Header: Title + Director + compact poster (padrão app Letterboxd) */}
            <div className="md:hidden flex-1 min-w-0 max-md:pr-[102px] flex flex-col justify-between min-h-[129px]">
              <div>
                <h1 className="font-sans font-extrabold text-[23px] text-white leading-[1.2] tracking-tight">
                  {movie.title}
                </h1>
              </div>

              {/* Criado por / Dirigido por centralizado exatamente no meio entre o título e o trailer */}
              {(releaseYear || director || fallbackCreditName) && (
                <div className="my-auto py-1">
                  <p className="text-[11px] tracking-wider uppercase text-[#9ab]">
                    {releaseYear}
                    {releaseYear && (director || fallbackCreditName) ? ' \u2022 ' : ''}
                    {director || fallbackCreditName ? t(isTv ? 'created_by' : 'directed_by') : ''}
                  </p>
                  {director ? (
                    <Link
                      // Cargo de origem vira a aba inicial do perfil: criador de
                      // série abre em "Criador" (antes caía em "Roteiro").
                      to={openPersonProfile(
                        director.id,
                        !isTv
                          ? 'Director'
                          : personRoleFromJob(director.job) ?? (director.job === 'Creator' ? 'Creator' : 'Writer'),
                      )}
                      className="text-sm font-semibold text-[#def] block mt-0.5"
                    >
                      {director.name}
                    </Link>
                  ) : fallbackCreditName ? (
                    <span className="text-sm font-semibold text-[#def] block mt-0.5">
                      {fallbackCreditName}
                    </span>
                  ) : null}
                </div>
              )}

              {/* Trailer pill + minutos + classificação indicativa (rente ao pé do poster) */}
              <div className="flex items-center gap-3 tabular-nums">
                <a
                  href={trailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-[#2c3440] text-[11px] font-semibold tracking-wider uppercase px-3 py-1 rounded-full text-[#def]"
                >
                  <Play className="w-2.5 h-2.5 fill-[#def] text-[#def]" />
                  {t('trailer')}
                </a>
                {displayRuntime ? (
                  <span className="text-xs text-[#9ab]">{displayRuntime} {t('mins')}</span>
                ) : null}
                {certification && <CertBadge cert={certification} small />}
              </div>
            </div>

            {/* Pôster compacto à direita — SOMENTE mobile (padrão app Letterboxd, alinhado na margem) */}
            <button
              type="button"
              onClick={() => setShowPosterLightbox(true)}
              aria-label={t('view_poster')}
              className="md:hidden absolute right-0 top-0 w-[86px] cursor-pointer active:scale-[0.97] transition-transform"
            >
              <div className="w-full aspect-[2/3] rounded-[4px] overflow-hidden ring-1 ring-white/15 shadow-xl bg-lb-surface">
                <img
                  ref={smartImgRef}
                  onLoad={smartImgOnLoad}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  src={posterMobileUrl}
                  srcSet={posterMobileSrcSet}
                  sizes="110px"
                  alt={movie.title}
                  className="w-full h-full object-cover mw-img-fade"
                />
              </div>
            </button>
          </div>

          {/* Content Row: Center (390px) + Right Actions (230px) */}
          <div className="flex flex-col md:flex-row md:gap-x-[50px] items-start md:mt-[30px]">
            {/* ========================================================
                CENTER COLUMN (w-[390px] no desktop): Synopsis, Tabs, Reviews
                ======================================================== */}
            <div className="w-full md:w-[390px] min-w-0 space-y-3">
            {/* Tagline — Letterboxd: 13px uppercase tracking-[0.075em] #778899 */}
            {movie.tagline && movie.tagline.trim().length > 0 && (
              <h4 className="letterboxd-tagline tagline-mobile-sm mt-[-2px] max-md:mt-6 mb-[10px]">
                {movie.tagline.replace(/^"|"$/g, '')}
              </h4>
            )}

            {/* Overview / Synopsis — Letterboxd: 15px serif leading-[1.67] #99aabb */}
            <div
              className={`letterboxd-synopsis synopsis-mobile-sm max-md:font-sans cursor-pointer md:cursor-default ${
                !(movie.tagline && movie.tagline.trim().length > 0) ? 'max-md:mt-6' : ''
              }`}
              onClick={() => setShowFullSynopsis((v) => !v)}
            >
              <p className={showFullSynopsis ? '' : 'max-md:line-clamp-3'}>
                {movie.overview || t('film_synopsis_na')}
              </p>
              {!showFullSynopsis && (
                <div className="md:hidden text-center text-[#899aa9] tracking-[0.2em] text-sm leading-none my-1.5">
                  •••
                </div>
              )}
            </div>

            {/* RATINGS — mobile only: label à esquerda, estrela verde na base,
                barras verticais cinzas no meio, média grande + 5 estrelas à direita + badges das plataformas */}
            <div className="md:hidden border-t border-white/10 pt-3 pb-3 mt-4 -mx-4 px-4">
              <span className="text-[11px] uppercase tracking-wider text-[#9ab]">{t('ratings')}</span>
              {(() => {
                const baseAvg = isOdyssey ? 4.01 : movie.vote_average ? movie.vote_average / 2 : 3.8;
                const avg =
                  unifiedRatings && unifiedRatings.unifiedStars5 > 0
                    ? unifiedRatings.unifiedStars5
                    : baseAvg;
                const scale = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
                const dist = scale.map((r) => Math.max(0.06, Math.exp(-(((r - avg) ** 2)) / 0.75)));
                const maxVal = Math.max(...dist);
                const fullStars = Math.round(avg);
                return (
                  <>
                    <div className="flex items-end gap-3 mt-1.5">
                      {/* Estrela verde pequena à esquerda da base */}
                      <span className="text-[#00e054] text-sm leading-none pb-0.5">★</span>
                      {/* Histograma de barras cinzas */}
                      <div className="flex-1 flex items-end gap-1 h-12 border-b border-[#2c3440]">
                        {dist.map((v, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-[#556677] rounded-t-none"
                            style={{ height: `${Math.max(8, Math.round((v / maxVal) * 100))}%` }}
                          />
                        ))}
                      </div>
                      {/* Média grande + 5 estrelinhas verdes */}
                      <div className="flex flex-col items-end pb-0.5 tabular-nums">
                        <span className="text-2xl font-light text-[#9ab] leading-none">{avg.toFixed(1)}</span>
                        <span className="text-xs leading-none mt-1">
                          {Array.from({ length: 5 }, (_, i) => (
                            <span key={i} className={i < fullStars ? 'text-[#00e054]' : 'text-[#3a4550]'}>★</span>
                          ))}
                        </span>
                      </div>
                    </div>
                    <UnifiedPlatformBadges
                      sources={unifiedRatings?.sources}
                      loading={unifiedLoading}
                    />
                  </>
                );
              })()}
            </div>

            {/* Pílula de status (mobile): só quando o usuário já assistiu ao filme — abre ActionBottomSheet */}
            {watched && (
              <div className="md:hidden border-t border-[#232a32] -mx-4 px-4 py-3.5">
                <button
                  type="button"
                  onClick={() => setShowActionSheet(true)}
                  className="w-full flex items-center justify-between bg-[#2c3440] hover:bg-[#343e4c] active:scale-[0.99] transition-all rounded-lg px-3.5 py-2.5 cursor-pointer text-left"
                >
                  <div className="flex items-center min-w-0">
                    {isAuthenticated && profile?.avatar_url ? (
                      <img
                        ref={smartImgRef}
                        onLoad={smartImgOnLoad}
                        src={profile.avatar_url}
                        alt={profile.username}
                        decoding="async"
                        className="w-6 h-6 rounded-full object-cover shrink-0 mw-img-fade"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-[#3a4550] shrink-0" aria-hidden="true" />
                    )}
                    <span className="ml-2.5 text-[0.85rem] text-[#cdd5de] truncate">
                      {t('film_you_watched')}
                    </span>
                  </div>
                  <MoreVertical className="w-4 h-4 text-[#899aa9] shrink-0" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* MyWorld Tabs Bar: Cast, Crew, Details, Genres, Releases (DESKTOP ONLY) */}
            {!isMobile && (
              <div className="hidden md:block pt-2">
                <div className="flex items-center gap-4 border-b border-[#445566]/60 text-[11px] uppercase tracking-[0.08em]">
                  {(
                    [
                      ['cast', t('tab_cast')],
                      ['crew', t('tab_crew')],
                      ['details', t('tab_details')],
                      ['genres', t('tab_genres')],
                      ['releases', t('tab_releases')],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`pb-1.5 -mb-[1px] transition-colors cursor-pointer ${
                        activeTab === key
                          ? 'text-white border-b border-white'
                          : 'text-[#00e054] hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tab Contents (desktop) */}
                <div className="pt-3.5 pb-4">
                  <FilmTabContent activeTab={activeTab} movie={movie} isTv={isTv} numberOfSeasons={numberOfSeasons} />
                </div>

                {/* Rodapé de metadados no PC: "173 mins   More at [IMDB] [TMDB]   ⚑" */}
                <div className="flex items-center gap-2 pt-2 text-[12px] text-[#778899]">
                  {!isTv && movie.runtime ? (
                    <span className="mr-1.5">{movie.runtime} mins</span>
                  ) : isTv && numberOfSeasons ? (
                    <span className="mr-1.5">
                      {numberOfSeasons} {numberOfSeasons === 1 ? t('film_season') : t('film_seasons')}
                    </span>
                  ) : null}
                  <span>{t('more_at')}</span>
                  <a
                    href={
                      movie.external_ids?.imdb_id
                        ? `https://www.imdb.com/title/${movie.external_ids.imdb_id}/`
                        : `https://www.imdb.com/find/?q=${encodeURIComponent(movie.title)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-[#445566] hover:border-[#99aabb] text-[#99aabb] hover:text-white text-[10px] font-semibold uppercase tracking-wider px-1.5 py-[2px] rounded-[2px] leading-none transition-colors"
                  >
                    IMDB
                  </a>
                  <a
                    href={`https://www.themoviedb.org/${isTv ? 'tv' : 'movie'}/${movie.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-[#445566] hover:border-[#99aabb] text-[#99aabb] hover:text-white text-[10px] font-semibold uppercase tracking-wider px-1.5 py-[2px] rounded-[2px] leading-none transition-colors"
                  >
                    TMDB
                  </a>
                  <Flag className="w-3.5 h-3.5 text-[#556677] fill-[#556677] ml-2" aria-hidden="true" />
                </div>
              </div>
            )}

            {/* App-style tabs — MOBILE ONLY: Cast / Crew / Details / Genre / Releases */}
            <div className="md:hidden pt-0 mt-[10px]">
              {/* Barra de abas: borda a borda (-mx-4) no estilo oficial do Letterboxd (Foto de referência) */}
              <div className="-mx-4 bg-[#14181c]">
                <div
                  ref={filmTabsContainerRef}
                  className="relative flex items-center justify-start gap-0 pl-0 pr-0 border-t border-b border-[#232a32] overflow-x-auto overflow-y-hidden no-scrollbar overscroll-none select-none py-0"
                  style={{ touchAction: 'pan-x pan-y' }}
                >
                  {FILM_MOBILE_TABS.map(({ key, labelKey }) => {
                    const isActive = activeTab === key;
                    return (
                      <button
                        key={key}
                        ref={(el) => {
                          if (el) {
                            filmTabButtonsRef.current.set(key, el);
                            if (key === activeTab && filmIndicatorRef.current && !filmTabMountedRef.current && el.offsetWidth > 0) {
                              placeTabIndicator(filmIndicatorRef.current, el.offsetLeft, el.offsetWidth, filmPrevPosRef.current);
                              filmIndicatorRef.current.style.opacity = '1';
                              filmTabMountedRef.current = true;
                            }
                          } else {
                            filmTabButtonsRef.current.delete(key);
                          }
                        }}
                        type="button"
                        onClick={() => handleSelectTab(key)}
                        className={`relative pt-[19px] pb-2.5 px-[15px] sm:px-4 transition-colors cursor-pointer whitespace-nowrap text-[14.5px] sm:text-[15px] leading-tight tracking-normal outline-none focus:outline-none flex items-center justify-center text-center ${
                          isActive
                            ? 'text-white font-bold'
                            : 'text-[#738290] hover:text-white font-medium'
                        }`}
                      >
                        <span>{t(labelKey)}</span>
                      </button>
                    );
                  })}
                  {/* Barrinha verde elástica deslizante: perfeitamente centralizada sob os nomes e encostada na borda esquerda em Elenco */}
                  <span
                    ref={(el) => {
                      filmIndicatorRef.current = el;
                      if (el) {
                        const activeBtn = filmTabButtonsRef.current.get(activeTab);
                        if (activeBtn && activeBtn.offsetWidth > 0 && !filmTabMountedRef.current) {
                          placeTabIndicator(el, activeBtn.offsetLeft, activeBtn.offsetWidth, filmPrevPosRef.current);
                          el.style.opacity = '1';
                          filmTabMountedRef.current = true;
                        }
                      }
                    }}
                    className="tab-indicator !h-[3.5px] !rounded-t-[2px]"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Conteúdo com transição suave em fade-in ao trocar de aba */}
              <div className="relative py-3 min-h-[160px]">
                <div
                  key={`tab-fade-${activeTab}`}
                  className={hasChangedTab ? 'mw-fade' : undefined}
                >
                  <FilmTabContent
                    activeTab={activeTab}
                    movie={movie}
                    isTv={isTv}
                    numberOfSeasons={numberOfSeasons}
                    mobile
                  />
                </div>
              </div>
            </div>

            {/* Popular Reviews Section */}
            <div className="pt-4 border-t border-lb-elevated space-y-4 max-md:-mx-4 max-md:px-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase font-bold tracking-wider text-lb-text">
                  {t('film_popular_reviews')}
                </h3>
                <button
                  onClick={() =>
                    openLogModal({
                      id: movie.id,
                      title: movie.title,
                      poster_path: movie.poster_path,
                      release_date: movie.release_date,
                    })
                  }
                  className="text-xs text-lb-green hover:underline font-semibold cursor-pointer"
                >
                  {t('film_write_review')}
                </button>
              </div>

              {movieReviews.length > 0 ? (
                <div className="space-y-3">
                  {movieReviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="bg-lb-surface border border-lb-elevated rounded p-4 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {rev.author.avatarUrl ? (
                            <img
                              ref={smartImgRef}
                              onLoad={smartImgOnLoad}
                              loading="eager"
                              decoding="async"
                              src={rev.author.avatarUrl}
                              alt=""
                              className="w-6 h-6 rounded-full object-cover border border-lb-elevated mw-img-fade"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-lb-elevated flex items-center justify-center text-lb-muted">
                              <User className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <span className="font-bold text-white">{rev.author.displayName}</span>
                          <span className="text-lb-green">★ {rev.rating}</span>
                        </div>
                        <span className="text-lb-muted">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-lb-white leading-relaxed">{rev.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-lb-muted text-xs text-center py-6">
                  {t('film_no_reviews')}
                </p>
              )}
            </div>
          </div>

          {/* ========================================================
              RIGHT COLUMN (w-[230px]): Action Panel & Rating Histogram (Desktop only)
              ======================================================== */}
          {!isMobile && (
            <div className="hidden md:block w-[230px] flex-shrink-0 space-y-5">
              {/* MyWorld Action Card */}
              <div className="bg-lb-border-light border border-[#556677] rounded-[4px] shadow-lg overflow-hidden text-xs text-lb-text">
                
                {/* Row 1: Watch, Like, Watchlist 3-column circular buttons */}
                <div className="grid grid-cols-3 py-2.5 bg-lb-border-light">
                  {/* Watch / Reviewed */}
                  <button
                    onClick={() => toggleWatched(movie.id)}
                    className="flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer group"
                    title={watched ? (hasUserReviewed ? t('film_reviewed') : t('action_watched')) : t('abs_mark_watched')}
                  >
                    <Eye
                      className={`w-5 h-5 transition-colors ${
                        watched ? 'text-lb-green' : 'text-lb-muted group-hover:text-white'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-semibold tracking-wide ${
                        watched ? 'text-lb-green' : 'text-lb-muted group-hover:text-white'
                      }`}
                    >
                      {watched ? (hasUserReviewed ? t('film_reviewed') : t('action_watched')) : t('action_watch')}
                    </span>
                  </button>

                  {/* Like */}
                  <button
                    onClick={() => toggleLikeMovie(movie.id)}
                    className="flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer group"
                    title={liked ? t('action_liked') : t('action_like')}
                  >
                    <Heart
                      className={`w-5 h-5 transition-colors ${
                        liked
                          ? 'text-lb-orange fill-lb-orange'
                          : 'text-lb-muted group-hover:text-lb-orange'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-semibold tracking-wide ${
                        liked ? 'text-lb-orange' : 'text-lb-muted group-hover:text-lb-orange'
                      }`}
                    >
                      {liked ? t('action_liked') : t('action_like')}
                    </span>
                  </button>

                  {/* Watchlist */}
                  <button
                    onClick={() =>
                      toggleWatchlist({
                        id: movie.id,
                        title: movie.title,
                        poster_path: movie.poster_path,
                        release_date: movie.release_date || '',
                      })
                    }
                    className="flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer group"
                    title={inWatchlist ? t('film_in_watchlist') : t('abs_add_watchlist')}
                  >
                    <Clock
                      className={`w-5 h-5 transition-colors ${
                        inWatchlist ? 'text-lb-blue' : 'text-lb-muted group-hover:text-lb-blue'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-semibold tracking-wide ${
                        inWatchlist ? 'text-lb-blue' : 'text-lb-muted group-hover:text-lb-blue'
                      }`}
                    >
                      {t('action_watchlist')}
                    </span>
                  </button>
                </div>

                {/* Row 2: Rate interactive star widget */}
                <div className="border-t border-[#384654] py-2 px-3 flex flex-col items-center justify-center bg-lb-border-light">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-lb-muted mb-1">
                    {userRating > 0 ? t('film_rated') : t('action_rate')}
                  </span>
                  <StarRating
                    value={userRating}
                    onChange={(val) => setMovieRating(movie.id, val)}
                    size="md"
                  />
                </div>

                {/* Row 3: Action Links List */}
                <div className="border-t border-[#384654] divide-y divide-[#384654] text-center font-medium bg-lb-border-light">
                  {userLogsForMovie.length > 0 && (
                    <button
                      onClick={() =>
                        openLogModal({
                          id: movie.id,
                          title: movie.title,
                          poster_path: movie.poster_path,
                          release_date: movie.release_date,
                        })
                      }
                      className="w-full py-2 px-3 text-lb-white hover:text-white hover:bg-[#4e6275] transition-colors cursor-pointer block text-xs"
                    >
                      {t('film_show_activity')}
                    </button>
                  )}

                  <button
                    onClick={() =>
                      openLogModal({
                        id: movie.id,
                        title: movie.title,
                        poster_path: movie.poster_path,
                        release_date: movie.release_date,
                      })
                    }
                    className="w-full py-2 px-3 text-lb-white hover:text-white hover:bg-[#4e6275] transition-colors cursor-pointer block text-xs"
                  >
                    {userLogsForMovie.length > 0 ? t('film_log_again') : t('review_or_log')}
                  </button>

                  {isAuthenticated && (
                    <>
                      <button
                        onClick={() => setImagePicker('backdrop')}
                        className="w-full py-2 px-3 text-lb-white hover:text-white hover:bg-[#4e6275] transition-colors cursor-pointer block text-xs"
                      >
                        {t('set_backdrop')}
                      </button>

                      <button
                        onClick={() => setImagePicker('poster')}
                        className="w-full py-2 px-3 text-lb-white hover:text-white hover:bg-[#4e6275] transition-colors cursor-pointer block text-xs"
                      >
                        {t('set_poster')}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() =>
                      openLogModal({
                        id: movie.id,
                        title: movie.title,
                        poster_path: movie.poster_path,
                        release_date: movie.release_date,
                      })
                    }
                    className="w-full py-2 px-3 text-lb-white hover:text-white hover:bg-[#4e6275] transition-colors cursor-pointer block text-xs"
                  >
                    {t('add_to_lists')}
                  </button>
                </div>

                {/* Row 4: Share Link (Collapsible - matches MyWorld authentic look) */}
                <div className="border-t border-[#384654] bg-lb-border-light">
                  <button
                    onClick={() => setShowSharePanel(!showSharePanel)}
                    className="w-full py-2 px-3 text-lb-white hover:text-white hover:bg-[#4e6275] transition-colors cursor-pointer block text-xs"
                  >
                    {t('share')}
                  </button>

                  {showSharePanel && (
                    <div className="p-2 border-t border-[#384654] bg-[#394857] flex items-center justify-between gap-1.5 animate-fade-in">
                      <div className="flex-1 bg-[#2c3743] border border-lb-border-light rounded px-2 py-1 text-[11px] text-lb-white font-mono select-all truncate">
                        {shortUrl}
                      </div>
                      
                      {/* Copy URL */}
                      <button
                        onClick={handleCopyLink}
                        className="p-1.5 rounded hover:bg-lb-border-light text-lb-muted hover:text-white transition-colors cursor-pointer"
                        title={t('film_copy_url')}
                      >
                        {copiedLink ? (
                          <Check className="w-3.5 h-3.5 text-lb-green" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Twitter / X */}
                      <button
                        onClick={shareTwitter}
                        className="p-1.5 rounded hover:bg-lb-border-light text-lb-muted hover:text-white transition-colors cursor-pointer"
                        title={t('film_share_twitter')}
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </button>

                      {/* Facebook */}
                      <button
                        onClick={shareFacebook}
                        className="p-1.5 rounded hover:bg-lb-border-light text-lb-muted hover:text-white transition-colors cursor-pointer"
                        title={t('film_share_facebook')}
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Community & Unified Rating Histogram */}
              <RatingHistogram
                averageRating={isOdyssey ? 4.01 : (movie.vote_average ? movie.vote_average / 2 : 3.8)}
                voteCount={isOdyssey ? 244000 : (movie.vote_count || 1420)}
                unifiedStars5={unifiedRatings?.unifiedStars5}
                unifiedSources={unifiedRatings?.sources}
                unifiedLoading={unifiedLoading}
              />
            </div>
          )}
          </div>

          {/* ========================================================
              BOTTOM SECTIONS (Mobile & Desktop):
              1. RELATED FILMS (Filmes da mesma coleção/franquia, entre Reviews e Similar)
              2. SIMILAR FILMS (Filmes/Séries semelhantes)
              ======================================================== */}
          {hasBottomSections && (
            <div className="w-full min-w-0 md:space-y-10 md:pt-8">
              {/* 1. RELATED FILMS — MOBILE */}
              {relatedFilms.length > 0 && collectionId && (
                <section className="similar-section md:hidden">
                  <Link
                    to={`/collection/${collectionId}`}
                    state={{ collectionName, initialParts: collectionParts }}
                    className="similar-header group"
                  >
                    <span className="group-active:text-lb-green group-hover:text-white transition-colors">
                      {t('film_related_films').toUpperCase()}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#89a] group-active:text-lb-green group-hover:text-white transition-colors" />
                  </Link>
                  <div data-h-scroll="true" className="similar-carousel">
                    {relatedFilms.map((item) => {
                      const p185 = tmdb.getImageUrl(item.poster_path, 'w185');
                      const p342 = tmdb.getImageUrl(item.poster_path, 'w342');
                      const prefetchRelated = () => {
                        if (item.backdrop_path) {
                          void preloadSingleImage(tmdb.getBackdropUrl(item.backdrop_path, 'w780'));
                        }
                        void tmdb.getMovieDetails(item.id).catch(() => {});
                      };
                      return (
                        <Link
                          key={item.id}
                          to={`/film/${item.id}`}
                          state={{ initialMovie: item, previewMovie: item, fromPoster: true }}
                          onPointerDown={prefetchRelated}
                          onMouseEnter={prefetchRelated}
                          className="similar-card"
                          aria-label={item.title}
                        >
                          <img
                            ref={smartImgRef}
                            onLoad={smartImgOnLoad}
                            src={p185}
                            srcSet={`${p185} 1x, ${p342} 2x`}
                            alt={item.title}
                            loading="lazy"
                            decoding="async"
                            className="mw-img-fade"
                          />
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 1. RELATED FILMS — DESKTOP (PC) */}
              {!isMobile && relatedFilms.length > 0 && collectionId && (
                <section className="hidden md:block space-y-3">
                  <Link
                    to={`/collection/${collectionId}`}
                    state={{ collectionName, initialParts: collectionParts }}
                    className="flex items-center justify-between border-b border-[#445566]/60 pb-1.5 group"
                  >
                    <h2 className="text-xs uppercase tracking-[0.08em] font-normal text-[#99aabb] group-hover:text-white transition-colors">
                      {t('film_related_films')}
                    </h2>
                    <span className="text-[11px] uppercase tracking-wider text-[#667788] group-hover:text-white transition-colors">
                      {t('common_all')}
                    </span>
                  </Link>
                  <div className="grid grid-cols-6 gap-2.5">
                    {relatedFilms.slice(0, 6).map((m) => (
                      <PosterCard
                        key={m.id}
                        movie={m}
                        size="fluid"
                        showDetails={false}
                        tv={false}
                        disableHoverActions
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 2. SIMILAR FILMS — MOBILE */}
              {displaySimilar.length > 0 && (
                <section className="similar-section md:hidden">
                  <Link
                    to={`/browse/results?type=${isTv ? 'tv' : 'movie'}&similarTo=${movie.id}&title=${encodeURIComponent(
                      isTv ? t('film_similar_series') : t('film_similar_films'),
                    )}`}
                    state={{ initialItems: displaySimilar, sourceMovie: movie }}
                    className="similar-header group"
                  >
                    <span className="group-active:text-lb-green group-hover:text-white transition-colors">
                      {isTv ? t('film_similar_series').toUpperCase() : t('film_similar_films').toUpperCase()}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#89a] group-active:text-lb-green group-hover:text-white transition-colors" />
                  </Link>
                  <div data-h-scroll="true" className="similar-carousel">
                    {displaySimilar.map((item) => {
                      const p185 = tmdb.getImageUrl(item.poster_path, 'w185');
                      const p342 = tmdb.getImageUrl(item.poster_path, 'w342');
                      const prefetchSimilar = () => {
                        if (item.backdrop_path) {
                          void preloadSingleImage(tmdb.getBackdropUrl(item.backdrop_path, 'w780'));
                        }
                        const req = isTv ? tmdb.getTVDetails(item.id) : tmdb.getMovieDetails(item.id);
                        void req.catch(() => {});
                      };
                      return (
                        <Link
                          key={item.id}
                          to={`${isTv ? '/tv' : '/film'}/${item.id}`}
                          state={{ initialMovie: item, previewMovie: item, fromPoster: true }}
                          onPointerDown={prefetchSimilar}
                          onMouseEnter={prefetchSimilar}
                          className="similar-card"
                          aria-label={item.title}
                        >
                          <img
                            ref={smartImgRef}
                            onLoad={smartImgOnLoad}
                            src={p185}
                            srcSet={`${p185} 1x, ${p342} 2x`}
                            alt={item.title}
                            loading="lazy"
                            decoding="async"
                            className="mw-img-fade"
                          />
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 2. SIMILAR FILMS — DESKTOP (PC) */}
              {!isMobile && displaySimilar.length > 0 && (
                <section className="hidden md:block space-y-3">
                  <Link
                    to={`/browse/results?type=${isTv ? 'tv' : 'movie'}&similarTo=${movie.id}&title=${encodeURIComponent(
                      isTv ? t('film_similar_series') : t('film_similar_films'),
                    )}`}
                    state={{ initialItems: displaySimilar, sourceMovie: movie }}
                    className="flex items-center justify-between border-b border-[#445566]/60 pb-1.5 group"
                  >
                    <h2 className="text-xs uppercase tracking-[0.08em] font-normal text-[#99aabb] group-hover:text-white transition-colors">
                      {isTv ? t('film_similar_series') : t('film_similar_films')}
                    </h2>
                    <span className="text-[11px] uppercase tracking-wider text-[#667788] group-hover:text-white transition-colors">
                      {t('common_all')}
                    </span>
                  </Link>
                  <div className="grid grid-cols-6 gap-2.5">
                    {displaySimilar.slice(0, 6).map((m) => (
                      <PosterCard
                        key={m.id}
                        movie={m}
                        size="fluid"
                        showDetails={false}
                        tv={isTv}
                        disableHoverActions
                        eager
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Set Poster / Backdrop Picker & Modals sob demanda */}
      <Suspense fallback={null}>
        {imagePicker && (
          <ImagePickerModal
            mode={imagePicker}
            movieId={movie.id}
            currentUrl={imagePicker === 'poster' ? posterUrl : backdropUrl}
            onSelect={(url) =>
              setMovieOverride(
                movie.id,
                imagePicker === 'poster' ? { poster: url } : { backdrop: url }
              )
            }
            onClose={() => setImagePicker(null)}
          />
        )}

        {/* Gaveta de ações mobile (Watch/Like/Watchlist/Rate/Share) */}
        {showActionSheet && (
          <ActionBottomSheet
            open={showActionSheet}
            onClose={() => setShowActionSheet(false)}
            movie={{ id: movie.id, title: movie.title, release_date: movie.release_date }}
            onPickImage={(mode) => setImagePicker(mode)}
            onViewPoster={() => setShowPosterLightbox(true)}
          />
        )}

        {/* Visualização ampliada do pôster (Mobile: largura total + zoom + swipe-down | PC: lightbox com X) */}
        {showPosterLightbox && (
          <PosterLightbox
            open={showPosterLightbox}
            src={posterPath ? tmdb.getImageUrl(posterPath, 'w780') : posterUrl}
            previewSrc={isMobile ? posterMobileUrl : posterUrl}
            alt={movie.title}
            onClose={() => setShowPosterLightbox(false)}
          />
        )}
      </Suspense>

      {/* 3. Trailer Modal */}
      {showTrailerModal && trailerVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm mw-overlay-fade">
          <div className="relative w-full max-w-3xl bg-lb-bg border border-lb-elevated rounded-lg shadow-2xl overflow-hidden mw-pop-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-lb-elevated bg-lb-surface">
              <h3 className="text-sm font-semibold text-white">
                {movie.title} — {t('film_official_trailer')}
              </h3>
              <button
                onClick={() => setShowTrailerModal(false)}
                aria-label={t('film_close_trailer')}
                className="text-lb-muted hover:text-white transition-colors p-1 rounded hover:bg-lb-elevated cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${trailerVideo.key}?autoplay=1`}
                title={`${movie.title} Trailer`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// COMPONENTES COMPARTILHADOS DAS 5 ABAS (desktop + mobile)
// Cast / Crew / Details (TMDB + IMDb) / Genres+Themes / Releases
// ===========================================================================

// ---- Badge de classificação indicativa -------------------------------------
// Cores oficiais brasileiras: L verde, 10 azul, 12 amarelo, 14 laranja,
// 16 vermelho, 18 preto. Países estrangeiros: cinza neutro.
const BR_CERT_COLORS: Record<string, string> = {
  L: 'bg-[#16a34a] text-white',
  '10': 'bg-[#0284c7] text-white',
  '12': 'bg-[#facc15] text-black',
  '14': 'bg-[#f97316] text-white',
  '16': 'bg-[#dc2626] text-white',
  '18': 'bg-black text-white border border-white/40',
};
const CertBadge: React.FC<{ cert: string; small?: boolean }> = ({ cert, small }) => {
  const key = cert.replace(/\s/g, '').toUpperCase();
  const colors = BR_CERT_COLORS[key] ?? 'bg-[#556677] text-white';
  return (
    <span
      title={cert}
      className={`inline-flex items-center justify-center rounded-[3px] font-black leading-none shrink-0 ${colors} ${
        small ? 'text-[9px] min-w-[18px] h-[18px] px-1' : 'text-[10px] min-w-[20px] h-[20px] px-1'
      }`}
    >
      {cert}
    </span>
  );
};

// Bandeira emoji a partir do ISO 3166-1 (ex.: 'BR' → 🇧🇷)
const flagEmoji = (iso: string): string =>
  /^[A-Za-z]{2}$/.test(iso)
    ? iso.toUpperCase().replace(/./g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    : '';

// ---- Helper de linha com pontilhado à esquerda (padrão Letterboxd Desktop) --
const DesktopDottedRow: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) => {
  if (!children) return null;
  return (
    <div className="grid grid-cols-[165px_1fr] items-start gap-2.5">
      <div className="flex items-baseline pt-[5px] min-w-0">
        <span className="text-[11px] uppercase tracking-[0.06em] text-[#778899] shrink-0 pr-1.5 leading-none">
          {label}
        </span>
        <span className="flex-1 border-b border-dotted border-[#445566] h-1 min-w-[12px]" aria-hidden="true" />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
};

interface FromPersonState {
  id: number;
  name: string;
  profile_path?: string | null;
  character?: string;
  job?: string;
  role?: string;
}

// ---- 1. CAST ---------------------------------------------------------------
const CastTab: React.FC<{ movie: TMDBMovieDetails; mobile?: boolean }> = ({ movie, mobile }) => {
  const { t } = useLanguage();
  const location = useLocation();
  const fromPerson = (location.state as { fromPerson?: FromPersonState } | null)?.fromPerson;
  const [showAll, setShowAll] = useState(false);

  const cast = useMemo(() => {
    const base = [...(movie.credits?.cast ?? [])];
    if (
      fromPerson &&
      fromPerson.id &&
      (fromPerson.role === 'Actor' || typeof fromPerson.character === 'string')
    ) {
      const existingIdx = base.findIndex((c) => c.id === fromPerson.id);
      if (existingIdx === -1) {
        base.push({
          id: fromPerson.id,
          name: fromPerson.name,
          character: fromPerson.character || '',
          profile_path: fromPerson.profile_path ?? null,
          order: base.length,
        });
      } else if (!base[existingIdx].character && fromPerson.character) {
        base[existingIdx] = { ...base[existingIdx], character: fromPerson.character };
      }

      const limit = mobile ? 10 : 28;
      const idxNow = base.findIndex((c) => c.id === fromPerson.id);
      if (idxNow >= limit) {
        const [item] = base.splice(idxNow, 1);
        const insertAt = Math.min(3, base.length);
        base.splice(insertAt, 0, item);
      }
    }
    return base;
  }, [movie.credits?.cast, fromPerson, mobile]);

  if (cast.length === 0) {
    return (
      <div className="py-12 text-center space-y-2">
        <p className="text-sm text-white font-semibold">—</p>
        <p className="text-xs text-lb-muted">{t('cast_empty')}</p>
      </div>
    );
  }

  // DESKTOP: Grade de blocos compactos (#283038) + botão "Show All..." (Imagem 3)
  if (!mobile) {
    const DESKTOP_LIMIT = 28;
    const shownDesktop = showAll ? cast : cast.slice(0, DESKTOP_LIMIT);
    return (
      <div className="flex flex-wrap gap-[5px]">
        {shownDesktop.map((actor) => (
          <Link
            key={`${actor.id}-${actor.character ?? ''}`}
            to={openPersonProfile(actor.id, 'Actor')}
            title={actor.character || actor.name}
            className="bg-[#283038] hover:bg-[#333d47] text-[#99aabb] hover:text-white text-[12px] leading-[1.3] px-2 py-[5px] rounded-[3px] transition-colors"
          >
            {actor.name}
          </Link>
        ))}
        {cast.length > DESKTOP_LIMIT && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="bg-[#283038] hover:bg-[#333d47] text-[#99aabb] hover:text-white text-[12px] leading-[1.3] px-2 py-[5px] rounded-[3px] transition-colors cursor-pointer"
          >
            {t('show_all')}…
          </button>
        )}
      </div>
    );
  }

  // MOBILE: Lista com foto 53x53px, nome, personagem e chevron (inalterado)
  const LIMIT = 10;
  const shown = showAll ? cast : cast.slice(0, LIMIT);
  const hiddenCount = cast.length - LIMIT;
  return (
    <div>
      <ul>
        {shown.map((actor) => (
          <li key={`${actor.id}-${actor.character ?? ''}`}>
            <Link
              to={openPersonProfile(actor.id, 'Actor')}
              className="flex items-center gap-3 px-0 md:px-2 py-2.5 hover:bg-lb-surface/60 transition-colors"
            >
              {actor.profile_path ? (
                <img
                  ref={smartImgRef}
                  onLoad={smartImgOnLoad}
                  loading={showAll ? 'lazy' : 'eager'}
                  decoding="async"
                  src={tmdb.getProfileUrl(actor.profile_path, 'w185')}
                  alt=""
                  className="w-[53px] h-[53px] rounded-[4px] object-cover shrink-0 bg-lb-elevated mw-img-fade"
                />
              ) : (
                <div className="w-[53px] h-[53px] rounded-[4px] shrink-0 bg-lb-elevated flex items-center justify-center text-lb-muted">
                  <Users className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-white truncate leading-tight">{actor.name}</p>
                {actor.character && (
                  <p className="text-[13px] text-lb-muted truncate leading-snug mt-0.5">{actor.character}</p>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-lb-muted shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
      {cast.length > LIMIT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full mt-2 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white hover:text-lb-green transition-colors cursor-pointer"
        >
          {showAll ? '−' : `${t('show_more')} ${hiddenCount}`}
        </button>
      )}
    </div>
  );
};

// ---- 2. CREW (agrupado por cargo, layout Letterboxd com linha pontilhada no PC) --

const CREW_GROUPS: { key: TranslationKey; jobs: string[]; role?: PersonRole }[] = [
  { key: 'crew_director', jobs: ['Director', 'Creator', 'Series Director', 'Co-Director'], role: 'Director' },
  { key: 'crew_producers', jobs: ['Producer', 'Co-Producer', 'Associate Producer'], role: 'Producer' },
  { key: 'crew_writers', jobs: ['Screenplay', 'Writer', 'Series Composition', 'Script', 'Teleplay'], role: 'Writer' },
  { key: 'crew_original_writer', jobs: ['Author', 'Novel', 'Story', 'Original Story', 'Original Concept', 'Original Creator', 'Original Series Creator', 'Characters', 'Graphic Novel', 'Comic Book', 'Manga'], role: 'Writer' },
  { key: 'crew_casting', jobs: ['Casting', 'Casting Director'] },
  { key: 'crew_editor', jobs: ['Editor', 'Film Editor'], role: 'Editor' },
  { key: 'crew_cinematography', jobs: ['Director of Photography', 'Cinematography'], role: 'Cinematography' },
  { key: 'crew_asst_directors', jobs: ['First Assistant Director', 'Second Assistant Director', 'Third Assistant Director', 'Assistant Director'] },
  { key: 'crew_exec_producers', jobs: ['Executive Producer'], role: 'Executive Producer' },
  { key: 'crew_lighting', jobs: ['Gaffer', 'Chief Lighting Technician', 'Lighting', 'Lighting Technician'] },
  { key: 'crew_camera_operator', jobs: ['Camera Operator', 'Steadicam Operator', 'First Assistant Camera'] },
  { key: 'crew_composer', jobs: ['Original Music Composer', 'Composer', 'Music'], role: 'Composer' },
  { key: 'crew_production_design', jobs: ['Production Design'] },
  { key: 'crew_art_direction', jobs: ['Art Direction'] },
  { key: 'crew_set_decoration', jobs: ['Set Decoration'] },
  { key: 'crew_costume', jobs: ['Costume Design', 'Costume Designer'] },
  { key: 'crew_makeup', jobs: ['Makeup Artist', 'Makeup Department Head', 'Hairstylist', 'Hair Department Head', 'Makeup & Hair'] },
  { key: 'crew_vfx', jobs: ['Visual Effects Supervisor', 'Visual Effects', 'VFX Supervisor', 'Special Effects'] },
  { key: 'crew_stunts', jobs: ['Stunt Coordinator', 'Stunts', 'Stunt Double'] },
  { key: 'crew_sound', jobs: ['Sound', 'Sound Mixer', 'Sound Designer', 'Supervising Sound Editor', 'Sound Re-Recording Mixer'] },
];

const CrewTab: React.FC<{ movie: TMDBMovieDetails; mobile?: boolean }> = ({ movie, mobile }) => {
  const { t } = useLanguage();
  const location = useLocation();
  const fromPerson = (location.state as { fromPerson?: FromPersonState } | null)?.fromPerson;
  const crew = useMemo(() => {
    const base = [...(movie.credits?.crew ?? [])];
    if (fromPerson && fromPerson.id && fromPerson.job) {
      const exists = base.some((c) => c.id === fromPerson.id && c.job === fromPerson.job);
      if (!exists) {
        base.unshift({
          id: fromPerson.id,
          name: fromPerson.name,
          job: fromPerson.job,
          department: '',
          profile_path: fromPerson.profile_path ?? null,
        });
      }
    }
    return base;
  }, [movie.credits?.crew, fromPerson]);
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 10;

  // DESKTOP: Agrupado por cargo com linha pontilhada à esquerda e blocos à direita (Imagem 4)
  if (!mobile) {
    const grouped = CREW_GROUPS.map((g) => {
      const seen = new Set<number>();
      const members = crew.filter((c) => {
        if (!g.jobs.includes(c.job)) return false;
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      return { ...g, members };
    }).filter((g) => g.members.length > 0);

    if (grouped.length === 0) {
      return <p className="py-8 text-center text-xs text-lb-muted">{t('cast_empty')}</p>;
    }

    return (
      <div className="space-y-3">
        {grouped.map((g) => (
          <DesktopDottedRow key={g.key} label={t(g.key)}>
            <div className="flex flex-wrap gap-[5px]">
              {g.members.map((m) => (
                <Link
                  key={`${g.key}-${m.id}`}
                  to={openPersonProfile(m.id, g.role ?? 'Actor')}
                  className="bg-[#283038] hover:bg-[#333d47] text-[#99aabb] hover:text-white text-[12px] leading-[1.3] px-2 py-[5px] rounded-[3px] transition-colors"
                >
                  {m.name}
                </Link>
              ))}
            </div>
          </DesktopDottedRow>
        ))}
      </div>
    );
  }

  // MOBILE: Lista única com avatares 53x53px (inalterado)
  const rows = CREW_GROUPS.flatMap((g) =>
    crew
      .filter((c) => g.jobs.includes(c.job))
      .map((c, i) => ({
        key: `${g.key}-${c.id}-${i}`,
        id: c.id,
        name: c.name,
        job: c.job,
        profile_path: c.profile_path,
        role: g.role,
      })),
  );

  if (rows.length === 0) {
    return <p className="py-8 text-center text-xs text-lb-muted">{t('cast_empty')}</p>;
  }

  const shown = showAll ? rows : rows.slice(0, LIMIT);
  const hiddenCount = rows.length - LIMIT;
  return (
    <div>
      <ul>
        {shown.map((p) => (
          <li key={p.key}>
            <Link
              to={openPersonProfile(p.id, p.role ?? 'Actor')}
              className="flex items-center gap-3 px-0 md:px-2 py-2.5 hover:bg-lb-surface/60 transition-colors"
            >
              {p.profile_path ? (
                <img
                  ref={smartImgRef}
                  onLoad={smartImgOnLoad}
                  loading="lazy"
                  decoding="async"
                  src={tmdb.getProfileUrl(p.profile_path, 'w185')}
                  alt=""
                  className="w-[53px] h-[53px] rounded-[4px] object-cover shrink-0 bg-lb-elevated mw-img-fade"
                />
              ) : (
                <div className="w-[53px] h-[53px] rounded-[4px] shrink-0 bg-lb-elevated flex items-center justify-center text-lb-muted">
                  <Users className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-white truncate leading-tight">{p.name}</p>
                <p className="text-[13px] text-lb-muted truncate leading-snug mt-0.5">{p.job}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-lb-muted shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > LIMIT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full mt-2 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white hover:text-lb-green transition-colors cursor-pointer"
        >
          {showAll ? '−' : `${t('show_more')} ${hiddenCount}`}
        </button>
      )}
    </div>
  );
};

// ---- 3. DETAILS (Ficha TMDB + Box Office + Tech Specs/Trivia IMDb) ---------
interface ImdbSpec { label: string; value: string }
interface ImdbTrivia { text: string; spoiler: boolean }
interface ImdbData { specs: ImdbSpec[]; trivia: ImdbTrivia[] }

/** Hook com cache em localStorage (chave imdb_<id>) */
function useImdbData(imdbId: string | null | undefined): ImdbData | null {
  const [data, setData] = useState<ImdbData | null>(null);
  useEffect(() => {
    if (!imdbId) return;
    let cancelled = false;
    const key = `imdb_${imdbId}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        setData(JSON.parse(cached));
        return;
      }
    } catch { /* cache ilegível */ }
    fetch(`/api/imdb?imdbId=${imdbId}`)
      .then((r) => (r.ok ? r.json() : { specs: [], trivia: [] }))
      .then((d: ImdbData) => {
        if (cancelled) return;
        setData(d);
        try { localStorage.setItem(key, JSON.stringify(d)); } catch { /* quota */ }
      })
      .catch(() => { if (!cancelled) setData({ specs: [], trivia: [] }); });
    return () => { cancelled = true; };
  }, [imdbId]);
  return data;
}

// Mapeia rótulos do IMDb (em inglês) para as chaves traduzidas da aba
const SPEC_LABEL_MAP: Record<string, TranslationKey> = {
  'runtime': 'tech_runtime',
  'aspect ratio': 'tech_aspect_ratio',
  'camera': 'tech_camera',
  'laboratory': 'tech_laboratory',
  'negative format': 'tech_negative_format',
  'cinematographic process': 'tech_cine_process',
  'printed film format': 'tech_printed_format',
  'color': 'tech_color',
  'sound mix': 'tech_sound_mix',
};

const DetailRow: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) =>
  children ? (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] uppercase font-bold text-lb-muted whitespace-nowrap shrink-0">
        {label}
      </span>
      <span className="border-b border-dotted border-white/15 flex-1 mx-2 -translate-y-1" aria-hidden="true" />
      <span className="text-white text-right max-w-[70%]">{children}</span>
    </div>
  ) : null;

const shortCountryName = (iso: string, fallback: string): string => {
  if (iso === 'GB') return 'UK';
  if (iso === 'US') return 'USA';
  return fallback;
};

const DetailsTab: React.FC<{ movie: TMDBMovieDetails; isTv: boolean; mobile?: boolean }> = ({ movie, isTv, mobile }) => {
  const { language, t } = useLanguage();
  const regions = useMemo(() => regionNames(language), [language]);
  const langs = useMemo(() => languageNames(language), [language]);
  const imdb = useImdbData(isTv ? null : movie.external_ids?.imdb_id);
  const [showAllTrivia, setShowAllTrivia] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const altTitles = movie.alternative_titles?.titles ?? movie.alternative_titles?.results ?? [];
  const spoken = movie.spoken_languages?.map((l) => l.english_name || l.name).filter(Boolean) ?? [];
  const triviaShown = imdb?.trivia ? (showAllTrivia ? imdb.trivia : imdb.trivia.slice(0, 5)) : [];

  // DESKTOP: Linhas pontilhadas com blocos para Studios, Countries e Language + texto corrido em Alternative Titles (Imagem 5)
  if (!mobile) {
    const primaryLangName = movie.original_language
      ? langs.of(movie.original_language) ?? movie.original_language.toUpperCase()
      : '';
    const languageChips = Array.from(
      new Set([primaryLangName, ...spoken].filter(Boolean)),
    );

    return (
      <div className="space-y-3.5">
        {movie.production_companies && movie.production_companies.length > 0 && (
          <DesktopDottedRow label={t('det_studios')}>
            <div className="flex flex-wrap gap-[5px]">
              {movie.production_companies.map((c) => (
                <span
                  key={c.id}
                  className="bg-[#283038] hover:bg-[#333d47] text-[#99aabb] hover:text-white text-[12px] leading-[1.3] px-2 py-[5px] rounded-[3px] transition-colors"
                >
                  {c.name}
                </span>
              ))}
            </div>
          </DesktopDottedRow>
        )}

        {movie.production_countries && movie.production_countries.length > 0 && (
          <DesktopDottedRow label={t('det_countries')}>
            <div className="flex flex-wrap gap-[5px]">
              {movie.production_countries.map((c) => {
                const label =
                  language === 'en-US'
                    ? shortCountryName(c.iso_3166_1, regions.of(c.iso_3166_1) ?? c.name)
                    : regions.of(c.iso_3166_1) ?? c.name;
                return (
                  <Link
                    key={c.iso_3166_1}
                    to={isTv ? `/series/country/${c.iso_3166_1}` : `/films/country/${c.iso_3166_1}`}
                    className="bg-[#283038] hover:bg-[#333d47] text-[#99aabb] hover:text-white text-[12px] leading-[1.3] px-2 py-[5px] rounded-[3px] transition-colors"
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </DesktopDottedRow>
        )}

        {languageChips.length > 0 && (
          <DesktopDottedRow label={t('det_language')}>
            <div className="flex flex-wrap gap-[5px]">
              {languageChips.map((lang) => (
                <span
                  key={lang}
                  className="bg-[#283038] hover:bg-[#333d47] text-[#99aabb] hover:text-white text-[12px] leading-[1.3] px-2 py-[5px] rounded-[3px] transition-colors"
                >
                  {lang}
                </span>
              ))}
            </div>
          </DesktopDottedRow>
        )}

        {altTitles.length > 0 && (
          <DesktopDottedRow label={t('det_alt_titles')}>
            <p className="text-[12.5px] leading-[1.6] text-[#99aabb]">
              {altTitles.map((a) => a.title).join(', ')}
            </p>
          </DesktopDottedRow>
        )}
      </div>
    );
  }

  // MOBILE: Ficha de Produção + Box Office + Tech Specs + Trivia (inalterado)
  return (
    <div className="space-y-5 text-xs">
      {/* Seção 1 — Ficha de Produção (TMDB) */}
      <section className="space-y-2.5">
        <h4 className="text-[10px] uppercase font-bold tracking-wider text-white border-b border-lb-elevated pb-1">
          {t('det_production_info')}
        </h4>
        <DetailRow label={t('det_studios')}>
          {movie.production_companies?.length
            ? movie.production_companies.map((c) => c.name).join(', ')
            : undefined}
        </DetailRow>
        <DetailRow label={t('det_countries')}>
          {movie.production_countries?.length
            ? movie.production_countries
                .map((c) => regions.of(c.iso_3166_1) ?? c.name)
                .join(', ')
            : undefined}
        </DetailRow>
        <DetailRow label={t('det_primary_language')}>
          {movie.original_language
            ? langs.of(movie.original_language) ?? movie.original_language.toUpperCase()
            : undefined}
        </DetailRow>
        {spoken.length > 0 && (
          <DetailRow label={t('det_spoken_languages')}>{spoken.join(', ')}</DetailRow>
        )}
        {altTitles.length > 0 && (
          <DetailRow label={t('det_alt_titles')}>
            {altTitles.slice(0, 5).map((a) => `${a.title} (${a.iso_3166_1})`).join(' · ')}
          </DetailRow>
        )}
        {movie.status && <DetailRow label={t('det_status')}>{movie.status}</DetailRow>}
      </section>

      {/* Seção 2 — Box Office (TMDB) */}
      {(movie.budget > 0 || movie.revenue > 0) && !isTv && (
        <section className="space-y-2.5">
          <h4 className="text-[10px] uppercase font-bold tracking-wider text-white border-b border-lb-elevated pb-1">
            {t('det_box_office')}
          </h4>
          {movie.budget > 0 && (
            <DetailRow label={t('det_budget')}>{formatMoneyUSD(language, movie.budget)}</DetailRow>
          )}
          {movie.revenue > 0 && (
            <DetailRow label={t('det_revenue')}>{formatMoneyUSD(language, movie.revenue)}</DetailRow>
          )}
        </section>
      )}

      {/* Seção 3 — Technical Specifications (IMDb) */}
      {!isTv && imdb && imdb.specs.length > 0 && (
        <section className="space-y-2.5">
          <h4 className="text-[10px] uppercase font-bold tracking-wider text-white border-b border-lb-elevated pb-1">
            {t('tech_specs')}
          </h4>
          {imdb.specs.map((s, i) => {
            const mapped = SPEC_LABEL_MAP[s.label.toLowerCase()];
            return (
              <DetailRow key={`${s.label}-${i}`} label={mapped ? t(mapped) : s.label}>
                {s.value}
              </DetailRow>
            );
          })}
        </section>
      )}

      {/* Seção 4 — Trivia / Curiosidades (IMDb) */}
      {!isTv && imdb && imdb.trivia.length > 0 && (
        <section className="space-y-2.5">
          <h4 className="text-[10px] uppercase font-bold tracking-wider text-white border-b border-lb-elevated pb-1">
            {t('trivia')}
          </h4>
          <div className="space-y-2">
            {triviaShown.map((item, i) => {
              const hidden = item.spoiler && !revealed.has(i);
              return (
                <div key={i} className="relative bg-lb-surface border border-lb-elevated rounded p-3">
                  <p className={`text-lb-text leading-relaxed transition-all ${hidden ? 'blur-sm select-none' : ''}`}>
                    {item.text}
                  </p>
                  {hidden && (
                    <button
                      onClick={() => setRevealed((prev) => new Set(prev).add(i))}
                      className="absolute inset-0 flex items-center justify-center text-[11px] font-bold uppercase tracking-wider text-white bg-black/40 hover:bg-black/50 rounded cursor-pointer"
                    >
                      {t('reveal_spoiler')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {imdb.trivia.length > 5 && (
            <button
              onClick={() => setShowAllTrivia((v) => !v)}
              className="text-xs font-bold text-lb-green hover:underline cursor-pointer"
            >
              {showAllTrivia ? '−' : t('show_all')}
            </button>
          )}
        </section>
      )}
    </div>
  );
};

// ---- 4. GENRES + THEMES ----------------------------------------------------
const GenresTab: React.FC<{ movie: TMDBMovieDetails; isTv: boolean; mobile?: boolean }> = ({ movie, isTv, mobile }) => {
  const { t } = useLanguage();
  const [showAllThemes, setShowAllThemes] = useState(false);
  const themes = movie.keywords?.keywords ?? movie.keywords?.results ?? [];

  // DESKTOP: Linhas pontilhadas com blocos para GENRES e THEMES + "Show All..." (Imagem 6)
  if (!mobile) {
    const THEME_LIMIT = 6;
    const shownThemes = showAllThemes ? themes : themes.slice(0, THEME_LIMIT);
    return (
      <div className="space-y-3.5">
        {movie.genres && movie.genres.length > 0 && (
          <DesktopDottedRow label={t('genres_label')}>
            <div className="flex flex-wrap gap-[5px]">
              {movie.genres.map((g) => (
                <Link
                  key={g.id}
                  to={isTv ? `/series/browse?genre=${g.id}` : `/films/browse?genre=${g.id}`}
                  className="bg-[#283038] hover:bg-[#333d47] text-[#99aabb] hover:text-white text-[12px] leading-[1.3] px-2 py-[5px] rounded-[3px] transition-colors"
                >
                  {g.name}
                </Link>
              ))}
            </div>
          </DesktopDottedRow>
        )}

        {themes.length > 0 && (
          <DesktopDottedRow label={t('themes_label')}>
            <div className="flex flex-wrap gap-[5px]">
              {shownThemes.map((k) => (
                <span
                  key={k.id}
                  title={k.name}
                  className="bg-[#283038] hover:bg-[#333d47] text-[#99aabb] hover:text-white text-[12px] leading-[1.3] px-2 py-[5px] rounded-[3px] max-w-[215px] truncate transition-colors capitalize"
                >
                  {k.name}
                </span>
              ))}
              {themes.length > THEME_LIMIT && !showAllThemes && (
                <button
                  onClick={() => setShowAllThemes(true)}
                  className="bg-[#283038] hover:bg-[#333d47] text-[#99aabb] hover:text-white text-[12px] leading-[1.3] px-2 py-[5px] rounded-[3px] transition-colors cursor-pointer"
                >
                  {t('show_all')}…
                </button>
              )}
            </div>
          </DesktopDottedRow>
        )}
      </div>
    );
  }

  // MOBILE (inalterado)
  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-[10px] uppercase font-bold tracking-wider text-white border-b border-lb-elevated pb-1 mb-2.5">
          {t('genres_label')}
        </h4>
        <div className="flex flex-wrap gap-2">
          {movie.genres?.map((g) => (
            <Link
              key={g.id}
              to={isTv ? `/series/browse?genre=${g.id}` : `/films/browse?genre=${g.id}`}
              className="bg-[#202830] border border-lb-elevated hover:border-lb-green text-lb-white hover:text-lb-green px-3 py-1 rounded text-xs transition-colors"
            >
              {g.name}
            </Link>
          ))}
        </div>
      </div>
      {themes.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase font-bold tracking-wider text-white border-b border-lb-elevated pb-1 mb-2.5">
            {t('themes_label')}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {themes.slice(0, 30).map((k) => (
              <span
                key={k.id}
                className="bg-lb-bg border border-lb-elevated text-lb-text px-2.5 py-1 rounded text-[11px]"
              >
                {k.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---- 5. RELEASES (estilo oficial Letterboxd) -------------------------------
const RELEASE_TYPE_LABELS: Record<number, TranslationKey> = {
  1: 'rel_premiere',
  2: 'rel_theatrical_limited',
  3: 'rel_theatrical',
  4: 'rel_digital',
  5: 'rel_physical',
  6: 'rel_tv',
};

const SHORT_COUNTRY_NAMES: Record<string, { pt: string; en: string }> = {
  US: { pt: 'EUA', en: 'USA' },
  GB: { pt: 'Reino Unido', en: 'UK' },
  CA: { pt: 'Canadá', en: 'Canada' },
  HU: { pt: 'Hungria', en: 'Hungary' },
  NL: { pt: 'Holanda', en: 'Netherlands' },
  SE: { pt: 'Suécia', en: 'Sweden' },
  PL: { pt: 'Polônia', en: 'Poland' },
  TR: { pt: 'Turquia', en: 'Turkey' },
  CZ: { pt: 'República Tcheca', en: 'Czechia' },
  DE: { pt: 'Alemanha', en: 'Germany' },
  FR: { pt: 'França', en: 'France' },
  IT: { pt: 'Itália', en: 'Italy' },
  ES: { pt: 'Espanha', en: 'Spain' },
  JP: { pt: 'Japão', en: 'Japan' },
  KR: { pt: 'Coreia do Sul', en: 'South Korea' },
  AU: { pt: 'Austrália', en: 'Australia' },
  NZ: { pt: 'Nova Zelândia', en: 'New Zealand' },
  BR: { pt: 'Brasil', en: 'Brazil' },
  MX: { pt: 'México', en: 'Mexico' },
  AR: { pt: 'Argentina', en: 'Argentina' },
  CL: { pt: 'Chile', en: 'Chile' },
  CO: { pt: 'Colômbia', en: 'Colombia' },
  PT: { pt: 'Portugal', en: 'Portugal' },
  DK: { pt: 'Dinamarca', en: 'Denmark' },
  NO: { pt: 'Noruega', en: 'Norway' },
  FI: { pt: 'Finlândia', en: 'Finland' },
  BE: { pt: 'Bélgica', en: 'Belgium' },
  AT: { pt: 'Áustria', en: 'Austria' },
  CH: { pt: 'Suíça', en: 'Switzerland' },
  IE: { pt: 'Irlanda', en: 'Ireland' },
  IN: { pt: 'Índia', en: 'India' },
  CN: { pt: 'China', en: 'China' },
  HK: { pt: 'Hong Kong', en: 'Hong Kong' },
  TW: { pt: 'Taiwan', en: 'Taiwan' },
  RU: { pt: 'Rússia', en: 'Russia' },
  UA: { pt: 'Ucrânia', en: 'Ukraine' },
  GR: { pt: 'Grécia', en: 'Greece' },
  ZA: { pt: 'África do Sul', en: 'South Africa' },
  IL: { pt: 'Israel', en: 'Israel' },
  EG: { pt: 'Egito', en: 'Egypt' },
};

function resolveCountryLabel(iso: string, language: string, regions: Intl.DisplayNames): string {
  const upper = (iso || '').trim().toUpperCase();
  const override = SHORT_COUNTRY_NAMES[upper];
  if (override) {
    return language === 'pt-BR' ? override.pt : override.en;
  }
  return regions.of(upper) ?? upper;
}

const formatReleaseDateLetterboxd = (isoDate: string, language: string): string => {
  if (!isoDate) return '—';
  const clean = isoDate.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(Date.UTC(y, m, d));
    if (!Number.isNaN(dt.getTime())) {
      const day = dt.getUTCDate();
      const month = dt.toLocaleString(language === 'pt-BR' ? 'pt-BR' : 'en-US', {
        month: 'short',
        timeZone: 'UTC',
      }).replace(/\.$/, '');
      const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
      return `${day} ${monthCap} ${dt.getUTCFullYear()}`;
    }
  }
  return clean;
};

const CircularFlag: React.FC<{ iso: string }> = ({ iso }) => {
  const [failed, setFailed] = useState(false);
  const code = (iso || '').trim().toLowerCase();
  if (failed || !/^[a-z]{2}$/.test(code)) {
    return (
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-xs leading-none shrink-0"
        aria-hidden="true"
      >
        {flagEmoji(iso)}
      </span>
    );
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="w-5 h-5 rounded-full aspect-square object-cover shrink-0 shadow-sm border border-white/10"
    />
  );
};

const ReleasesTab: React.FC<{ movie: TMDBMovieDetails; mobile?: boolean }> = ({ movie, mobile }) => {
  const { language, t } = useLanguage();
  const regions = useMemo(() => regionNames(language), [language]);
  const [sortBy, setSortBy] = useState<'date' | 'country'>('date');
  const [filterIso, setFilterIso] = useState<string | null>(null);

  const entries = useMemo(() => {
    const list: { iso: string; type: number; date: string; cert: string; note: string }[] = [];
    for (const r of movie.release_dates?.results ?? []) {
      for (const d of r.release_dates) {
        list.push({
          iso: r.iso_3166_1,
          type: d.type || 3,
          date: d.release_date || '',
          cert: d.certification || '',
          note: d.note || '',
        });
      }
    }
    return list;
  }, [movie]);

  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      if (e.iso) set.add(e.iso.toUpperCase());
    }
    return Array.from(set).sort((a, b) => {
      const nameA = resolveCountryLabel(a, language, regions);
      const nameB = resolveCountryLabel(b, language, regions);
      return nameA.localeCompare(nameB);
    });
  }, [entries, language, regions]);

  const filteredEntries = useMemo(() => {
    if (!filterIso) return entries;
    return entries.filter((e) => e.iso.toUpperCase() === filterIso);
  }, [entries, filterIso]);

  if (entries.length === 0) {
    const fallbackDate = movie.release_date || (movie as unknown as { first_air_date?: string }).first_air_date || '';
    const fallbackIso = movie.production_countries?.[0]?.iso_3166_1 || 'US';
    const countryName = resolveCountryLabel(fallbackIso, language, regions);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-1">
          <h4 className="text-[11px] uppercase font-bold tracking-[0.08em] text-[#778899]">
            {t('rel_theatrical')}
          </h4>
          <Globe className="w-4 h-4 text-[#778899]" />
        </div>
        <div className="flex items-start gap-3 py-2 text-[13px]">
          <span className="w-[88px] shrink-0 text-[#8899aa] font-normal leading-[1.35] pt-[1px] tabular-nums">
            {formatReleaseDateLetterboxd(fallbackDate, language)}
          </span>
          <div className="shrink-0 pt-[1px]">
            <CircularFlag iso={fallbackIso} />
          </div>
          <div className="flex-1 min-w-0 leading-[1.35]">
            <span className="font-bold text-white mr-1.5">{countryName}</span>
          </div>
        </div>
      </div>
    );
  }

  // DESKTOP: Layout por tipo e data agrupada com bandeiras circulares e selo bordado
  if (!mobile) {
    const desktopGroups = [1, 2, 3, 4, 5, 6]
      .map((type) => {
        const items = filteredEntries
          .filter((e) => e.type === type)
          .sort((a, b) => {
            if (sortBy === 'country') {
              const nameA = resolveCountryLabel(a.iso, language, regions);
              const nameB = resolveCountryLabel(b.iso, language, regions);
              return nameA.localeCompare(nameB) || (a.date || '9999').localeCompare(b.date || '9999');
            }
            return (a.date || '9999').localeCompare(b.date || '9999');
          });

        const dateRows: { dateKey: string; items: typeof items }[] = [];
        for (const item of items) {
          const dKey = item.date.slice(0, 10);
          const prev = dateRows[dateRows.length - 1];
          if (
            prev &&
            prev.dateKey === dKey &&
            !item.note &&
            prev.items.every((x) => !x.note)
          ) {
            prev.items.push(item);
          } else {
            dateRows.push({ dateKey: dKey, items: [item] });
          }
        }
        return { type, dateRows };
      })
      .filter((g) => g.dateRows.length > 0);

    return (
      <div className="space-y-5">
        {desktopGroups.map((g, gIdx) => (
          <div key={g.type}>
            <div className="flex items-center justify-between border-b border-[#2c3440] pb-1.5 mb-1">
              <h4 className="text-[11px] uppercase tracking-[0.08em] text-[#778899] font-normal">
                {t(RELEASE_TYPE_LABELS[g.type])}
              </h4>
              {gIdx === 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSortBy((s) => (s === 'date' ? 'country' : 'date'))}
                    className="text-[11px] text-[#778899] hover:text-white transition-colors cursor-pointer"
                  >
                    {sortBy === 'date' ? t('sort_by_date') : t('sort_by_country')} ⌄
                  </button>
                </div>
              )}
            </div>
            <div className="divide-y divide-[#232a32]">
              {g.dateRows.map((row, rIdx) => (
                <div key={`${row.dateKey}-${rIdx}`} className="flex items-start gap-3 py-2.5 text-[12px]">
                  <span className="w-[84px] shrink-0 text-[#99aabb] leading-[1.4] tabular-nums">
                    {formatReleaseDateLetterboxd(row.dateKey, language)}
                  </span>
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3.5 gap-y-2">
                    {row.items.map((e, i) => {
                      const countryName = resolveCountryLabel(e.iso, language, regions);
                      const longNote = e.note.length > 28;
                      return (
                        <div
                          key={`${e.iso}-${i}`}
                          className={`inline-flex items-start gap-1.5 ${longNote ? 'w-full' : ''}`}
                        >
                          <div className="mt-[1px]">
                            <CircularFlag iso={e.iso} />
                          </div>
                          <div className="min-w-0 leading-[1.35]">
                            <div className="inline-flex flex-wrap items-center gap-1.5">
                              <span className="text-white font-bold">{countryName}</span>
                              {e.cert && (
                                <span className="border border-[#445566] bg-[#202830] text-[#99aabb] text-[10px] leading-none px-1.5 py-[2px] rounded-[3px] font-medium">
                                  {e.cert}
                                </span>
                              )}
                              {e.note && !longNote && (
                                <span className="text-[#778899]">{e.note}</span>
                              )}
                            </div>
                            {e.note && longNote && (
                              <p className="text-[#778899] text-[12px] leading-snug mt-0.5">
                                {e.note}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // MOBILE: Layout idêntico ao aplicativo oficial do Letterboxd (captura de tela do usuário)
  const mobileGroups = [1, 2, 3, 4, 5, 6]
    .map((type) => ({
      type,
      items: filteredEntries
        .filter((e) => e.type === type)
        .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {mobileGroups.map((g, gIdx) => (
        <section
          key={g.type}
          className={gIdx > 0 ? 'border-t border-[#232a32] pt-4 mt-3' : ''}
        >
          {/* Cabeçalho da seção: ex.: PREMIERE, THEATRICAL LIMITED, THEATRICAL */}
          <div className="flex items-center justify-between pb-1">
            <h4 className="text-[11px] uppercase font-bold tracking-[0.08em] text-[#778899]">
              {t(RELEASE_TYPE_LABELS[g.type])}
            </h4>
            {gIdx === 0 && (
              <button
                type="button"
                onClick={() => {
                  if (filterIso) {
                    setFilterIso(null);
                  } else if (availableCountries.length > 1) {
                    const next = availableCountries[0];
                    setFilterIso(next);
                  }
                }}
                title={filterIso ? `${t('common_all')} (${filterIso})` : t('common_all')}
                className={`p-1 -mr-1 rounded transition-colors ${
                  filterIso ? 'text-lb-green' : 'text-[#778899] hover:text-white'
                }`}
                aria-label="Filter releases by country"
              >
                <Globe className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Lista de lançamentos com data à esquerda, bandeira circular, país em negrito, classificação e festival/nota */}
          <div className="divide-y divide-transparent">
            {g.items.map((e, i) => {
              const countryName = resolveCountryLabel(e.iso, language, regions);
              return (
                <div
                  key={`${e.iso}-${e.date}-${i}`}
                  className="flex items-start gap-3 py-2 text-[13px]"
                >
                  {/* Coluna 1: Data (ex.: 6 Sep 2026) */}
                  <span className="w-[88px] shrink-0 text-[#8899aa] font-normal leading-[1.35] pt-[1px] tabular-nums">
                    {formatReleaseDateLetterboxd(e.date, language)}
                  </span>

                  {/* Coluna 2: Bandeira circular */}
                  <div className="shrink-0 pt-[1px]">
                    <CircularFlag iso={e.iso} />
                  </div>

                  {/* Coluna 3: País em negrito + Selo de classificação + Festival/Nota */}
                  <div className="flex-1 min-w-0 leading-[1.35]">
                    <span className="font-bold text-white mr-1.5">{countryName}</span>
                    {e.cert && (
                      <span className="inline-block border border-[#445566] bg-[#202830] text-[#99aabb] text-[10px] font-bold px-1.5 py-[1px] rounded-[3px] leading-none align-baseline mr-1.5">
                        {e.cert}
                      </span>
                    )}
                    {e.note && (
                      <span className="text-[#778899] font-normal">{e.note}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

// ---- Dispatcher compartilhado desktop/mobile -------------------------------
const FilmTabContent: React.FC<{
  activeTab: TabKey;
  movie: TMDBMovieDetails;
  isTv: boolean;
  numberOfSeasons?: number;
  mobile?: boolean;
}> = ({ activeTab, movie, isTv, mobile }) => {
  switch (activeTab) {
    case 'cast':
      return <CastTab movie={movie} mobile={mobile} />;
    case 'crew':
      return <CrewTab movie={movie} mobile={mobile} />;
    case 'details':
      return <DetailsTab movie={movie} isTv={isTv} mobile={mobile} />;
    case 'genres':
      return <GenresTab movie={movie} isTv={isTv} mobile={mobile} />;
    case 'releases':
      return <ReleasesTab movie={movie} mobile={mobile} />;
    default:
      return null;
  }
};

export default FilmPage;
