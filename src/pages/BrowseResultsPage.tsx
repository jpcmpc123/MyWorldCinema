import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Heart,
  LayoutGrid,
  List as ListIcon,
  SlidersHorizontal,
} from 'lucide-react';
import { tmdb, type TMDBMovie, type TMDBMovieDetails } from '../services/tmdb';
import { PosterCard } from '../components/PosterCard';
import { useApp } from '../context/AppContext';
import { FiltersModal, type FiltersDraft } from '../components/mobile/FiltersModal';
import { useLanguage } from '../i18n/LanguageContext';

interface GridItem {
  movie: TMDBMovie;
  tv: boolean;
}

interface ThemeOrNanogenreSection {
  id: string;
  title: string;
  totalCount: number;
  items: TMDBMovie[];
  genreId?: number;
}

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1940, 1930, 1920];

const normTitle = (m: TMDBMovie): TMDBMovie => {
  const a = m as unknown as Record<string, unknown>;
  return {
    ...m,
    title: m.title || (a.name as string) || '',
    release_date: m.release_date || (a.first_air_date as string) || '',
  };
};

function formatCompactStat(val: number): string {
  if (val >= 1_000_000) {
    const m = val / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (val >= 1_000) {
    const k = val / 1_000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(val);
}

function capitalizeWords(str: string): string {
  return str
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const GENRE_THEME_DESCRIPTORS_EN: Record<number, string> = {
  27: 'Gory, spooky, and supernatural horror',
  53: 'Suspenseful thrillers and psychological tension',
  18: 'Moving, emotional, and character-driven drama',
  28: 'Explosive action, stunts, and high-stakes chases',
  12: 'Epic journeys, quests, and perilous adventures',
  878: 'Mind-bending sci-fi, dystopias, and futuristic worlds',
  14: 'Magical realms, mythologies, and dark fantasy',
  80: 'Gritty crime, heists, and underworld investigations',
  9648: 'Twisted mysteries, secrets, and eerie investigations',
  35: 'Sharp wit, quirky humor, and comedic misadventures',
  10749: 'Passionate romance, heartbreak, and relationships',
  16: 'Imaginative, expressive, and visually striking animation',
  36: 'Historical eras, real events, and period storytelling',
  10752: 'Harrowing warfare, survival, and battlefield courage',
  37: 'Dusty frontiers, outlaws, and classic western showdowns',
  10751: 'Heartwarming family stories and coming-of-age bonds',
  10402: 'Rhythm, stage performances, and musical passion',
  99: 'Fascinating real-world stories and documentaries',
  10759: 'High-stakes action, adventure, and relentless pacing',
  10765: 'Otherworldly sci-fi, fantasy, and supernatural lore',
  10768: 'Political intrigue, power struggles, and conflict',
};

const GENRE_THEME_DESCRIPTORS_PT: Record<number, string> = {
  27: 'Terror macabro, sobrenatural e atmosfera assustadora',
  53: 'Suspense psicológico, tensão e reviravoltas intensas',
  18: 'Drama emocionante, intenso e focado em personagens',
  28: 'Ação explosiva, perseguições e adrenalina constante',
  12: 'Jornadas épicas, expedições e grandes aventuras',
  878: 'Ficção científica instigante, distopias e futuros sombrios',
  14: 'Mundos mágicos, mitologia e fantasia sombria',
  80: 'Crime visceral, assaltos e investigações no submundo',
  9648: 'Mistérios intrigantes, segredos e enigmas sombrios',
  35: 'Humor afiado, situações excêntricas e comédia envolvente',
  10749: 'Romance apaixonante, encontros e dilemas amorosos',
  16: 'Animação expressiva, imaginativa e visualmente marcante',
  36: 'Épocas históricas, grandes eventos e reconstituições de período',
  10752: 'Guerra implacável, sobrevivência e coragem no front',
  37: 'Fronteiras sem lei, duelos e atmosfera clássica de faroeste',
  10751: 'Histórias familiares cativantes e laços de amadurecimento',
  10402: 'Ritmo, grandes performances e paixão pela música',
  99: 'Histórias reais fascinantes e olhares documentais',
  10759: 'Ação intensa, aventura épica e ritmo eletrizante',
  10765: 'Ficção científica, fantasia e universos sobrenaturais',
  10768: 'Intriga política, disputas de poder e conflitos',
};

export const BrowseResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMovieWatched, isMovieInWatchlist, movieOverrides } = useApp();
  const { language, t } = useLanguage();

  const title = searchParams.get('title') || 'Browse';
  const type = searchParams.get('type') || 'any';
  const sort = searchParams.get('sort') || 'popularity.desc';
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
  const decadeStr = searchParams.get('decade');
  const decade = !year && decadeStr && /^\d{4}s$/.test(decadeStr) ? parseInt(decadeStr, 10) : undefined;
  const genre = searchParams.get('genre') ? Number(searchParams.get('genre')) : undefined;
  const service = searchParams.get('service') ? Number(searchParams.get('service')) : undefined;
  const languageParam = searchParams.get('language') || undefined;
  const country = searchParams.get('country') || undefined;
  const released = searchParams.get('released') || 'any';
  const fade = searchParams.get('fade') === '1';
  const watchedFilter = searchParams.get('watched') || 'any';
  const watchlistFilter = searchParams.get('watchlist') || 'any';
  const backdropFilter = searchParams.get('backdrop') || 'any';
  const preset = searchParams.get('preset') as
    | 'popular_week'
    | 'highest_rated'
    | 'most_watched'
    | 'most_anticipated'
    | null;
  const similarTo = searchParams.get('similarTo') ? Number(searchParams.get('similarTo')) : undefined;
  const isSimilarMode = Boolean(similarTo && !Number.isNaN(similarTo));
  const isTvMedia: boolean = type === 'tv';

  const location = useLocation();
  const locationState = location.state as {
    initialItems?: TMDBMovie[];
    sourceMovie?: TMDBMovieDetails;
  } | null;
  const initialItemsRef = useRef<TMDBMovie[] | null>(locationState?.initialItems ?? null);
  const initialParamsKeyRef = useRef<string>(searchParams.toString());

  const [viewMode, setViewMode] = useState<'grid' | 'cards'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [items, setItems] = useState<GridItem[]>(() => {
    if (locationState?.initialItems?.length) {
      const isTvInit = (searchParams.get('type') || 'movie') === 'tv';
      return locationState.initialItems.map((m) => ({
        movie: normTitle(m),
        tv: isTvInit,
      }));
    }
    return [];
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // ----- Estado exclusivo para o modo "Filmes/Séries Semelhantes" no PC -----
  const [sourceDetails, setSourceDetails] = useState<TMDBMovieDetails | null>(() => {
    if (locationState?.sourceMovie && locationState.sourceMovie.id === similarTo) {
      return locationState.sourceMovie;
    }
    return null;
  });
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'themes' | 'nanogenres'>('all');
  const [openDropdown, setOpenDropdown] = useState<'decade' | 'service' | 'watched' | null>(null);
  const dropdownBarRef = useRef<HTMLDivElement | null>(null);

  const [themeSections, setThemeSections] = useState<ThemeOrNanogenreSection[]>([]);
  const [nanogenreSections, setNanogenreSections] = useState<ThemeOrNanogenreSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownBarRef.current && !dropdownBarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Carrega metadados completos da obra de origem (título, ano, pôster, backdrop, gêneros e keywords)
  useEffect(() => {
    if (!similarTo || Number.isNaN(similarTo)) {
      setSourceDetails(null);
      return;
    }
    let cancelled = false;
    const mediaType: 'movie' | 'tv' = type === 'tv' ? 'tv' : 'movie';

    (async () => {
      try {
        const details =
          mediaType === 'tv'
            ? await tmdb.getTVDetails(similarTo)
            : await tmdb.getMovieDetails(similarTo);
        if (!cancelled) {
          setSourceDetails(details);
        }
      } catch {
        // Mantém eventual sourceMovie vindo via state
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [similarTo, type, language]);

  // Constrói e popula as abas THEMES (8x2) e NANOGENRES (8x2) a partir da obra de origem
  useEffect(() => {
    if (!isSimilarMode || !sourceDetails) return;
    let cancelled = false;
    const mediaType: 'movie' | 'tv' = type === 'tv' ? 'tv' : 'movie';
    const genres = sourceDetails.genres || [];
    const rawKeywords = sourceDetails.keywords?.keywords || sourceDetails.keywords?.results || [];

    (async () => {
      setLoadingSections(true);
      try {
        const descriptorsMap =
          language === 'pt-BR' ? GENRE_THEME_DESCRIPTORS_PT : GENRE_THEME_DESCRIPTORS_EN;

        // 1. Definições de THEMES (4 a 5 seções baseadas nos gêneros e temas da obra)
        const themeConfigs: {
          id: string;
          title: string;
          genreIds: number[];
          keywordIds: number[];
          primaryGenreId?: number;
        }[] = [];

        genres.slice(0, 4).forEach((g, idx) => {
          const kwSlice = rawKeywords.slice(idx * 2, idx * 2 + 2);
          const baseDesc = descriptorsMap[g.id] || g.name;
          const kwSuffix =
            kwSlice.length > 0
              ? ` — ${kwSlice.map((k) => capitalizeWords(k.name)).join(' & ')}`
              : '';
          themeConfigs.push({
            id: `theme-genre-${g.id}`,
            title: `${baseDesc}${kwSuffix}`,
            genreIds: [g.id],
            keywordIds: kwSlice.map((k) => k.id),
            primaryGenreId: g.id,
          });
        });

        if (genres.length >= 2) {
          const g1 = genres[0];
          const g2 = genres[1];
          const comboTitle =
            language === 'pt-BR'
              ? `Fusão de ${g1.name} e ${g2.name} com atmosfera intensa`
              : ` Intense ${g1.name} & ${g2.name} crossovers`.trim();
          themeConfigs.push({
            id: `theme-combo-${g1.id}-${g2.id}`,
            title: comboTitle,
            genreIds: [g1.id, g2.id],
            keywordIds: rawKeywords.slice(0, 3).map((k) => k.id),
            primaryGenreId: g1.id,
          });
        }

        // 2. Definições de NANOGENRES (trios de 3 keywords estilo "Gory, Ghosts, Thrills")
        const nanoConfigs: {
          id: string;
          title: string;
          genreIds: number[];
          keywordIds: number[];
        }[] = [];

        const tagPool: { id?: number; name: string }[] = [
          ...rawKeywords.map((k) => ({ id: k.id, name: capitalizeWords(k.name) })),
          ...genres.map((g) => ({ name: capitalizeWords(g.name) })),
        ];

        const maxTrios = Math.min(5, Math.max(3, Math.floor(tagPool.length / 2)));
        for (let i = 0; i < maxTrios; i++) {
          const t1 = tagPool[(i * 2) % Math.max(1, tagPool.length)];
          const t2 = tagPool[(i * 2 + 1) % Math.max(1, tagPool.length)];
          const t3 = tagPool[(i * 2 + 2) % Math.max(1, tagPool.length)];
          const uniqueNames = Array.from(
            new Set([t1?.name, t2?.name, t3?.name].filter(Boolean) as string[]),
          );
          if (uniqueNames.length === 0) continue;
          const kwIds = [t1?.id, t2?.id, t3?.id].filter((x): x is number => typeof x === 'number');
          const gId = genres[i % Math.max(1, genres.length)]?.id;
          nanoConfigs.push({
            id: `nano-${i}-${uniqueNames.join('-')}`,
            title: uniqueNames.join(', '),
            genreIds: gId ? [gId] : [],
            keywordIds: kwIds,
          });
        }

        // Busca os resultados para cada seção de THEMES e NANOGENRES em paralelo
        const [themeResponses, nanoResponses] = await Promise.all([
          Promise.all(
            themeConfigs.map(async (cfg, idx) => {
              let res = await tmdb
                .discoverByKeywordsOrGenres(mediaType, {
                  genreIds: cfg.genreIds,
                  keywordIds: cfg.keywordIds,
                  excludeId: similarTo,
                  decade,
                  providerId: service,
                  page: 1,
                })
                .catch(() => ({ results: [] as TMDBMovie[], total_results: 0 }));

              // Se a combinação gênero + keyword for muito restrita (< 16), complementa apenas pelo gênero
              if (res.results.length < 16 && cfg.genreIds.length > 0) {
                const fallback = await tmdb
                  .discoverByKeywordsOrGenres(mediaType, {
                    genreIds: cfg.genreIds,
                    excludeId: similarTo,
                    decade,
                    providerId: service,
                    page: (idx % 2) + 1,
                  })
                  .catch(() => ({ results: [] as TMDBMovie[], total_results: 0 }));
                const seen = new Set(res.results.map((m) => m.id));
                const merged = [
                  ...res.results,
                  ...fallback.results.filter((m) => !seen.has(m.id)),
                ];
                res = {
                  results: merged,
                  total_results: Math.max(res.total_results, fallback.total_results, merged.length),
                };
              }

              return {
                id: cfg.id,
                title: cfg.title,
                totalCount: Math.min(240, Math.max(res.results.slice(0, 16).length, res.total_results || 64)),
                items: res.results.slice(0, 16),
                genreId: cfg.primaryGenreId,
              };
            }),
          ),
          Promise.all(
            nanoConfigs.map(async (cfg, idx) => {
              let res = await tmdb
                .discoverByKeywordsOrGenres(mediaType, {
                  genreIds: cfg.genreIds,
                  keywordIds: cfg.keywordIds,
                  excludeId: similarTo,
                  decade,
                  providerId: service,
                  page: 1,
                })
                .catch(() => ({ results: [] as TMDBMovie[], total_results: 0 }));

              if (res.results.length < 16) {
                const fallback = await tmdb
                  .discoverByKeywordsOrGenres(mediaType, {
                    genreIds: cfg.genreIds.length ? cfg.genreIds : genres.slice(0, 1).map((g) => g.id),
                    excludeId: similarTo,
                    decade,
                    providerId: service,
                    page: idx + 1,
                  })
                  .catch(() => ({ results: [] as TMDBMovie[], total_results: 0 }));
                const seen = new Set(res.results.map((m) => m.id));
                const merged = [
                  ...res.results,
                  ...fallback.results.filter((m) => !seen.has(m.id)),
                ];
                res = {
                  results: merged,
                  total_results: Math.max(res.total_results, fallback.total_results, merged.length),
                };
              }

              return {
                id: cfg.id,
                title: cfg.title,
                totalCount: Math.min(180, Math.max(res.results.slice(0, 16).length, res.total_results || 48)),
                items: res.results.slice(0, 16),
                genreId: cfg.genreIds[0],
              };
            }),
          ),
        ]);

        if (!cancelled) {
          setThemeSections(themeResponses.filter((s) => s.items.length > 0));
          setNanogenreSections(nanoResponses.filter((s) => s.items.length > 0));
        }
      } finally {
        if (!cancelled) setLoadingSections(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSimilarMode, sourceDetails, type, similarTo, decade, service, language]);

  const load = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const base = {
          genreId: genre,
          year,
          decade,
          providerId: service,
          language: languageParam,
          country,
          sortBy: sort,
          releaseDateGte: released === 'upcoming' ? tomorrow : undefined,
          releaseDateLte: released === 'released' ? today : undefined,
        };
        let next: GridItem[] = [];

        // ---- Filmes / Séries semelhantes (/movie/{id}/similar ou /tv/{id}/similar)
        if (similarTo && !Number.isNaN(similarTo)) {
          const mediaType: 'movie' | 'tv' = type === 'tv' ? 'tv' : 'movie';

          // Se um serviço de streaming foi filtrado no topo, combina com discover desse serviço + gêneros da obra
          let rawList: TMDBMovie[] = [];
          let totalPages = 5;

          if (service && sourceDetails?.genres?.length) {
            const srvRes = await tmdb.discoverByKeywordsOrGenres(mediaType, {
              genreIds: sourceDetails.genres.slice(0, 2).map((g) => g.id),
              excludeId: similarTo,
              decade,
              providerId: service,
              page: pageNum,
            });
            rawList = srvRes.results.map(normTitle);
            totalPages = 3;
          } else {
            const res = await tmdb.getSimilarMedia(mediaType, similarTo, pageNum);
            rawList = res.results.map(normTitle);
            totalPages = res.total_pages || 5;

            if (
              pageNum === 1 &&
              initialItemsRef.current?.length &&
              searchParams.toString() === initialParamsKeyRef.current
            ) {
              const seeded = initialItemsRef.current.map(normTitle);
              const seededIds = new Set(seeded.map((s) => s.id));
              rawList = [...seeded, ...rawList.filter((i) => !seededIds.has(i.id))];
            }
          }

          if (genre) {
            rawList = rawList.filter((m) => m.genre_ids?.includes(genre));
          }
          if (year) {
            rawList = rawList.filter((m) => m.release_date?.startsWith(String(year)));
          } else if (decade) {
            const decPrefix = String(decade).slice(0, 3);
            rawList = rawList.filter((m) => m.release_date?.startsWith(decPrefix));
          }
          if (released === 'upcoming') {
            rawList = rawList.filter((m) => m.release_date && m.release_date >= tomorrow);
          } else if (released === 'released') {
            rawList = rawList.filter((m) => !m.release_date || m.release_date <= today);
          }

          next = rawList.map((m) => ({ movie: m, tv: mediaType === 'tv' }));

          setItems((prev) => {
            const merged = pageNum === 1 ? next : [...prev, ...next];
            const seen = new Set<number>();
            return merged.filter((i) => (seen.has(i.movie.id) ? false : (seen.add(i.movie.id), true)));
          });
          setHasMore(next.length > 0 && pageNum < Math.min(totalPages, 25));
          return;
        }

        // ---- Vitrines (preset) vindas das seções da Home: fonte única
        if (preset) {
          const mediaType: 'movie' | 'tv' = type === 'tv' ? 'tv' : 'movie';
          const res = await tmdb.getSectionMedia(mediaType, preset, pageNum, {
            genreId: genre,
            year,
            decade,
            providerId: service,
            country,
          });
          next = res.results.map((m) => ({ movie: normTitle(m), tv: mediaType === 'tv' }));

          if (
            pageNum === 1 &&
            initialItemsRef.current?.length &&
            searchParams.toString() === initialParamsKeyRef.current
          ) {
            const seeded = initialItemsRef.current.map((m) => ({
              movie: normTitle(m),
              tv: mediaType === 'tv',
            }));
            const seededIds = new Set(seeded.map((s) => s.movie.id));
            next = [...seeded, ...next.filter((i) => !seededIds.has(i.movie.id))];
          }

          setItems((prev) => {
            const merged = pageNum === 1 ? next : [...prev, ...next];
            const seen = new Set<number>();
            return merged.filter((i) => (seen.has(i.movie.id) ? false : (seen.add(i.movie.id), true)));
          });
          setHasMore(next.length > 0 && pageNum < Math.min(res.total_pages || 1, 25));
          return;
        }

        // ---- Resultados genéricos com filtros da URL
        if (type === 'tv') {
          const res = await tmdb.discoverTVBatch({ ...base, page: pageNum, pagesToFetch: 2 });
          next = res.results.map((m) => ({ movie: normTitle(m), tv: true }));
        } else if (type === 'movie') {
          const res = await tmdb.discoverMoviesBatch({ ...base, page: pageNum, pagesToFetch: 2 });
          next = res.results.map((m) => ({ movie: normTitle(m), tv: false }));
        } else {
          const [moviesRes, tvRes] = await Promise.all([
            tmdb.discoverMoviesBatch({ ...base, page: pageNum, pagesToFetch: 1 }),
            tmdb.discoverTVBatch({ ...base, page: pageNum, pagesToFetch: 1 }),
          ]);
          const movies = moviesRes.results.map(normalizeMovieOrSeries());
          const tvs = tvRes.results.map(normalizeMovieOrSeries());
          const max = Math.max(movies.length, tvs.length);
          for (let i = 0; i < max && next.length < 40; i++) {
            if (movies[i]) next.push({ movie: movies[i], tv: false });
            if (tvs[i] && next.length < 40) next.push({ movie: tvs[i], tv: true });
          }
        }

        setItems((prev) => (pageNum === 1 ? next : [...prev, ...next]));
        setHasMore(next.length > 0);
      } catch {
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [
      genre,
      year,
      decade,
      service,
      languageParam,
      country,
      sort,
      type,
      released,
      preset,
      similarTo,
      searchParams,
      sourceDetails,
    ],
  );

  // Reload from scratch when the discovery params change
  useEffect(() => {
    setPage(1);
    window.scrollTo(0, 0);
    load(1);
  }, [load]);

  const loadMore = () => {
    if (loading || !hasMore) return;
    const next = page + 1;
    setPage(next);
    load(next);
  };

  // Scroll infinito: quando o sentinela entra na tela, carrega a próxima página
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, page]);

  // Client-side account filters (AppContext) + backdrop presence
  const visible = useMemo(
    () =>
      items.filter(({ movie }) => {
        if (watchedFilter === 'watched' && !isMovieWatched(movie.id)) return false;
        if (watchedFilter === 'not-watched' && isMovieWatched(movie.id)) return false;
        if (watchlistFilter === 'in' && !isMovieInWatchlist(movie.id)) return false;
        if (watchlistFilter === 'not-in' && isMovieInWatchlist(movie.id)) return false;
        if (backdropFilter === 'with' && !movie.backdrop_path) return false;
        return true;
      }),
    [items, watchedFilter, watchlistFilter, backdropFilter, isMovieWatched, isMovieInWatchlist],
  );

  const filterMovieList = useCallback(
    (list: TMDBMovie[]) =>
      list.filter((movie) => {
        if (watchedFilter === 'watched' && !isMovieWatched(movie.id)) return false;
        if (watchedFilter === 'not-watched' && isMovieWatched(movie.id)) return false;
        return true;
      }),
    [watchedFilter, isMovieWatched],
  );

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'any') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
    setOpenDropdown(null);
  };

  const applyFilters = (draft: FiltersDraft) => {
    const next: Record<string, string> = { ...draft };
    if (searchParams.get('title') && !next.title) next.title = searchParams.get('title')!;
    if (searchParams.get('similarTo') && !next.similarTo) next.similarTo = searchParams.get('similarTo')!;
    if (searchParams.get('preset') && !next.preset) next.preset = searchParams.get('preset')!;
    setSearchParams(next);
    setFiltersOpen(false);
  };

  const initialDraft = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);

  // ----- Dados derivados da obra de origem para o layout Desktop Similar -----
  const sourceTitle = sourceDetails?.title || title;
  const sourceRawDate =
    sourceDetails?.release_date ||
    ((sourceDetails as unknown as Record<string, unknown> | null)?.first_air_date as string) ||
    '';
  const sourceYear = sourceRawDate ? sourceRawDate.slice(0, 4) : '';
  const sourceHref = similarTo ? `${isTvMedia ? '/tv' : '/film'}/${similarTo}` : '/';

  const sourceOverride = similarTo ? movieOverrides[similarTo] : undefined;
  const sourcePosterUrl =
    sourceOverride?.poster ||
    (sourceDetails?.poster_path ? tmdb.getImageUrl(sourceDetails.poster_path, 'w780') : '');
  const sourceBackdropUrl =
    sourceOverride?.backdrop ||
    (sourceDetails?.backdrop_path ? tmdb.getBackdropUrl(sourceDetails.backdrop_path, 'original') : null);

  const voteCount = sourceDetails?.vote_count || 1200;
  const watchedStat = Math.max(35000, voteCount * 350);
  const listsStat = Math.max(8000, voteCount * 82);
  const likesStat = Math.max(12000, voteCount * 110);

  const selectedServiceObj = tmdb.streamingServices.find((s) => s.id === service);

  return (
    <div className="min-h-screen bg-[#14181c]">
      {/* =====================================================================
          DESKTOP SIMILAR FILMS / SERIES LAYOUT (md+, quando similarTo existe)
          Idêntico ao Letterboxd (Imagem de referência):
          - Mini-backdrop no topo direito com máscara em vinheta suave
          - Coluna esquerda (670px): SIMILAR FILMS FOR + Título/Ano + Abas
            (ALL | THEMES | NANOGENRES) + Filtros (DECADE | SERVICE | 👁)
          - Coluna direita (230px): Pôster 230x345 sobre o backdrop + Stats
            (👁 / ⊞ / 🧡) + "Browse all similar films ›" + "POWERED BY Nanocrowd"
          ===================================================================== */}
      {isSimilarMode && (
        <div className="hidden md:block relative overflow-x-clip">
          <div className="max-w-[950px] mx-auto relative">
            {/* Grade principal de 2 colunas: 670px (esquerda) + 50px gap + 230px (sidebar direita) */}
            <div className="relative z-10 grid grid-cols-[670px_230px] gap-x-[50px] items-start pb-20">
              {/* ==================== COLUNA ESQUERDA (670px) ==================== */}
              <div className="w-[670px] pt-[32px] min-w-0 relative z-10">
                {/* Kicker + Título da obra + Ano */}
                <div>
                  <span className="block text-[12px] uppercase tracking-[0.08em] text-[#99aabb] font-normal leading-snug mb-0.5">
                    {isTvMedia ? t('sim_kicker_series') : t('sim_kicker_films')}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2.5">
                    <Link
                      to={sourceHref}
                      className="font-serif font-bold text-[26px] text-white hover:text-[#40bcf4] transition-colors leading-[1.15] tracking-[-0.01em]"
                    >
                      {sourceTitle}
                    </Link>
                    {sourceYear && (
                      <Link
                        to={isTvMedia ? `/series/year/${sourceYear}` : `/films/year/${sourceYear}`}
                        className="text-[18px] font-normal text-[#99aabb] hover:text-white transition-colors tabular-nums"
                      >
                        {sourceYear}
                      </Link>
                    )}
                  </div>
                </div>

                {/* Barra de sub-abas (ALL | THEMES | NANOGENRES) + filtros (DECADE | SERVICE | 👁) */}
                <div
                  ref={dropdownBarRef}
                  className="mt-[26px] border-b border-[#2c3440] flex items-center justify-between select-none"
                >
                  {/* Abas à esquerda */}
                  <div className="flex items-center gap-4">
                    {(
                      [
                        ['all', t('sim_tab_all')],
                        ['themes', t('sim_tab_themes')],
                        ['nanogenres', t('sim_tab_nanogenres')],
                      ] as const
                    ).map(([key, label]) => {
                      const active = activeSubTab === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveSubTab(key)}
                          className={`pb-2 -mb-[1px] text-[12px] font-bold uppercase tracking-[0.075em] transition-colors cursor-pointer ${
                            active
                              ? 'text-white border-b-2 border-white'
                              : 'text-[#00e054] hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Filtros rápidos à direita (DECADE, SERVICE, 👁) */}
                  <div className="flex items-center gap-5">
                    {/* DECADE Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenDropdown((d) => (d === 'decade' ? null : 'decade'))}
                        className={`pb-2 flex items-center gap-1 text-[11px] uppercase tracking-[0.075em] transition-colors cursor-pointer ${
                          decade ? 'text-white font-semibold' : 'text-[#778899] hover:text-white'
                        }`}
                      >
                        <span>{decade ? `${decade}s` : t('cat_decade_upper')}</span>
                        <ChevronDown className="w-3 h-3 stroke-[2.2]" />
                      </button>

                      {openDropdown === 'decade' && (
                        <div className="absolute right-0 top-full w-36 bg-[#899aa9] text-[#1f272e] rounded-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.55)] py-1.5 z-40 text-[12px]">
                          <button
                            type="button"
                            onClick={() => updateParam('decade', null)}
                            className={`w-full text-left px-3.5 py-1 flex items-center justify-between hover:bg-[#677786] hover:text-white transition-colors cursor-pointer ${
                              !decade ? 'font-bold text-white bg-[#677786]/70' : ''
                            }`}
                          >
                            <span>{t('cat_all_decades')}</span>
                            {!decade && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <div className="border-t border-[#738494] my-1" />
                          {DECADES.map((dec) => {
                            const isSelected = decade === dec;
                            return (
                              <button
                                key={dec}
                                type="button"
                                onClick={() => updateParam('decade', `${dec}s`)}
                                className={`w-full text-left px-3.5 py-1 flex items-center justify-between hover:bg-[#677786] hover:text-white transition-colors cursor-pointer tabular-nums ${
                                  isSelected ? 'font-bold text-white bg-[#677786]/70' : ''
                                }`}
                              >
                                <span>{dec}s</span>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* SERVICE Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenDropdown((d) => (d === 'service' ? null : 'service'))}
                        className={`pb-2 flex items-center gap-1 text-[11px] uppercase tracking-[0.075em] transition-colors cursor-pointer ${
                          service ? 'text-white font-semibold' : 'text-[#778899] hover:text-white'
                        }`}
                      >
                        <span>{selectedServiceObj ? selectedServiceObj.name : t('cat_service_upper')}</span>
                        <ChevronDown className="w-3 h-3 stroke-[2.2]" />
                      </button>

                      {openDropdown === 'service' && (
                        <div className="absolute right-0 top-full w-48 bg-[#899aa9] text-[#1f272e] rounded-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.55)] py-1.5 z-40 text-[12px]">
                          <button
                            type="button"
                            onClick={() => updateParam('service', null)}
                            className={`w-full text-left px-3.5 py-1 flex items-center justify-between hover:bg-[#677786] hover:text-white transition-colors cursor-pointer ${
                              !service ? 'font-bold text-white bg-[#677786]/70' : ''
                            }`}
                          >
                            <span>{t('sim_any_service')}</span>
                            {!service && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <div className="border-t border-[#738494] my-1" />
                          {tmdb.streamingServices.map((srv) => {
                            const isSelected = service === srv.id;
                            return (
                              <button
                                key={srv.id}
                                type="button"
                                onClick={() => updateParam('service', String(srv.id))}
                                className={`w-full text-left px-3.5 py-1 flex items-center justify-between hover:bg-[#677786] hover:text-white transition-colors cursor-pointer ${
                                  isSelected ? 'font-bold text-white bg-[#677786]/70' : ''
                                }`}
                              >
                                <span>{srv.name}</span>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* EYE / WATCHED Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenDropdown((d) => (d === 'watched' ? null : 'watched'))}
                        aria-label={t('flt_watched')}
                        className={`pb-2 flex items-center gap-0.5 text-[11px] transition-colors cursor-pointer ${
                          watchedFilter !== 'any' || fade
                            ? 'text-[#00e054]'
                            : 'text-[#778899] hover:text-white'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <ChevronDown className="w-3 h-3 stroke-[2.2]" />
                      </button>

                      {openDropdown === 'watched' && (
                        <div className="absolute right-0 top-full w-44 bg-[#899aa9] text-[#1f272e] rounded-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.55)] py-1.5 z-40 text-[12px]">
                          {[
                            { value: 'any', label: t('sim_show_all') },
                            { value: 'watched', label: t('sim_show_watched') },
                            { value: 'not-watched', label: t('sim_hide_watched') },
                          ].map((opt) => {
                            const isSelected = watchedFilter === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateParam('watched', opt.value)}
                                className={`w-full text-left px-3.5 py-1 flex items-center justify-between hover:bg-[#677786] hover:text-white transition-colors cursor-pointer ${
                                  isSelected ? 'font-bold text-white bg-[#677786]/70' : ''
                                }`}
                              >
                                <span>{opt.label}</span>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </button>
                            );
                          })}
                          <div className="border-t border-[#738494] my-1" />
                          <button
                            type="button"
                            onClick={() => updateParam('fade', fade ? null : '1')}
                            className={`w-full text-left px-3.5 py-1 flex items-center justify-between hover:bg-[#677786] hover:text-white transition-colors cursor-pointer ${
                              fade ? 'font-bold text-white bg-[#677786]/70' : ''
                            }`}
                          >
                            <span>{t('sim_fade_watched')}</span>
                            {fade && <Check className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ==================== CONTEÚDO DA ABA SELECIONADA ==================== */}
                {activeSubTab === 'all' && (
                  <div>
                    {/* Faixa informativa: "There are N films similar to [Title]." */}
                    <div className="mt-5 mb-5 bg-[#283038] rounded-[3px] py-2.5 px-4 text-center text-[13px] text-[#99aabb]">
                      <span>
                        {(isTvMedia ? t('sim_banner_series_prefix') : t('sim_banner_films_prefix')).replace(
                          '{count}',
                          String(visible.length || 80),
                        )}{' '}
                      </span>
                      <Link
                        to={sourceHref}
                        className="text-white font-semibold hover:text-[#40bcf4] transition-colors"
                      >
                        {sourceTitle}
                      </Link>
                      <span>.</span>
                    </div>

                    {visible.length === 0 && !loading ? (
                      <p className="text-center text-sm text-[#99aabb] py-16">
                        {t('common_no_results_filters')}
                      </p>
                    ) : (
                      <div className="grid grid-cols-5 gap-[10px]">
                        {visible.map(({ movie, tv }, index) => {
                          const faded = fade && isMovieWatched(movie.id);
                          const stagger =
                            !faded && index < 20 ? { animationDelay: `${index * 24}ms` } : undefined;
                          return (
                            <div
                              key={`${tv ? 'tv' : 'm'}-${movie.id}`}
                              className={faded ? '' : 'mw-page-in'}
                              style={stagger}
                            >
                              <PosterCard
                                movie={movie}
                                size="fluid"
                                tv={tv}
                                faded={faded}
                                showDetails={false}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeSubTab === 'themes' && (
                  <div className="mt-6 space-y-8">
                    {loadingSections && themeSections.length === 0 ? (
                      <p className="text-center text-xs text-[#99aabb] py-12">{t('common_loading')}</p>
                    ) : themeSections.length === 0 ? (
                      <p className="text-center text-sm text-[#99aabb] py-12">
                        {t('common_no_results_filters')}
                      </p>
                    ) : (
                      themeSections.map((section) => {
                        const filteredItems = filterMovieList(section.items).slice(0, 16);
                        if (filteredItems.length === 0) return null;
                        return (
                          <section key={section.id} className="space-y-2.5">
                            <div
                              onClick={() => {
                                if (section.genreId) {
                                  navigate(
                                    `/browse/results?type=${isTvMedia ? 'tv' : 'movie'}&genre=${
                                      section.genreId
                                    }&title=${encodeURIComponent(section.title)}`,
                                  );
                                } else {
                                  setActiveSubTab('all');
                                }
                              }}
                              className="flex items-center justify-between border-b border-[#2c3440] pb-1.5 group cursor-pointer"
                            >
                              <div className="flex items-baseline min-w-0 pr-3">
                                <h3 className="text-[15px] font-semibold text-white group-hover:text-[#40bcf4] transition-colors truncate">
                                  {section.title}
                                </h3>
                                <span className="text-[12.5px] font-normal text-[#667788] ml-2 shrink-0 tabular-nums">
                                  {section.totalCount}{' '}
                                  {isTvMedia ? t('sim_series_count') : t('sim_films_count')}
                                </span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-[#667788] group-hover:text-white shrink-0 transition-colors" />
                            </div>

                            {/* Grade de 8 colunas × 2 linhas (16 pôsteres) igual ao Letterboxd */}
                            <div className="grid grid-cols-8 gap-[6px]">
                              {filteredItems.map((m) => {
                                const faded = fade && isMovieWatched(m.id);
                                return (
                                  <PosterCard
                                    key={m.id}
                                    movie={m}
                                    size="fluid"
                                    tv={isTvMedia}
                                    faded={faded}
                                    showDetails={false}
                                    disableHoverActions
                                  />
                                );
                              })}
                            </div>
                          </section>
                        );
                      })
                    )}
                  </div>
                )}

                {activeSubTab === 'nanogenres' && (
                  <div className="mt-6 space-y-8">
                    {loadingSections && nanogenreSections.length === 0 ? (
                      <p className="text-center text-xs text-[#99aabb] py-12">{t('common_loading')}</p>
                    ) : nanogenreSections.length === 0 ? (
                      <p className="text-center text-sm text-[#99aabb] py-12">
                        {t('common_no_results_filters')}
                      </p>
                    ) : (
                      nanogenreSections.map((section) => {
                        const filteredItems = filterMovieList(section.items).slice(0, 16);
                        if (filteredItems.length === 0) return null;
                        return (
                          <section key={section.id} className="space-y-2.5">
                            <div
                              onClick={() => {
                                if (section.genreId) {
                                  navigate(
                                    `/browse/results?type=${isTvMedia ? 'tv' : 'movie'}&genre=${
                                      section.genreId
                                    }&title=${encodeURIComponent(section.title)}`,
                                  );
                                } else {
                                  setActiveSubTab('all');
                                }
                              }}
                              className="flex items-center justify-between border-b border-[#2c3440] pb-1.5 group cursor-pointer"
                            >
                              <div className="flex items-baseline min-w-0 pr-3">
                                <h3 className="text-[15px] font-semibold text-white group-hover:text-[#40bcf4] transition-colors truncate">
                                  {section.title}
                                </h3>
                                <span className="text-[12.5px] font-normal text-[#667788] ml-2 shrink-0 tabular-nums">
                                  {section.totalCount}{' '}
                                  {isTvMedia ? t('sim_series_count') : t('sim_films_count')}
                                </span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-[#667788] group-hover:text-white shrink-0 transition-colors" />
                            </div>

                            {/* Grade de 8 colunas × 2 linhas (16 pôsteres) igual ao Letterboxd */}
                            <div className="grid grid-cols-8 gap-[6px]">
                              {filteredItems.map((m) => {
                                const faded = fade && isMovieWatched(m.id);
                                return (
                                  <PosterCard
                                    key={m.id}
                                    movie={m}
                                    size="fluid"
                                    tv={isTvMedia}
                                    faded={faded}
                                    showDetails={false}
                                    disableHoverActions
                                  />
                                );
                              })}
                            </div>
                          </section>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* ==================== SIDEBAR DIREITA (230px) ==================== */}
              <aside className="w-[230px] pt-[122px] shrink-0 relative">
                {/* Mini-backdrop oficial estilo Letterboxd:
                    - Centralizado exatamente no eixo do pôster de 230px (left-1/2 -translate-x-1/2)
                    - Encostado no topo (top-0, sem faixa escura no topo)
                    - Proporção 16:9 (420×236px) com a rampa de 28 stops horizontais + 15 stops verticais do Letterboxd */}
                {sourceBackdropUrl && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none select-none absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[236px] overflow-hidden z-0"
                  >
                    <img
                      src={sourceBackdropUrl}
                      alt=""
                      fetchPriority="high"
                      decoding="async"
                      className="w-full h-full object-cover object-top block"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `
                          linear-gradient(
                            90deg,
                            #14181c 0%, #14181cfb 1.2%, #14181cf1 2.6%, #14181ce1 4.1%,
                            #14181ccd 5.8%, #14181cb5 7.5%, #14181c9b 9.2%, #14181c80 11.0%,
                            #14181c65 12.7%, #14181c4b 14.4%, #14181c34 16.0%, #14181c1f 17.5%,
                            #14181c0f 18.8%, #14181c04 19.9%, #14181c00 21% 79%,
                            #14181c04 80.1%, #14181c0f 81.2%, #14181c1f 82.5%, #14181c34 84.0%,
                            #14181c4b 85.6%, #14181c65 87.3%, #14181c80 89.0%, #14181c9b 90.8%,
                            #14181cb5 92.5%, #14181ccd 94.2%, #14181ce1 95.9%, #14181cf1 97.4%,
                            #14181cfb 98.8%, #14181c 100%
                          ),
                          linear-gradient(
                            180deg,
                            #14181c00 0% 38%, #14181c04 41%, #14181c0f 44.5%, #14181c1f 48.5%,
                            #14181c34 53%, #14181c4b 57.5%, #14181c65 62.5%, #14181c80 67.5%,
                            #14181c9b 72.5%, #14181cb5 77.5%, #14181ccd 82.5%, #14181ce1 87%,
                            #14181cf1 91.5%, #14181cfb 95.5%, #14181c 98.5% 100%
                          )
                        `,
                      }}
                    />
                  </div>
                )}

                {/* Pôster oficial grande (230×345px) sobreposto à base do mini-backdrop */}
                <Link
                  to={sourceHref}
                  className="block w-[230px] h-[345px] rounded-[4px] overflow-hidden border border-white/15 shadow-[0_6px_24px_rgba(0,0,0,0.85)] bg-[#1c2228] relative z-10 group"
                >
                  {sourcePosterUrl ? (
                    <img
                      src={sourcePosterUrl}
                      alt={sourceTitle}
                      className="w-full h-full object-cover"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-4 text-center text-sm text-[#99aabb]">
                      {sourceTitle}
                    </div>
                  )}
                  <span className="absolute inset-0 ring-inset ring-2 ring-transparent group-hover:ring-[#00e054] rounded-[4px] transition-all pointer-events-none" />
                </Link>

                {/* Linha de estatísticas abaixo do pôster: 👁 1.6M   ⊞ 362K   🧡 484K */}
                <div className="mt-2.5 flex items-center justify-center gap-3.5 text-[11px] text-[#899aa9] select-none tabular-nums">
                  <span
                    className="inline-flex items-center gap-1 hover:text-white transition-colors"
                    title={`${watchedStat.toLocaleString()} ${t('film_stat_watched')}`}
                  >
                    <Eye className="w-3.5 h-3.5 text-[#00e054]" />
                    <span>{formatCompactStat(watchedStat)}</span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1 hover:text-white transition-colors"
                    title={`${listsStat.toLocaleString()} ${t('film_stat_lists')}`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-[#40bcf4] fill-[#40bcf4]" />
                    <span>{formatCompactStat(listsStat)}</span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1 hover:text-white transition-colors"
                    title={`${likesStat.toLocaleString()} ${t('film_stat_likes')}`}
                  >
                    <Heart className="w-3.5 h-3.5 text-[#ff8000] fill-[#ff8000]" />
                    <span>{formatCompactStat(likesStat)}</span>
                  </span>
                </div>

                {/* Link "Browse all similar films ›" com borda superior e inferior */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubTab('all');
                    const next = new URLSearchParams(searchParams);
                    next.delete('decade');
                    next.delete('service');
                    next.delete('watched');
                    setSearchParams(next);
                  }}
                  className="w-full mt-5 border-y border-[#2c3440] py-2.5 flex items-center justify-between text-[12px] text-[#99aabb] hover:text-white transition-colors cursor-pointer group text-left"
                >
                  <span>
                    {isTvMedia ? t('sim_browse_all_series') : t('sim_browse_all_films')}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#667788] group-hover:text-white transition-colors shrink-0" />
                </button>
              </aside>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MOBILE (< 768px) OU OUTROS MODOS DE BROWSE SEM similarTo
          Mantém exatamente a barra superior preta e a grade de 4 colunas
          ===================================================================== */}
      <div className={`max-w-[950px] mx-auto ${isSimilarMode ? 'md:hidden' : ''}`}>
        <header className="bg-black fixed md:sticky top-0 inset-x-0 z-40 h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => navigate(-1)}
              aria-label={t('common_back')}
              className="text-white shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-white truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode((m) => (m === 'grid' ? 'cards' : 'grid'))}
              aria-label={t('common_toggle_view')}
              className="text-white"
            >
              {viewMode === 'grid' ? (
                <ListIcon className="w-5 h-5" />
              ) : (
                <LayoutGrid className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={() => setFiltersOpen(true)}
              aria-label={t('common_open_filters')}
              className="text-white"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="h-14 md:hidden shrink-0" aria-hidden="true" />

        {visible.length === 0 && !loading ? (
          <p className="text-center text-sm text-[#9ab] py-16">{t('common_no_results_filters')}</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5 px-2 py-2 bg-[#14181c]">
            {visible.map(({ movie, tv }, index) => {
              const faded = fade && isMovieWatched(movie.id);
              const stagger = !faded && index < 24 ? { animationDelay: `${index * 28}ms` } : undefined;
              return (
                <div
                  key={`${tv ? 'tv' : 'm'}-${movie.id}`}
                  className={faded ? '' : 'mw-page-in'}
                  style={stagger}
                >
                  <PosterCard
                    movie={movie}
                    size="fluid"
                    tv={tv}
                    faded={faded}
                    showDetails={viewMode === 'cards'}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scroll infinito compartilhado */}
      <div
        ref={sentinelRef}
        className={`flex justify-center py-6 pb-24 ${
          isSimilarMode && activeSubTab !== 'all' ? 'md:hidden' : ''
        }`}
      >
        {loading && hasMore ? (
          <span className="text-xs text-[#9ab]">{t('common_loading')}</span>
        ) : null}
        {!hasMore && items.length > 0 ? (
          <p className="text-xs text-[#9ab]">That’s all.</p>
        ) : null}
      </div>

      <FiltersModal
        open={filtersOpen}
        initial={initialDraft}
        onClose={() => setFiltersOpen(false)}
        onApply={applyFilters}
      />
    </div>
  );
};

function normalizeMovieOrSeries() {
  return (m: TMDBMovie) => normTitle(m);
}

