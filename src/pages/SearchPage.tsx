import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Eye, Search, Star, X } from 'lucide-react';
import { tmdb, type TMDBSearchPerson, type TMDBSearchResult } from '../services/tmdb';
import { useLanguage } from '../i18n/LanguageContext';
import { useApp } from '../context/AppContext';
import type { TranslationKey } from '../i18n/translations';
import { openPersonProfile, personRoleFromDepartment } from '../utils/personNav';
import { useIsMobile } from '../hooks/useIsMobile';
import { useSwipeableTabs } from '../hooks/useSwipeableTabs';

/**
 * SearchPage — página dedicada de RESULTADOS DE BUSCA no layout do Letterboxd.
 *
 * - Container centralizado (980px) com grid 1fr / 240px (1 coluna no mobile).
 * - Coluna esquerda: "SHOWING MATCHES FOR …" + lista de resultados.
 * - Coluna direita: "SHOW RESULTS FOR" com os filtros (All/Films/Series/…).
 * - O termo vive em ?q= e o filtro em ?f= (compartilhável/voltar funciona).
 * - Filmes e séries NUNCA se misturam na mesma lista: a aba "All" mostra
 *   filmes primeiro e depois séries, cada um com seu próprio tipo.
 */
type SearchFilter = 'all' | 'films' | 'series' | 'reviews' | 'lists' | 'cast' | 'members';

const FILTERS: { id: SearchFilter; labelKey: TranslationKey }[] = [
  { id: 'all', labelKey: 'search_filter_all' },
  { id: 'films', labelKey: 'search_filter_films' },
  { id: 'series', labelKey: 'search_filter_series' },
  { id: 'reviews', labelKey: 'search_filter_reviews' },
  { id: 'lists', labelKey: 'search_filter_lists' },
  { id: 'cast', labelKey: 'search_filter_cast' },
  { id: 'members', labelKey: 'search_filter_members' },
];

/** Abas do MOBILE (fluxo do app): Filmes, Séries, Críticas, Listas, Elenco/Equipe/Estúdios */
const MOBILE_FILTER_IDS: SearchFilter[] = ['films', 'series', 'reviews', 'lists', 'cast'];
const MOBILE_FILTERS = FILTERS.filter((f) => MOBILE_FILTER_IDS.includes(f.id));

/** Fade-in: monta com opacity-0 e, no frame seguinte, vai para opacity-100 (transição real). */
/** Fade-in; com `dir` (±1) entra também deslizando lateralmente, como a esteira
 *  de abas da página de pessoa (translate + 0,32s, mesma curva). */
