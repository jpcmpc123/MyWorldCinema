import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, List as ListIcon, SlidersHorizontal } from 'lucide-react';
import { tmdb, type TMDBMovie } from '../services/tmdb';
import { PosterCard } from '../components/PosterCard';
import { useApp } from '../context/AppContext';
import { FiltersModal, type FiltersDraft } from '../components/mobile/FiltersModal';
import { useLanguage } from '../i18n/LanguageContext';

/**
 * BrowseResultsPage — filtered poster grid driven entirely by URL query params:
 *   title, year, decade (e.g. "2020s"), genre, country, language, service,
 *   released (any|released|upcoming), sort, length (any|short|medium|long),
 *   type (any|movie|tv), fade, watched, watchlist, backdrop.
 *
 * TMDB service notes (see src/services/tmdb.ts):
 *  - country: convertido para ISO 3166-1 e aplicado via with_origin_country
 *    (server-side); type=tv sempre exclui Talk/News/Reality (10767,10763,10764).
 *  - released=upcoming: estritamente após hoje (releaseDateGte = amanhã).
 *  - length: discover results carry no runtime → client-side no-op.
 */

interface GridItem {
  movie: TMDBMovie;
  tv: boolean;
}

const normTitle = (m: TMDBMovie): TMDBMovie => {
  const a = m as unknown as Record<string, unknown>;
  return {
    ...m,
    title: m.title || (a.name as string) || '',
    release_date: m.release_date || (a.first_air_date as string) || '',
  };
};

export const BrowseResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMovieWatched, isMovieInWatchlist } = useApp();
  const { t } = useLanguage();

  const title = searchParams.get('title') || 'Browse';
  const type = searchParams.get('type') || 'any';
  const sort = searchParams.get('sort') || 'popularity.desc';
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
  const decadeStr = searchParams.get('decade');
  const decade = !year && decadeStr && /^\d{4}s$/.test(decadeStr) ? parseInt(decadeStr, 10) : undefined;
  const genre = searchParams.get('genre') ? Number(searchParams.get('genre')) : undefined;
  const service = searchParams.get('service') ? Number(searchParams.get('service')) : undefined;
  const language = searchParams.get('language') || undefined;
  // Nacionalidade: código ISO ou nome por extenso — o serviço converte para
  // ISO e aplica with_origin_country (nunca region/watch_region)
  const country = searchParams.get('country') || undefined;
  const released = searchParams.get('released') || 'any';
  const fade = searchParams.get('fade') === '1';
  const watchedFilter = searchParams.get('watched') || 'any';
  const watchlistFilter = searchParams.get('watchlist') || 'any';
  const backdropFilter = searchParams.get('backdrop') || 'any';
  // Preset de vitrine vindo das seções da Home (Popular/Highest rated/…)
  const preset = searchParams.get('preset') as
    | 'popular_week'
    | 'highest_rated'
    | 'most_watched'
    | 'most_anticipated'
    | null;

  // Itens passados via router state pela Home: mesma ordem do carrossel
  const location = useLocation();
  const locationState = location.state as { initialItems?: TMDBMovie[] } | null;
  const initialItemsRef = useRef<TMDBMovie[] | null>(locationState?.initialItems ?? null);
  // Só usamos os initialItems enquanto os filtros ainda forem os da navegação original
  const initialParamsKeyRef = useRef<string>(searchParams.toString());

  const [viewMode, setViewMode] = useState<'grid' | 'cards'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [items, setItems] = useState<GridItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

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
          language,
          country,
          sortBy: sort,
          // Released: aplicado no servidor (primary_release_date / first_air_date).
          // "upcoming" = estritamente após hoje (evita filmes lançados hoje)
          releaseDateGte: released === 'upcoming' ? tomorrow : undefined,
          releaseDateLte: released === 'released' ? today : undefined,
        };
        let next: GridItem[] = [];

        // ---- Vitrines (preset) vindas das seções da Home: fonte única
        // getSectionMedia garante ordem idêntica à Home; type=movie|tv NUNCA
        // mistura filmes e séries (cada um bate apenas no seu /discover).
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

          // Seed inicial: se a Home passou os itens via router state e os
          // filtros não mudaram, a grade começa com EXATAMENTE os mesmos
          // pôsteres e ordem do carrossel, continuando a paginação sem dups.
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
          // type=any: fetch both and interleave (movie, tv, movie, tv…)
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

        // length: discover results have no runtime field — cannot filter
        // client-side either; the URL param is kept so the Filters UI reflects
        // the choice. No-op by design.

        setItems((prev) => (pageNum === 1 ? next : [...prev, ...next]));
        setHasMore(next.length > 0);
      } catch {
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [genre, year, decade, service, language, country, sort, type, released, preset, searchParams],
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

  const applyFilters = (draft: FiltersDraft) => {
    const next: Record<string, string> = { ...draft };
    // Keep the human-readable page title if it isn't part of the draft
    if (searchParams.get('title') && !next.title) next.title = searchParams.get('title')!;
    setSearchParams(next);
    setFiltersOpen(false);
  };

  const initialDraft = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);

  return (
    <div className="min-h-screen bg-[#14181c]">
      <div className="max-w-[950px] mx-auto">
        <header className="bg-black sticky top-0 z-30 h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => navigate(-1)} aria-label={t('common_back')} className="text-white shrink-0">
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

        {visible.length === 0 && !loading ? (
          <p className="text-center text-sm text-[#9ab] py-16">{t('common_no_results_filters')}</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5 px-2 py-2 bg-[#14181c]">
            {visible.map(({ movie, tv }, index) => {
              const faded = fade && isMovieWatched(movie.id);
              // Stagger sutil limitado aos 24 primeiros itens (não anima "faded")
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

        {/* Scroll infinito: o sentinela carrega a próxima página ao aparecer na tela */}
        <div ref={sentinelRef} className="flex justify-center py-6 pb-24">
          {loading && hasMore ? (
            <span className="text-xs text-[#9ab]">{t('common_loading')}</span>
          ) : null}
          {!hasMore && items.length > 0 ? (
            <p className="text-xs text-[#9ab]">That’s all.</p>
          ) : null}
        </div>
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

// Helper factory returning the same normalizer for movies & series results
// (series come back as TMDBMovie-shaped objects from the service).
function normalizeMovieOrSeries() {
  return (m: TMDBMovie) => normTitle(m);
}