const FadeIn: React.FC<{ children: React.ReactNode; dir?: 1 | -1 | 0 }> = ({ children, dir = 0 }) => {
  const slide = dir !== 0;
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Estado inicial (opacidade 0 / deslocado) é pintado ANTES de animar para o
  // estado final: força um reflow e só então ativa a transição.
  useLayoutEffect(() => {
    void ref.current?.offsetWidth;
    const id = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const hiddenX = dir > 0 ? '12%' : '-12%';
  // Com deslizamento: SÓ transform (sem opacity), para o conteúdo não escurecer
  // durante a troca. Sem deslizamento (modo idle/fade): mantém o fade-in.
  return (
    <div
      ref={ref}
      style={
        slide
          ? {
              transform: visible ? 'translateX(0)' : `translateX(${hiddenX})`,
              transition: 'transform 480ms cubic-bezier(0.22,1,0.36,1)',
            }
          : {
              opacity: visible ? 1 : 0,
              transition: 'opacity 200ms ease-in-out',
            }
      }
    >
      {children}
    </div>
  );
};

/** Título de seção no estilo Letterboxd (caixa alta, borda inferior). */
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="uppercase text-[0.78rem] tracking-[0.08em] text-[#9ab] border-b border-[#2c3440] pb-2 mb-1">
    {children}
  </h2>
);

/** Máximo de títulos alternativos exibidos antes do "…more". */
const ALT_TITLES_VISIBLE = 10;

const ResultRow: React.FC<{ item: TMDBSearchResult; t: (k: TranslationKey) => string }> = ({
  item,
  t,
}) => {
  const { isMovieWatched, ratingsMap } = useApp();
  const [showAllTitles, setShowAllTitles] = useState(false);
  const year = item.release_date ? item.release_date.slice(0, 4) : '';

  // Sem títulos alternativos, cai para o título original (quando diferente)
  const altTitles = useMemo(() => {
    const list = item.alternativeTitles.filter(
      (alt) => alt.trim() && alt.trim().toLowerCase() !== item.title.trim().toLowerCase()
    );
    if (list.length) return list;
    if (item.original_title && item.original_title.trim() !== item.title.trim()) {
      return [item.original_title];
    }
    return [];
  }, [item.alternativeTitles, item.original_title, item.title]);

  const hasMoreTitles = altTitles.length > ALT_TITLES_VISIBLE;
  const visibleTitles = showAllTitles ? altTitles : altTitles.slice(0, ALT_TITLES_VISIBLE);

  const userRating = ratingsMap[item.id] ?? 0;
  const watched = isMovieWatched(item.id);
  const href = item.media_type === 'tv' ? `/tv/${item.id}` : `/film/${item.id}`;
  const handlePrefetch = () => {
    if (item.media_type === 'tv') {
      tmdb.getTVDetails(item.id).catch(() => {});
    } else {
      tmdb.getMovieDetails(item.id).catch(() => {});
    }
  };

  return (
    <Link
      to={href}
      onPointerDown={handlePrefetch}
      onTouchStart={handlePrefetch}
      onMouseEnter={handlePrefetch}
      className="flex gap-[18px] py-[18px] border-b border-[#2c3440] items-start group"
    >
      {/* Pôster 70x105 (placeholder escuro quando não há arte) */}
      <div className="w-[70px] h-[105px] shrink-0 rounded-[4px] overflow-hidden border border-white/12 bg-[#1c2228]">
        {item.poster_path ? (
          <img
            src={tmdb.getImageUrl(item.poster_path, 'w185')}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full border border-[#2c3440]" aria-hidden="true" />
        )}
      </div>

      {/* Bloco de informações */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[1.25rem] font-bold text-white leading-tight group-hover:text-lb-green transition-colors">
            {item.title}
          </span>
          {year && <span className="text-base font-normal text-[#789]">{year}</span>}
          {watched && <Eye className="w-3.5 h-3.5 text-lb-green self-center" aria-hidden="true" />}
          {userRating > 0 && (
            <span className="inline-flex items-center gap-0.5 self-center" aria-label={`${userRating} stars`}>
              {[1, 2, 3, 4, 5].map((n) => {
                const fill = Math.max(0, Math.min(1, userRating - (n - 1)));
                return (
                  <span key={n} className="relative inline-block w-3 h-3">
                    <Star className="w-3 h-3 text-lb-border stroke-[1.5]" />
                    {fill > 0 && (
                      <span
                        className="absolute inset-0 overflow-hidden"
                        style={{ width: fill >= 1 ? '100%' : '50%' }}
                      >
                        <Star className="w-3 h-3 text-lb-green fill-lb-green stroke-lb-green" />
                      </span>
                    )}
                  </span>
                );
              })}
            </span>
          )}
        </div>

        {altTitles.length > 0 && (
          <p className="mt-1.5 text-[0.78rem] text-[#678] leading-[1.45] break-words">
            {t('search_alt_titles')}: {visibleTitles.join(', ')}
            {hasMoreTitles && !showAllTitles && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAllTitles(true);
                }}
                className="ml-1 font-bold text-white hover:text-lb-green cursor-pointer"
              >
                {t('search_more')}
              </button>
            )}
          </p>
        )}

        {item.directors.length > 0 && (
          <div className="mt-2.5 flex items-center flex-wrap gap-1.5 text-[0.8rem] text-[#789]">
            <span>{t('search_directed_by')}</span>
            {item.directors.map((director) => (
              <span
                key={director}
                className="bg-[#283038] text-[#9ab] px-2 py-[3px] rounded-[3px] text-[0.78rem] font-medium"
              >
                {director}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
};

const PersonRow: React.FC<{ person: TMDBSearchPerson }> = ({ person }) => {
  const known = (person.known_for ?? [])
    .map((k) => k.title || k.name)
    .filter(Boolean)
    .slice(0, 4)
    .join(', ');

  return (
    <Link
      to={openPersonProfile(person.id, personRoleFromDepartment(person.known_for_department))}
      className="flex gap-[18px] py-[18px] border-b border-[#2c3440] items-start group"
    >
      <div className="w-[70px] h-[105px] shrink-0 rounded-[4px] overflow-hidden border border-white/12 bg-[#1c2228]">
        {person.profile_path ? (
          <img
            src={tmdb.getImageUrl(person.profile_path, 'w185')}
            alt={person.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full border border-[#2c3440]" aria-hidden="true" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[1.25rem] font-bold text-white leading-tight group-hover:text-lb-green transition-colors">
          {person.name}
        </span>
        {person.known_for_department && (
          <p className="mt-1.5 text-[0.78rem] text-[#678]">{person.known_for_department}</p>
        )}
        {known && (
          <div className="mt-2.5 flex items-center flex-wrap gap-1.5 text-[0.8rem] text-[#789]">
            {known.split(', ').map((credit) => (
              <span
                key={credit}
                className="bg-[#283038] text-[#9ab] px-2 py-[3px] rounded-[3px] text-[0.78rem] font-medium"
              >
                {credit}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
};

/* ---------------------------------------------------------------------------
 * Linhas compactas do MOBILE (réplica do app Letterboxd): pôster 40x60,
 * título em negrito + ano + "dirigido por" em texto corrido, sem badges.
 * ------------------------------------------------------------------------- */
const MobilePoster: React.FC<{ path?: string | null; alt: string }> = ({ path, alt }) =>
  path ? (
    <img
      src={tmdb.getImageUrl(path, 'w185')}
      alt={alt}
      className="w-10 h-[60px] object-cover rounded border border-white/10 flex-shrink-0"
      loading="lazy"
      decoding="async"
    />
  ) : (
    <div
      className="w-10 h-[60px] rounded border border-white/10 bg-[#1c2228] flex-shrink-0"
      aria-hidden="true"
    />
  );

const MobileMovieRow: React.FC<{ item: TMDBSearchResult; t: (k: TranslationKey) => string }> = ({
  item,
  t,
}) => {
  const releaseYear = item.release_date ? item.release_date.slice(0, 4) : '';
  const director = (item.directors ?? []).join(', ');
  const href = item.media_type === 'tv' ? `/tv/${item.id}` : `/film/${item.id}`;
  const handlePrefetch = () => {
    if (item.media_type === 'tv') {
      tmdb.getTVDetails(item.id).catch(() => {});
    } else {
      tmdb.getMovieDetails(item.id).catch(() => {});
    }
  };
  return (
    <Link
      to={href}
      onPointerDown={handlePrefetch}
      onTouchStart={handlePrefetch}
      onMouseEnter={handlePrefetch}
      className="flex items-center gap-3.5 px-4 py-2.5 border-b border-white/10 active:bg-white/5"
    >
      <MobilePoster path={item.poster_path} alt={item.title} />
      <div className="flex flex-col justify-center min-w-0">
        <p className="text-sm text-[#9ab] leading-snug">
          <span className="font-bold text-white text-[15px]">{item.title}</span>{' '}
          {releaseYear && <span>{releaseYear}</span>}
          {director && (
            <span>
              , {t('search_directed_by').toLowerCase()}{' '}
              <strong className="font-semibold text-[#cde]">{director}</strong>
            </span>
          )}
        </p>
      </div>
    </Link>
  );
};

const MobilePersonRow: React.FC<{ person: TMDBSearchPerson }> = ({ person }) => (
  <Link
    to={openPersonProfile(person.id, personRoleFromDepartment(person.known_for_department))}
    className="flex items-center gap-3.5 px-4 py-2.5 border-b border-white/10 active:bg-white/5"
  >
    <MobilePoster path={person.profile_path} alt={person.name} />
    <div className="flex flex-col justify-center min-w-0">
      <p className="text-sm text-[#9ab] leading-snug">
        <span className="font-bold text-white text-[15px]">{person.name}</span>
        {person.known_for_department && <span>, {person.known_for_department}</span>}
      </p>
    </div>
  </Link>
);

const MobileLocalRow: React.FC<{
  to: string;
  title: string;
  year?: string | number | null;
  subtitle?: string | null;
  poster?: string | null;
}> = ({ to, title, year, subtitle, poster }) => (
  <Link to={to} className="flex items-center gap-3.5 px-4 py-2.5 border-b border-white/10 active:bg-white/5">
    <MobilePoster path={poster} alt={title} />
    <div className="flex flex-col justify-center min-w-0">
      <p className="text-sm text-[#9ab] leading-snug">
        <span className="font-bold text-white text-[15px]">{title}</span>
        {year ? <span> {year}</span> : null}
        {subtitle ? <span>, {subtitle}</span> : null}
      </p>
    </div>
  </Link>
);

export const SearchPage: React.FC = () => {
  const { t } = useLanguage();
  const { reviews, lists } = useApp();
  const isMobile = useIsMobile();
  // Mobile: estado de foco do input (máquina de 3 estados: idle / focused / typing)
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  // Mobile: ?r=1 abre a tela de buscas recentes (sem os atalhos de tipo / Browse by)
  const isRecentView = searchParams.get('r') === '1';
  const rawFilter = searchParams.get('f') as SearchFilter | null;
  // Mobile: aba padrão é "Filmes" (não "Todos")
  const validFilterIds = isMobile ? MOBILE_FILTER_IDS : FILTERS.map((f) => f.id);
  const filter: SearchFilter =
    rawFilter && validFilterIds.includes(rawFilter) ? rawFilter : isMobile ? 'films' : 'all';

  const setFilter = (next: SearchFilter) => {
    const params: Record<string, string> = {};
    if (query.trim()) params.q = query;
    if (next !== 'all') params.f = next;
    setSearchParams(params, { replace: true });
  };

  const hasQueryMobile = query.trim().length > 0;
  const mobileMode: 'idle' | 'focused' | 'typing' = hasQueryMobile
    ? 'typing'
    : isSearchFocused
      ? 'focused'
      : 'idle';

  const [items, setItems] = useState<TMDBSearchResult[]>([]);
  const [people, setPeople] = useState<TMDBSearchPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Debounce do termo (a busca do header atualiza o ?q= a cada tecla)
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  const term = debouncedQuery.trim();

  // Cache por aba para manter os painéis vizinhos preenchidos durante o deslize no mobile
  const [panelCache, setPanelCache] = useState<
    Record<
      string,
      {
        term: string;
        items: TMDBSearchResult[];
        people: TMDBSearchPerson[];
        searched: boolean;
      }
    >
  >({});

  const prefetchFilter = (targetFilter: SearchFilter) => {
    if (!term) return;
    if (targetFilter === 'reviews' || targetFilter === 'lists' || targetFilter === 'members') return;
    if (panelCache[targetFilter]?.term === term) return;
    void (async () => {
      try {
        if (targetFilter === 'cast') {
          const res = await tmdb.searchPeople(term, 1);
          setPanelCache((c) =>
            c[targetFilter]?.term === term
              ? c
              : { ...c, [targetFilter]: { term, items: [], people: res.results, searched: true } },
          );
        } else {
          const res =
            targetFilter === 'films' || targetFilter === 'series'
              ? await tmdb.searchEnriched(term, targetFilter === 'films' ? 'movie' : 'tv', 1)
              : await tmdb.searchMultiEnriched(term, 1);
          setPanelCache((c) =>
            c[targetFilter]?.term === term
              ? c
              : { ...c, [targetFilter]: { term, items: res, people: [], searched: true } },
          );
        }
      } catch {
        /* ignore prefetch error */
      }
    })();
  };

  const mobileActiveIndex = Math.max(0, MOBILE_FILTER_IDS.indexOf(filter));
  const mobileLabelsKey = `${mobileMode}|${MOBILE_FILTERS.map((f) => t(f.labelKey)).join('|')}`;

  const mobileSwipe = useSwipeableTabs({
    count: MOBILE_FILTERS.length,
    activeIndex: mobileActiveIndex,
    onChangeIndex: (idx) => {
      const next = MOBILE_FILTER_IDS[idx];
      if (next) setFilter(next);
    },
    onPeekIndex: (neighborIdx) => {
      const neighbor = MOBILE_FILTER_IDS[neighborIdx];
      if (neighbor) prefetchFilter(neighbor);
    },
    labelsKey: mobileLabelsKey,
    centerActiveInBar: true,
    ready: isMobile && mobileMode !== 'idle',
  });

  // Histórico de buscas recentes (mobile): salvo no localStorage, máx. 15 itens
  // Guarda termo + categoria usada (a badge da linha mostra a categoria)
  const RECENT_KEY = 'recent_searches';
  type RecentItem = { q: string; f: SearchFilter };
  const [recent, setRecent] = useState<RecentItem[]>(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (x): x is RecentItem =>
            !!x && typeof (x as RecentItem).q === 'string' && typeof (x as RecentItem).f === 'string'
        )
        .slice(0, 15);
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (!term) return;
    setRecent((prev) => {
      const next = [
        { q: term, f: filter },
        ...prev.filter((x) => x.q.toLowerCase() !== term.toLowerCase()),
      ].slice(0, 15);
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* armazenamento indisponível: segue sem histórico */
      }
      return next;
    });
  }, [term]);
  const clearRecent = () => {
    setRecent([]);
    try {
      window.localStorage.removeItem(RECENT_KEY);
    } catch {
      /* noop */
    }
  };

  const labelKeyOf = (id: SearchFilter): TranslationKey =>
    FILTERS.find((f) => f.id === id)?.labelKey ?? 'search_filter_all';
  const isLocalFilter = filter === 'reviews' || filter === 'lists' || filter === 'members';

  const getLocalResultsFor = (targetFilter: SearchFilter) => {
    const q = term.toLowerCase();
    if (!q) return [];
    if (targetFilter === 'reviews') {
      return reviews
        .filter((r) => (r.movieTitle ?? '').toLowerCase().includes(q))
        .map((r) => ({
          key: `review-${r.id}`,
          title: r.movieTitle,
          subtitle: r.author?.displayName,
          poster: r.moviePoster,
          to: `/film/${r.movieId}`,
          year: r.movieYear,
        }));
    }
    if (targetFilter === 'lists') {
      return lists
        .filter(
          (l) =>
            l.title.toLowerCase().includes(q) || (l.description ?? '').toLowerCase().includes(q)
        )
        .map((l) => ({
          key: `list-${l.id}`,
          title: l.title,
          subtitle: `${l.movies.length} films`,
          poster: l.movies[0]?.poster_path ?? null,
          to: `/list/${l.id}`,
          year: '',
        }));
    }
    return [];
  };

  // Resultados locais (críticas e listas do próprio usuário)
  const localResults = useMemo(() => getLocalResultsFor(filter), [filter, term, reviews, lists]);

  const requestKey = `${term}|${filter}`;
  const keyRef = useRef('');

  useEffect(() => {
    const isNewKey = keyRef.current !== requestKey;
    keyRef.current = requestKey;

    // Termo/filtro mudou com página > 1: volta para a 1 e deixa o próximo
    // ciclo buscar (evita anexar resultados da página antiga a uma nova busca)
    if (isNewKey && page !== 1) {
      setPage(1);
      return;
    }
    if (!term || isLocalFilter) {
      setItems([]);
      setPeople([]);
      setHasMore(false);
      setSearched(Boolean(term));
      setLoading(false);
      return;
    }

    let cancelled = false;
    const reset = isNewKey || page === 1;
    setLoading(true);

    (async () => {
      try {
        if (filter === 'cast') {
          const res = await tmdb.searchPeople(term, page);
          if (cancelled) return;
          setPeople((prev) => {
            const next = reset ? res.results : [...prev, ...res.results];
            setPanelCache((c) => ({
              ...c,
              [filter]: { term, items: [], people: next, searched: true },
            }));
            return next;
          });
          if (reset) setItems([]);
          setHasMore(page < Math.min(res.total_pages || 1, 20));
        } else {
          const res =
            filter === 'films' || filter === 'series'
              ? await tmdb.searchEnriched(term, filter === 'films' ? 'movie' : 'tv', page)
              : await tmdb.searchMultiEnriched(term, page);
          if (cancelled) return;
          setItems((prev) => {
            const next = reset ? res : [...prev, ...res];
            setPanelCache((c) => ({
              ...c,
              [filter]: { term, items: next, people: [], searched: true },
            }));
            return next;
          });
          if (reset) setPeople([]);
          setHasMore(res.length > 0 && page < 20);
        }
        setSearched(true);
      } catch {
        if (cancelled) return;
        if (reset) {
          setItems([]);
          setPeople([]);
        }
        setHasMore(false);
        setSearched(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestKey, page, term, filter, isLocalFilter]);

  // Tipo escolhido nos botões Filmes/Séries (?t=movie|tv); vazio = todos
  const browseType = searchParams.get('t') === 'movie' || searchParams.get('t') === 'tv' ? searchParams.get('t')! : '';
  const withType = (path: string) => (browseType ? `${path}${path.includes('?') ? '&' : '?'}type=${browseType}` : path);
  const setBrowseType = (next: '' | 'movie' | 'tv') => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set('t', next);
    else params.delete('t');
    setSearchParams(params, { replace: true });
  };

  const browseRows: { label: string; to: string }[] = [
    { label: t('search_release_date'), to: withType('/browse/release-date') },
    { label: t('search_genre'), to: withType('/browse/genre') },
    { label: t('search_country'), to: withType('/browse/country') },
    { label: t('search_language'), to: withType('/browse/language') },
    { label: t('search_service'), to: withType('/browse/service') },
    { label: t('search_most_popular'), to: withType('/browse/results?sort=popularity.desc&title=Most%20Popular') },
    { label: t('search_highest_rated'), to: withType('/browse/results?sort=vote_average.desc&title=Highest%20Rated') },
    {
      label: t('search_most_anticipated'),
      to: withType('/browse/results?released=upcoming&sort=popularity.desc&title=Most%20Anticipated'),
    },
    { label: t('search_featured_lists'), to: '/lists' },
  ];

  const totalShown = filter === 'cast' ? people.length : isLocalFilter ? localResults.length : items.length;
  const emptyState = searched && !loading && totalShown === 0;

  /* ------------------------------------------------------------------------
   * MOBILE — máquina de 3 estados (réplica do app Letterboxd):
   *  idle    : pílula "Buscar..." + atalhos + lista FILTRAR POR
   *  focused : cabeçalho preto integrado às abas + BUSCAS RECENTES
   *  typing  : abas + resultados da aba ativa (esteira horizontal com puxar)
   * Desktop continua abaixo, sem alterações.
   * --------------------------------------------------------------------- */
  if (isMobile) {
    const mode = mobileMode;

    const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (value) n.set('q', value);
          else n.delete('q');
          return n;
        },
        { replace: true }
      );
    };

    // ← : limpa a query, sai do foco e volta para o Estado 1 (idle)
    // Remove só o termo (?q=), preservando a aba (?f=) e o tipo (?t=)
    const clearQueryParam = () =>
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete('q');
          return n;
        },
        { replace: true }
      );

    const handleBack = () => {
      clearQueryParam();
      setIsSearchFocused(false);
      inputRef.current?.blur();
    };

    // ✕ : limpa o texto mantendo o foco no input
    const handleClearText = () => {
      clearQueryParam();
      setIsSearchFocused(true);
      inputRef.current?.focus();
    };

    const renderMobileIdleBody = () => (
      <>
        <div className="flex gap-2 px-4 pt-5 pb-4">
          {([
            { id: 'movie', label: t('search_type_movie') },
            { id: 'tv', label: t('search_type_tv') },
          ] as const).map((opt) => {
            const active = browseType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBrowseType(active ? '' : opt.id)}
                aria-pressed={active}
                className={`flex-1 text-center py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  active ? 'bg-[#00e054] text-black' : 'bg-[#2c3440] text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <h2 className="uppercase text-xs font-semibold tracking-wider text-[#9ab] px-4 py-3 border-b border-white/5">
          {t('browse_by')}
        </h2>
        <nav className="flex flex-col">
          {browseRows.map((row) => (
            <Link
              key={row.label}
              to={row.to}
              className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 text-sm text-[#9ab] active:bg-white/5"
            >
              <span>{row.label}</span>
              <ChevronRight className="w-4 h-4 text-lb-muted" />
            </Link>
          ))}
        </nav>
      </>
    );

    const renderMobileFocusedBody = () => (
      <div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h2 className="uppercase text-xs font-semibold tracking-wider text-[#9ab]">
            {t('search_recent')}
          </h2>
          {recent.length > 0 && (
            <button
              type="button"
              onClick={clearRecent}
              className="text-[0.7rem] uppercase tracking-wider text-[#789] hover:text-white cursor-pointer"
            >
              {t('search_clear')}
            </button>
          )}
        </div>
        {recent.map((r) => (
          <button
            key={`${r.f}-${r.q}`}
            type="button"
            onClick={() => setSearchParams({ q: r.q, f: r.f }, { replace: true })}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-white/5 text-left active:bg-white/5 cursor-pointer"
          >
            <span className="text-sm text-[#9ab] truncate pr-3">{r.q}</span>
            <span className="shrink-0 bg-[#2c3440] text-[#9ab] text-xs px-3 py-1 rounded-full">
              {t(labelKeyOf(r.f))}
            </span>
          </button>
        ))}
      </div>
    );

    const renderMobileTabPanel = (panelFilter: SearchFilter) => {
      const isActivePanel = panelFilter === filter;
      const panelIsLocal =
        panelFilter === 'reviews' || panelFilter === 'lists' || panelFilter === 'members';
      const panelLocalRows = panelIsLocal ? getLocalResultsFor(panelFilter) : [];
      const cached =
        panelCache[panelFilter]?.term === term ? panelCache[panelFilter] : undefined;
      const panelItems = isActivePanel ? items : (cached?.items ?? []);
      const panelPeople = isActivePanel ? people : (cached?.people ?? []);
      const panelSearched = isActivePanel ? searched : Boolean(cached?.searched || panelIsLocal);
      const panelLoading = isActivePanel ? loading : (!panelIsLocal && !cached && Boolean(term));
      const panelTotal =
        panelFilter === 'cast'
          ? panelPeople.length
          : panelIsLocal
            ? panelLocalRows.length
            : panelItems.length;
      const panelEmpty = panelSearched && !panelLoading && panelTotal === 0;

      if (!term || panelLoading) {
        if (panelTotal === 0) {
          return <p className="text-sm text-[#789] px-4 py-8">{t('search_searching')}</p>;
        }
      }
      if (panelEmpty) {
        return (
          <p className="text-sm text-[#789] px-4 py-8">
            {t('search_no_results')} “{term}”.
          </p>
        );
      }
      return (
        <>
          {panelIsLocal &&
            panelLocalRows.map((row) => (
              <MobileLocalRow
                key={row.key}
                to={row.to}
                title={row.title}
                year={row.year}
                subtitle={row.subtitle}
                poster={row.poster}
              />
            ))}
          {!panelIsLocal &&
            panelFilter === 'cast' &&
            panelPeople.map((person) => <MobilePersonRow key={person.id} person={person} />)}
          {!panelIsLocal &&
            panelFilter !== 'cast' &&
            panelItems.map((item) => (
              <MobileMovieRow key={`${item.media_type}-${item.id}`} item={item} t={t} />
            ))}
          {isActivePanel && hasMore && (
            <div className="flex justify-center py-6">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="px-5 py-2 rounded-full bg-[#2c3440] hover:bg-[#3a4550] text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? t('search_searching') : t('search_load_more')}
              </button>
            </div>
          )}
        </>
      );
    };

    return (
      <div className="bg-[#14181c] flex-1 flex flex-col min-h-[calc(100dvh-60px)] overflow-x-clip">
        <header className={`sticky top-0 z-40 bg-black select-none${mode === 'idle' ? ' pt-3 pb-3' : ''}`}>
          <div
            onClick={mode === 'idle' ? () => inputRef.current?.focus() : undefined}
            className={
              mode === 'idle'
                ? 'mx-4 flex items-center gap-3 rounded-full bg-[#2c3440] px-4 py-2.5 cursor-text'
                : 'flex items-center gap-3 px-4 h-14'
            }
          >
            {mode === 'idle' ? (
              <Search className="w-5 h-5 text-[#9ab] shrink-0" aria-hidden="true" />
            ) : (
              <button
                type="button"
                onClick={handleBack}
                aria-label={t('btn_cancel')}
                className="shrink-0 text-white cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => setIsSearchFocused(true)}
              placeholder={t('search_placeholder')}
              spellCheck={false}
              autoComplete="off"
              className="no-focus-ring flex-1 min-w-0 bg-transparent text-base text-white placeholder-lb-muted focus:outline-none"
            />
            {mode !== 'idle' && query.length > 0 && (
              <button
                type="button"
                onClick={handleClearText}
                aria-label={t('search_clear')}
                className="shrink-0 text-[#9ab] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Abas de categoria (Estados 2 e 3) — padrão: Filmes */}
          {mode !== 'idle' && (
            <nav
              ref={mobileSwipe.tabsContainerRef}
              {...(mode === 'typing' ? mobileSwipe.barHandlers : {})}
              className="relative flex overflow-x-auto no-scrollbar border-b border-white/10 bg-black"
              aria-label={t('search_show_results_for')}
            >
              {MOBILE_FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    data-swipe-tab="true"
                    onClick={() => setFilter(f.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`shrink-0 whitespace-nowrap px-4 pt-8 pb-2.5 text-sm font-medium transition-colors cursor-pointer ${
                      active ? 'text-white' : 'text-[#9ab]'
                    }`}
                  >
                    {t(f.labelKey)}
                  </button>
                );
              })}
              {/* Barra verde elástica (mesma da Home) — desliza e acompanha o dedo */}
              <span ref={mobileSwipe.indicatorRef} className="tab-indicator" aria-hidden="true" />
            </nav>
          )}
        </header>

        {mode === 'idle' ? (
          <FadeIn key="idle">{renderMobileIdleBody()}</FadeIn>
        ) : mode === 'focused' ? (
          renderMobileFocusedBody()
        ) : (
          <div
            ref={mobileSwipe.viewportRef}
            {...mobileSwipe.viewportHandlers}
            className="tab-viewport"
          >
            <div
              ref={mobileSwipe.trackRef}
              {...mobileSwipe.trackHandlers}
              className="tab-slider-track"
              style={{ transform: `translateX(-${mobileSwipe.activeIndex * 100}%)` }}
            >
              {MOBILE_FILTERS.map((f, idx) => {
                const isActive = idx === mobileSwipe.activeIndex;
                const expanded = mobileSwipe.isPanelExpanded(idx);
                return (
                  <div
                    key={f.id}
                    data-tab={f.id}
                    className={`tab-panel${expanded ? '' : ' tab-panel-collapsed'}`}
                    aria-hidden={!isActive}
                    inert={!isActive}
                  >
                    {mobileSwipe.isPanelMounted(idx) ? renderMobileTabPanel(f.id) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[980px] mx-auto mt-6 md:mt-10 mb-24 md:mb-10 px-5">
      {/* Sem termo: estado padrão com o BROWSE BY (mantém o comportamento antigo) */}
      {!term ? (
        <div className="max-w-[950px]">
          {/* Atalhos de tipo + BROWSE BY (mobile: só na tela inicial, não nas recentes) */}
          <div className={isRecentView ? 'hidden md:block' : ''}>
          {/* Atalhos: ver só filmes ou só séries */}
          <div className="flex gap-2 mb-6">
            {([
              { id: 'movie', label: t('search_type_movie') },
              { id: 'tv', label: t('search_type_tv') },
            ] as const).map((opt) => {
              const active = browseType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBrowseType(active ? '' : opt.id)}
                  aria-pressed={active}
                  className={`flex-1 text-center py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    active ? 'bg-[#00e054] text-black' : 'bg-[#2c3440] hover:bg-[#3a4550] text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <h2 className="text-xs uppercase tracking-widest text-lb-muted font-bold mb-1">
            {t('browse_by')}
          </h2>
          <p className="text-[13px] text-lb-muted mb-3">{t('search_empty_hint')}</p>
          <nav className="flex flex-col">
            {browseRows.map((row) => (
              <Link
                key={row.label}
                to={row.to}
                className="flex items-center justify-between py-3.5 border-b border-white/5 text-sm text-white hover:text-[#00e054] transition-colors"
              >
                <span>{row.label}</span>
                <ChevronRight className="w-4 h-4 text-lb-muted" />
              </Link>
            ))}
          </nav>
          </div>

          {/* Mobile: buscas recentes ABAIXO da lista de Filtrar por (como no app) */}
          <div className={isRecentView ? 'md:hidden mt-2' : 'hidden'}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="uppercase text-[0.78rem] tracking-[0.08em] text-[#9ab]">
                {t('search_recent')}
              </h2>
              {recent.length > 0 && (
                <button
                  type="button"
                  onClick={clearRecent}
                  className="text-[0.72rem] uppercase tracking-wider text-[#789] hover:text-white cursor-pointer"
                >
                  {t('search_clear')}
                </button>
              )}
            </div>
            {recent.length > 0 && (
              <ul>
                {recent.map((r) => (
                  <li key={`${r.f}-${r.q}`} className="border-b border-[#2c3440]">
                    <button
                      type="button"
                      onClick={() => setSearchParams({ q: r.q, ...(filter !== 'all' ? { f: filter } : {}) }, { replace: true })}
                      className="w-full flex items-center justify-between py-4 text-left text-[#9ab] hover:text-white cursor-pointer"
                    >
                      <span className="text-[0.98rem] truncate pr-3">{r.q}</span>
                      <span className="shrink-0 text-[0.7rem] font-bold uppercase bg-[#456] text-white px-3 py-1 rounded-full">
                        {t(labelKeyOf(r.f))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:grid md:grid-cols-[1fr_240px] md:gap-12 md:items-start">
          {/* SIDEBAR — SHOW RESULTS FOR (mobile: chips roláveis acima da lista) */}
          <aside className="order-1 md:order-2 mb-4 md:mb-0 -mx-5 md:mx-0">
            <div className="hidden md:block">
              <SectionTitle>{t('search_show_results_for')}</SectionTitle>
            </div>
            <nav
              className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar md:overflow-visible bg-black md:bg-transparent md:py-1 px-1 md:px-0"
              aria-label={t('search_show_results_for')}
            >
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`shrink-0 md:shrink text-left whitespace-nowrap transition-colors cursor-pointer px-4 pt-4 pb-3 md:pt-[6px] md:pb-[6px] md:px-3 text-[0.95rem] md:text-sm border-b-2 md:border-b-0 md:rounded-[3px] ${
                      active
                        ? 'border-[#00e054] text-white font-semibold md:bg-[#2c3440] md:py-[7px]'
                        : 'border-transparent text-[#9ab] hover:text-white'
                    }`}
                  >
                    {t(f.labelKey)}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* COLUNA ESQUERDA — resultados */}
          <div className="order-2 md:order-1 min-w-0">
            <div className="hidden md:block">
              <SectionTitle>
                {t('search_showing_matches')} “{term}”
              </SectionTitle>
            </div>

            {loading && totalShown === 0 ? (
              <p className="text-sm text-[#789] py-8">{t('search_searching')}</p>
            ) : emptyState ? (
              <p className="text-sm text-[#789] py-8">
                {t('search_no_results')} “{term}”.
              </p>
            ) : isLocalFilter ? (
              <div>
                {localResults.map((row) => (
                  <Link
                    key={row.key}
                    to={row.to}
                    className="flex gap-[18px] py-[18px] border-b border-[#2c3440] items-start group"
                  >
                    <div className="w-[70px] h-[105px] shrink-0 rounded-[4px] overflow-hidden border border-white/12 bg-[#1c2228]">
                      {row.poster ? (
                        <img
                          src={tmdb.getImageUrl(row.poster, 'w185')}
                          alt={row.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full border border-[#2c3440]" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[1.25rem] font-bold text-white leading-tight group-hover:text-lb-green transition-colors">
                          {row.title}
                        </span>
                        {row.year && <span className="text-base text-[#789]">{row.year}</span>}
                      </div>
                      {row.subtitle && (
                        <p className="mt-1.5 text-[0.78rem] text-[#678]">{row.subtitle}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : filter === 'cast' ? (
              <div>
                {people.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </div>
            ) : (
              <div>
                {items.map((item) => (
                  <ResultRow key={`${item.media_type}-${item.id}`} item={item} t={t} />
                ))}
              </div>
            )}

            {/* Paginação */}
            {hasMore && !emptyState && (
              <div className="flex justify-center py-6">
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                  className="px-5 py-2 rounded-full bg-[#2c3440] hover:bg-[#3a4550] text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? t('search_searching') : t('search_load_more')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
