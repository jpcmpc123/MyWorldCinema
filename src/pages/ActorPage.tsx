import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  LayoutGrid,
  List,
  Loader2,
  Share2,
  SlidersHorizontal,
} from 'lucide-react';
import { tmdb, type TMDBPersonDetails, type TMDBPersonMovieCredit } from '../services/tmdb';
import { PosterCard } from '../components/PosterCard';
import { PosterLightbox } from '../components/PosterLightbox';
import { useApp } from '../context/AppContext';
import { useLanguage, type TranslationKey } from '../i18n/LanguageContext';
import {
  PERSON_ROLE_ORDER,
  isPersonRole,
  matchesPersonGenreFilter,
  personRoleFromDepartment,
  personRoleFromJob,
  type PersonRole,
} from '../utils/personNav';
import { ActorTabPanel, INITIAL_VISIBLE } from '../components/ActorTabPanel';
import { FiltersModal, type FiltersDraft } from '../components/mobile/FiltersModal';
import { useIsMobile } from '../hooks/useIsMobile';
import { useSwipeableTabs } from '../hooks/useSwipeableTabs';

// ---------------------------------------------------------------------------
// PERFIL DE PESSOA (/actor/:id) — Ator / Diretor / Roteirista / Equipe
//
// MOBILE (< 768px): layout do app Letterboxd — Top App Bar preta com ←,
// nome da pessoa, ícones de visualização/filtro/compartilhar, barra de abas
// horizontais por função (Bio, Actor, Producer, Writer, Director, …) e grade
// de 4 colunas. A barra global "MyWorld" fica oculta nessa rota (Header.tsx).
//
// DESKTOP (>= 768px): layout MyWorld original (breadcrumb + filtros + grade
// densa + sidebar com foto/biografia), apenas com a barra de abas por função
// adicionada no topo — nada do desktop é removido.
// ---------------------------------------------------------------------------

type SortKey = 'popularity' | 'rating' | 'newest' | 'oldest';
type TabKey = 'Bio' | PersonRole;

const SORT_OPTIONS: { value: SortKey; label: TranslationKey }[] = [
  { value: 'popularity', label: 'person_sort_popularity' },
  { value: 'rating', label: 'person_sort_rating' },
  { value: 'newest', label: 'person_sort_newest' },
  { value: 'oldest', label: 'person_sort_oldest' },
];

const ROLE_LABEL_KEY: Record<PersonRole, TranslationKey> = {
  Actor: 'person_tab_actor',
  Creator: 'person_tab_creator',
  Producer: 'person_tab_producer',
  Writer: 'person_tab_writer',
  Director: 'person_tab_director',
  'Executive Producer': 'person_tab_exec_producer',
  Composer: 'person_tab_composer',
  Cinematography: 'person_tab_cinematography',
  Editor: 'person_tab_editor',
};

const ROLE_CRUMB_KEY: Record<PersonRole, TranslationKey> = {
  Actor: 'person_films_starring',
  Creator: 'person_series_created',
  Producer: 'person_films_produced',
  Writer: 'person_films_written',
  Director: 'person_films_directed',
  'Executive Producer': 'person_films_exec_produced',
  Composer: 'person_films_scored',
  Cinematography: 'person_films_shot',
  Editor: 'person_films_edited',
};

export function ActorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t, language } = useLanguage();
  const { isMovieWatched } = useApp();
  const isMobile = useIsMobile();

  const [person, setPerson] = useState<TMDBPersonDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('Bio');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('popularity');
  const [genreFilter, setGenreFilter] = useState<number | null>(null);
  const [decadeFilter, setDecadeFilter] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<number | null>(null);
  const [serviceMatchedKeys, setServiceMatchedKeys] = useState<Set<string> | null>(null);
  const [watchedMode, setWatchedMode] = useState<'all' | 'watched' | 'unwatched'>('all');
  const [fadeWatched, setFadeWatched] = useState<boolean>(true);
  const [openDropdown, setOpenDropdown] = useState<
    'role' | 'decade' | 'genre' | 'service' | 'sort' | 'watched' | null
  >(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAllFilms, setShowAllFilms] = useState(false);
  const [showPhotoLightbox, setShowPhotoLightbox] = useState(false);

  const filterBarRef = useRef<HTMLDivElement | null>(null);

  // Controla quando a aba inicial do cargo já foi decidida para liberar a animação
  const [roleReady, setRoleReady] = useState(false);

  // Fecha menus suspensos do desktop ao clicar fora ou apertar Escape
  useEffect(() => {
    if (!openDropdown) return;
    const onMouseDown = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openDropdown]);

  // ---- Cargo pedido por quem clicou (router state → ?role= → departamento) --
  const requestedRole = useMemo<PersonRole | null>(() => {
    const fromState = (location.state as { initialRole?: unknown } | null)?.initialRole;
    if (isPersonRole(fromState)) return fromState;
    const fromQuery = searchParams.get('role');
    if (isPersonRole(fromQuery)) return fromQuery;
    return null;
  }, [location.state, searchParams]);

  // ---- Fetch: pessoa + filmografia em UMA chamada --------------------------
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPerson(null);
    setBioExpanded(false);
    setFiltersOpen(false);
    setShowAllFilms(false);
    setShowPhotoLightbox(false);
    setDecadeFilter(null);
    setGenreFilter(null);
    setServiceFilter(null);
    setServiceMatchedKeys(null);
    setWatchedMode('all');
    setOpenDropdown(null);
    // Nova pessoa = aguarda a definição da aba inicial antes de animar
    setRoleReady(false);
    initedForRef.current = null;

    (async () => {
      try {
        const data = await tmdb.getPersonDetails(Number(id));
        if (cancelled) return;
        setPerson(data);
      } catch {
        if (!cancelled) setError(t('person_load_error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, t]);

  // ---- Actor: FILMES + SÉRIES juntos (movie_credits.cast + tv_credits.cast)
  const castFilms = useMemo(() => {
    const seen = new Set<string>();
    const combined = [
      ...(person?.movie_credits?.cast ?? []),
      ...(person?.tv_credits?.cast ?? []),
    ];
    return combined
      .filter((m) => {
        const key = `${m.media_type ?? 'movie'}:${m.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.popularity - a.popularity);
  }, [person]);

  // ---- Equipe: agrupada por job (nunca misturada com atuação) --------------
  // FILMES e SÉRIES entram na MESMA lista de cada cargo.
  const crewByRole = useMemo(() => {
    const lists = new Map<PersonRole, TMDBPersonMovieCredit[]>();
    const seen = new Map<PersonRole, Set<string>>();
    const crew = [...(person?.movie_credits?.crew ?? []), ...(person?.tv_credits?.crew ?? [])];
    for (const credit of crew) {
      const role = personRoleFromJob(credit.job);
      if (!role) continue;
      let ids = seen.get(role);
      if (!ids) {
        ids = new Set<string>();
        seen.set(role, ids);
      }
      const key = `${credit.media_type ?? 'movie'}:${credit.id}`;
      if (ids.has(key)) continue; // mesmo título, jobs equivalentes
      ids.add(key);
      const list = lists.get(role) ?? [];
      list.push(credit);
      lists.set(role, list);
    }
    lists.forEach((list) => list.sort((a, b) => b.popularity - a.popularity));
    return lists;
  }, [person]);

  // ---- Abas dinâmicas: apenas as funções que têm conteúdo ------------------
  const tabs = useMemo(() => {
    const out: {
      key: TabKey;
      label: string;
      items: TMDBPersonMovieCredit[];
      crumb: TranslationKey | null;
    }[] = [{ key: 'Bio', label: t('person_tab_bio'), items: [], crumb: null }];

    if (castFilms.length > 0) {
      out.push({
        key: 'Actor',
        label: t(ROLE_LABEL_KEY.Actor),
        items: castFilms,
        crumb: ROLE_CRUMB_KEY.Actor,
      });
    }
    for (const role of PERSON_ROLE_ORDER) {
      if (role === 'Actor') continue;
      const items = crewByRole.get(role) ?? [];
      if (items.length === 0) continue;
      out.push({ key: role, label: t(ROLE_LABEL_KEY[role]), items, crumb: ROLE_CRUMB_KEY[role] });
    }
    return out;
  }, [castFilms, crewByRole, t]);

  // Chave estável dos rótulos: trocar idioma / conjunto de abas muda a largura
  // dos botões e exige nova medição (sem estirar).
  const tabLabelsKey = tabs.map((tab) => tab.label).join('|');

  // ---- Abertura CONTEXTUAL: cai na aba do cargo clicado sem deslizar de Bio
  const initedForRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!person) return;
    if (!person.movie_credits && !person.tv_credits) return;
    if (initedForRef.current === person.id) return;
    initedForRef.current = person.id;
    const preferred = requestedRole ?? personRoleFromDepartment(person.known_for_department);
    const match = tabs.find((tab) => tab.key === preferred);
    const firstFilmTab = tabs.find((tab) => tab.key !== 'Bio');
    const initialKey = match ? match.key : (firstFilmTab?.key ?? 'Bio');
    setActiveTab(initialKey);
    setRoleReady(true);
  }, [person, tabs, requestedRole]);

  const roleTabs = useMemo(() => tabs.filter((tab) => tab.key !== 'Bio'), [tabs]);

  const activeTabDef = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const desktopActiveTabDef =
    (activeTab !== 'Bio' ? tabs.find((tab) => tab.key === activeTab) : null) ??
    roleTabs[0] ??
    tabs[0];
  const tabItems = isMobile ? (activeTabDef?.items ?? []) : (desktopActiveTabDef?.items ?? []);

  // ---- Filtro por Serviço de Streaming (desktop) ---------------------------
  useEffect(() => {
    if (isMobile || !person || !serviceFilter) {
      setServiceMatchedKeys(null);
      return;
    }
    let cancelled = false;
    tmdb.getPersonProviderMediaKeys(person.id, serviceFilter, tabItems).then((keys) => {
      if (!cancelled) setServiceMatchedKeys(keys);
    });
    return () => {
      cancelled = true;
    };
  }, [isMobile, person, serviceFilter, tabItems]);

  // ---- Lista completa de décadas do menu DECADE (2020s até 1850s) ----------
  const DECADE_MENU_LIST = useMemo(
    () => [
      '2020s',
      '2010s',
      '2000s',
      '1990s',
      '1980s',
      '1970s',
      '1960s',
      '1950s',
      '1940s',
      '1930s',
      '1920s',
      '1910s',
      '1900s',
      '1890s',
      '1880s',
      '1870s',
      '1860s',
      '1850s',
    ],
    [],
  );

  // ---- Filtros (modal de filtros, igual às abas de pesquisa) ----------------
  const applyFilters = (draft: FiltersDraft) => {
    const sort = draft.sort ?? '';
    setSortBy(
      sort === 'vote_average.desc'
        ? 'rating'
        : sort === 'primary_release_date.desc'
          ? 'newest'
          : sort === 'primary_release_date.asc'
            ? 'oldest'
            : 'popularity',
    );
    const genre = draft.genre ? Number(draft.genre) : null;
    setGenreFilter(genre && !Number.isNaN(genre) ? genre : null);
    const decade = draft.decade || (draft.year && draft.year.length === 4 ? `${draft.year.slice(0, 3)}0s` : '');
    setDecadeFilter(decade || null);
    setFiltersOpen(false);
  };

  const filtersInitial = useMemo<FiltersDraft>(() => {
    const d: FiltersDraft = {};
    if (sortBy === 'rating') d.sort = 'vote_average.desc';
    else if (sortBy === 'newest') d.sort = 'primary_release_date.desc';
    else if (sortBy === 'oldest') d.sort = 'primary_release_date.asc';
    if (genreFilter) d.genre = String(genreFilter);
    if (decadeFilter) d.decade = decadeFilter;
    return d;
  }, [sortBy, genreFilter, decadeFilter]);

  const visibleFilms = useMemo(() => {
    let list = tabItems;
    if (genreFilter) list = list.filter((f) => matchesPersonGenreFilter(f.genre_ids, genreFilter));
    if (decadeFilter === 'upcoming') {
      const todayIso = new Date().toISOString().slice(0, 10);
      list = list.filter((f) => !f.release_date || f.release_date > todayIso);
    } else if (decadeFilter) {
      list = list.filter((f) => f.release_date?.startsWith(decadeFilter.slice(0, 3)));
    }
    if (!isMobile && serviceFilter && serviceMatchedKeys) {
      list = list.filter((f) => serviceMatchedKeys.has(`${f.media_type ?? 'movie'}:${f.id}`));
    }
    if (!isMobile && watchedMode === 'watched') {
      list = list.filter((f) => isMovieWatched(f.id));
    } else if (!isMobile && watchedMode === 'unwatched') {
      list = list.filter((f) => !isMovieWatched(f.id));
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'rating') return b.vote_average - a.vote_average;
      if (sortBy === 'newest') return (b.release_date || '').localeCompare(a.release_date || '');
      if (sortBy === 'oldest') return (a.release_date || '').localeCompare(b.release_date || '');
      return b.popularity - a.popularity;
    });
    return sorted;
  }, [
    tabItems,
    genreFilter,
    decadeFilter,
    isMobile,
    serviceFilter,
    serviceMatchedKeys,
    watchedMode,
    isMovieWatched,
    sortBy,
  ]);

  const listed = showAllFilms ? visibleFilms : visibleFilms.slice(0, INITIAL_VISIBLE);

  const selectTab = (key: TabKey) => {
    setActiveTab(key);
    setShowAllFilms(false);
    setFiltersOpen(false);
    setDecadeFilter(null);
    setGenreFilter(null);
    setServiceFilter(null);
    setOpenDropdown(null);
    if (isMobile) window.scrollTo({ top: 0 });
  };

  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.key === activeTab));

  const mobileSwipe = useSwipeableTabs({
    count: tabs.length,
    activeIndex,
    onChangeIndex: (idx) => {
      const next = tabs[idx];
      if (next) selectTab(next.key);
    },
    labelsKey: `${person?.id ?? ''}|${tabLabelsKey}`,
    centerActiveInBar: true,
    ready: isMobile && roleReady,
    scrollToTopOnChange: true,
  });

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      throw new Error('no-share');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* noop */
      }
    }
  };

  // ---- Estados de carregamento / erro (com barra nativa no mobile) --------
  if (loading) {
    if (!isMobile) {
      return <div className="min-h-screen bg-[#14181c]" />;
    }
    return (
      <div className="min-h-screen bg-[#14181c]">
        <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 px-4 bg-black flex items-center">
          <button onClick={() => navigate(-1)} aria-label={t('common_back')} className="text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="md:hidden h-14 shrink-0" aria-hidden="true" />
        <div className="flex items-center justify-center py-40">
          <Loader2 className="w-8 h-8 animate-spin text-lb-green" />
        </div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="min-h-screen bg-[#14181c]">
        <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 px-4 bg-black flex items-center">
          <button onClick={() => navigate(-1)} aria-label={t('common_back')} className="text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="md:hidden h-14 shrink-0" aria-hidden="true" />
        <div className="max-w-[950px] mx-auto px-4 py-20 text-center space-y-2">
          <p className="text-white font-semibold">{error || t('person_not_found')}</p>
          <p className="text-xs text-lb-muted">{t('person_bio_empty')}</p>
        </div>
      </div>
    );
  }

  const desktopCrumb = desktopActiveTabDef?.crumb
    ? t(desktopActiveTabDef.crumb)
    : t('person_films_starring');
  const profileImg = person.profile_path
    ? tmdb.getProfileUrl(person.profile_path, 'h632')
    : null;
  const profileImgLarge = person.profile_path
    ? tmdb.getProfileUrl(person.profile_path, 'original')
    : null;
  const profileImgSrcSet = person.profile_path
    ? `${tmdb.getProfileUrl(person.profile_path, 'w185')} 185w, ${tmdb.getProfileUrl(person.profile_path, 'h632')} 632w, ${tmdb.getProfileUrl(person.profile_path, 'original')} 1280w`
    : undefined;

  const photoLightbox = (
    <PosterLightbox
      open={showPhotoLightbox}
      src={profileImgLarge || profileImg || ''}
      srcSet={profileImgSrcSet}
      alt={person.name}
      onClose={() => setShowPhotoLightbox(false)}
    />
  );

  const showMoreButton =
    visibleFilms.length > INITIAL_VISIBLE && !showAllFilms ? (
      <div className="pt-5 pb-8">
        <button
          onClick={() => setShowAllFilms(true)}
          className="w-full py-2.5 rounded border border-white/10 bg-[#1c2228] hover:bg-[#242c34] text-[11px] font-bold uppercase tracking-wider text-[#9ab] hover:text-white transition-colors cursor-pointer"
        >
          {t('show_more')} ({visibleFilms.length})
        </button>
      </div>
    ) : null;

  // =========================================================================
  // MOBILE — Top App Bar + abas horizontais + grade de 4 colunas
  // =========================================================================
  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#14181c] text-lb-text flex flex-col">
        <div className="fixed top-0 inset-x-0 z-40 bg-black">
          {/* Top App Bar: 56px, preta, ← + nome + (visualização | filtro | share) */}
          <div className="h-14 px-4 flex items-center justify-between gap-3">
            <div className="flex items-center min-w-0">
              <button
                onClick={() => navigate(-1)}
                aria-label={t('common_back')}
                className="shrink-0 text-white active:scale-95 transition-transform"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="ml-4 text-[1.25rem] font-bold text-white truncate">
                {person.name}
              </h1>
            </div>
            <div className="flex items-center gap-5 shrink-0 text-white">
              {/* Na aba Bio só o compartilhar aparece */}
              {activeTab !== 'Bio' && (
                <>
                  <button
                    onClick={() => setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))}
                    aria-label={t('person_view_mode')}
                    className="active:scale-95 transition-transform"
                  >
                    {viewMode === 'grid' ? (
                      <LayoutGrid className="w-5 h-5" />
                    ) : (
                      <List className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-label={t('person_filters')}
                    className={`active:scale-95 transition-transform ${
                      filtersOpen ? 'text-[#00e054]' : ''
                    }`}
                  >
                    <SlidersHorizontal className="w-5 h-5" />
                  </button>
                </>
              )}
              <button
                onClick={handleShare}
                aria-label={t('person_share')}
                className="active:scale-95 transition-transform"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Barra de abas horizontal (scroll suave, sem scrollbar visível) */}
          <div
            ref={mobileSwipe.tabsContainerRef as React.RefObject<HTMLDivElement>}
            {...mobileSwipe.barHandlers}
            className="person-tabs-container"
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                data-swipe-tab="true"
                onClick={() => selectTab(tab.key)}
                className={`person-tab${activeTab === tab.key ? ' active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
            {/* Barra verde deslizante (posição/largura via JS + acompanha puxar) */}
            <span ref={mobileSwipe.indicatorRef} className="tab-indicator" aria-hidden="true" />
          </div>

          {/* Filtros (funil) — modal de tela cheia, igual às abas de pesquisa */}
          {activeTab !== 'Bio' && (
            <FiltersModal
              open={filtersOpen}
              initial={filtersInitial}
              onClose={() => setFiltersOpen(false)}
              onApply={applyFilters}
            />
          )}
        </div>
        <div className="h-[105px] shrink-0" aria-hidden="true" />

        {/* Conteúdo das abas: ESTEIRA HORIZONTAL (desliza lateralmente ao trocar
            de aba ou puxar com o dedo, igual à Home). */}
        <div
          ref={mobileSwipe.viewportRef}
          {...mobileSwipe.viewportHandlers}
          className="actor-tab-viewport"
        >
          <div
            ref={mobileSwipe.trackRef}
            {...mobileSwipe.trackHandlers}
            className="actor-tab-slider-track"
            style={{
              transform: `translateX(-${activeIndex * 100}%)`,
              // 1º posicionamento (abertura direta em ?role=…): sem deslizar
              transition: roleReady ? undefined : 'none',
            }}
          >
            {tabs.map((tab, idx) => {
              const isActive = tab.key === activeTab;
              const expanded = isActive || mobileSwipe.isPanelExpanded(idx);
              const mounted = roleReady && (isActive || mobileSwipe.isPanelMounted(idx));
              return (
                <div
                  key={tab.key}
                  data-tab={tab.key}
                  className={`actor-tab-panel${expanded ? '' : ' actor-tab-panel-collapsed'}`}
                  aria-hidden={!isActive}
                  inert={!isActive}
                >
                  {mounted ? (
                    <ActorTabPanel
                      tabKey={tab.key}
                      items={tab.items}
                      personId={person.id}
                      personName={person.name}
                      personProfilePath={person.profile_path}
                      biography={person.biography}
                      profileImg={profileImg}
                      onOpenPhoto={() => setShowPhotoLightbox(true)}
                      decadeFilter={decadeFilter}
                      genreFilter={genreFilter}
                      sortBy={sortBy}
                      viewMode={viewMode}
                      showAllFilms={showAllFilms}
                      onShowMore={() => setShowAllFilms(true)}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {photoLightbox}
      </div>
    );
  }

  // =========================================================================
  // DESKTOP (>= 768px) — Layout fiel ao Letterboxd Desktop (Imagens 2 e 3)
  // =========================================================================
  const selectedGenreName = genreFilter
    ? tmdb.genres.find((g) => g.id === genreFilter)?.name ?? null
    : null;
  const selectedServiceName = serviceFilter
    ? tmdb.streamingServices.find((s) => s.id === serviceFilter)?.name ?? null
    : null;
  const currentSortLabelKey =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'person_sort_popularity';

  const rawBio = (person.biography || '').trim();
  const BIO_CHAR_LIMIT = 235;
  const isBioLong = rawBio.length > BIO_CHAR_LIMIT;
  const collapsedBioText = (() => {
    if (!isBioLong) return rawBio;
    const sliced = rawBio.slice(0, BIO_CHAR_LIMIT);
    const lastSpace = sliced.lastIndexOf(' ');
    return `${(lastSpace > 160 ? sliced.slice(0, lastSpace) : sliced).replace(/[.,;:\s]+$/, '')}…`;
  })();

  const wikipediaHref =
    person.wikipedia_url ||
    `https://${language === 'pt-BR' ? 'pt' : 'en'}.wikipedia.org/wiki/${encodeURIComponent(
      person.name.trim().replace(/\s+/g, '_'),
    )}`;
  const tmdbPersonHref = `https://www.themoviedb.org/person/${person.id}`;

  return (
    <div className="max-w-[950px] mx-auto px-4 md:px-0 py-8 text-[#99aabb]">
      {/* Cabeçalho superior: Kicker ("FILMS STARRING") + Nome da Pessoa */}
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.12em] text-[#899aa9] font-normal mb-0.5">
          {desktopCrumb}
        </div>
        <h1 className="text-[26px] md:text-[28px] font-bold text-white leading-tight tracking-[-0.01em]">
          {person.name}
        </h1>
      </div>

      {/* Barra de filtros com linha divisória de ponta a ponta (950px) e controles alinhados à grade de 670px */}
      <div ref={filterBarRef} className="border-b border-[#2c3440] mb-4 select-none">
        <div className="w-full md:w-[670px] flex flex-wrap items-center justify-between gap-2 pb-2">
          {/* Esquerda: Seletor de Cargo (ex.: ACTOR ⌄ -> Actor 70, Executive Producer) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown((d) => (d === 'role' ? null : 'role'))}
              className="flex items-center gap-1 text-[11px] uppercase tracking-[0.075em] text-[#899aa9] hover:text-white transition-colors cursor-pointer"
            >
              <span>{desktopActiveTabDef?.label ?? t('person_tab_actor')}</span>
              <ChevronDown className="w-3 h-3 stroke-[2.2]" />
            </button>

            {openDropdown === 'role' && (
              <div className="absolute -left-3 -top-1.5 min-w-[148px] bg-[#899aa9] text-[#1f272e] rounded-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.6)] py-1.5 z-40 text-[12px]">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(null)}
                  className="w-full text-left px-3 py-1 flex items-center gap-1 text-[11px] uppercase tracking-[0.075em] font-semibold text-white border-b border-white/15 mb-1 cursor-pointer"
                >
                  <span>{desktopActiveTabDef?.label ?? t('person_tab_actor')}</span>
                  <ChevronDown className="w-3 h-3 stroke-[2.2]" />
                </button>
                {(roleTabs.length > 0 ? roleTabs : [desktopActiveTabDef]).map((rTab) => {
                  if (!rTab) return null;
                  const isSelected = rTab.key === desktopActiveTabDef?.key;
                  return (
                    <button
                      key={rTab.key}
                      type="button"
                      onClick={() => selectTab(rTab.key)}
                      className={`w-full text-left px-3 py-1 flex items-center justify-between gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? 'text-white font-semibold'
                          : 'text-[#1f272e] hover:bg-[#677786] hover:text-white'
                      }`}
                    >
                      <span>
                        {rTab.label}
                        {isSelected && (
                          <span className="ml-1.5 text-[11px] font-normal text-white/75 tabular-nums">
                            {rTab.items.length}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Direita: DECADE ⌄ | GENRE ⌄ | SERVICE ⌄ | Sort by POPULARITY ⌄ | 👁 ⌄ */}
          <div className="flex flex-wrap items-center gap-4">
            {/* DECADE */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((d) => (d === 'decade' ? null : 'decade'))}
                className={`flex items-center gap-1 text-[11px] uppercase tracking-[0.075em] transition-colors cursor-pointer ${
                  decadeFilter ? 'text-white font-semibold' : 'text-[#778899] hover:text-white'
                }`}
              >
                <span>
                  {decadeFilter === 'upcoming'
                    ? language === 'pt-BR'
                      ? 'EM BREVE'
                      : 'UPCOMING'
                    : (decadeFilter ?? t('cat_decade_upper'))}
                </span>
                <ChevronDown className="w-3 h-3 stroke-[2.2]" />
              </button>

              {openDropdown === 'decade' && (
                <div className="absolute -left-3 -top-1.5 min-w-[114px] bg-[#899aa9] text-[#2c3440] rounded-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.6)] overflow-hidden z-40 text-[12.5px]">
                  {/* Cabeçalho interno DECADE ⌄ */}
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(null)}
                    className="w-full text-left px-3 py-1.5 flex items-center gap-1 text-[11px] uppercase tracking-[0.075em] font-semibold text-white bg-[#788896] border-b border-[#657585] cursor-pointer"
                  >
                    <span>{t('cat_decade_upper')}</span>
                    <ChevronDown className="w-3 h-3 stroke-[2.2]" />
                  </button>

                  {/* Any decade */}
                  <div className="border-b border-[#6c7d8c]">
                    <button
                      type="button"
                      onClick={() => {
                        setDecadeFilter(null);
                        setShowAllFilms(false);
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-3 py-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                        !decadeFilter
                          ? 'text-white'
                          : 'text-[#2c3440] hover:bg-[#677786] hover:text-white'
                      }`}
                    >
                      {language === 'pt-BR' ? 'Qualquer década' : 'Any decade'}
                    </button>
                  </div>

                  {/* Upcoming + 2020s até 1850s */}
                  <div className="py-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDecadeFilter('upcoming');
                        setShowAllFilms(false);
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-3 py-[3px] leading-snug transition-colors cursor-pointer whitespace-nowrap ${
                        decadeFilter === 'upcoming'
                          ? 'text-white font-medium'
                          : 'text-[#2c3440] hover:bg-[#677786] hover:text-white'
                      }`}
                    >
                      {language === 'pt-BR' ? 'Em breve' : 'Upcoming'}
                    </button>
                    {DECADE_MENU_LIST.map((dec) => {
                      const isSelected = decadeFilter === dec;
                      return (
                        <button
                          key={dec}
                          type="button"
                          onClick={() => {
                            setDecadeFilter(dec);
                            setShowAllFilms(false);
                            setOpenDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-[3px] leading-snug transition-colors cursor-pointer tabular-nums ${
                            isSelected
                              ? 'text-white font-medium'
                              : 'text-[#2c3440] hover:bg-[#677786] hover:text-white'
                          }`}
                        >
                          {dec}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* GENRE */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((d) => (d === 'genre' ? null : 'genre'))}
                className={`flex items-center gap-1 text-[11px] uppercase tracking-[0.075em] transition-colors cursor-pointer ${
                  genreFilter ? 'text-white font-semibold' : 'text-[#778899] hover:text-white'
                }`}
              >
                <span>{selectedGenreName ?? t('cat_genre_upper')}</span>
                <ChevronDown className="w-3 h-3 stroke-[2.2]" />
              </button>

              {openDropdown === 'genre' && (
                <div className="absolute right-0 top-full mt-2 w-44 max-h-72 overflow-y-auto bg-[#899aa9] text-[#1f272e] rounded-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.55)] py-1.5 z-40 text-[12px]">
                  <button
                    type="button"
                    onClick={() => {
                      setGenreFilter(null);
                      setShowAllFilms(false);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-3.5 py-1 flex items-center justify-between hover:bg-[#677786] hover:text-white transition-colors cursor-pointer ${
                      !genreFilter ? 'font-bold text-white bg-[#677786]/70' : ''
                    }`}
                  >
                    <span>{t('person_all_genres')}</span>
                    {!genreFilter && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div className="border-t border-[#738494] my-1" />
                  {tmdb.genres.map((g) => {
                    const isSelected = genreFilter === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setGenreFilter(g.id);
                          setShowAllFilms(false);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-3.5 py-1 flex items-center justify-between hover:bg-[#677786] hover:text-white transition-colors cursor-pointer ${
                          isSelected ? 'font-bold text-white bg-[#677786]/70' : ''
                        }`}
                      >
                        <span>{g.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SERVICE */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((d) => (d === 'service' ? null : 'service'))}
                className={`flex items-center gap-1 text-[11px] uppercase tracking-[0.075em] transition-colors cursor-pointer ${
                  serviceFilter ? 'text-white font-semibold' : 'text-[#778899] hover:text-white'
                }`}
              >
                <span>{selectedServiceName ?? t('cat_service_upper')}</span>
                <ChevronDown className="w-3 h-3 stroke-[2.2]" />
              </button>

              {openDropdown === 'service' && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#899aa9] text-[#1f272e] rounded-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.55)] py-1.5 z-40 text-[12px]">
                  <button
                    type="button"
                    onClick={() => {
                      setServiceFilter(null);
                      setShowAllFilms(false);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-3.5 py-1 flex items-center justify-between hover:bg-[#677786] hover:text-white transition-colors cursor-pointer ${
                      !serviceFilter ? 'font-bold text-white bg-[#677786]/70' : ''
                    }`}
                  >
                    <span>{t('sim_any_service')}</span>
                    {!serviceFilter && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div className="border-t border-[#738494] my-1" />
                  {tmdb.streamingServices.map((srv) => {
                    const isSelected = serviceFilter === srv.id;
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => {
                          setServiceFilter(srv.id);
                          setShowAllFilms(false);
                          setOpenDropdown(null);
                        }}
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

            {/* Sort by POPULARITY */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((d) => (d === 'sort' ? null : 'sort'))}
                className="flex items-center gap-1 text-[11px] tracking-[0.06em] text-[#778899] hover:text-white transition-colors cursor-pointer"
              >
                <span className="normal-case">{t('person_sort_by')}</span>
                <span className="uppercase text-[#899aa9]">{t(currentSortLabelKey)}</span>
                <ChevronDown className="w-3 h-3 stroke-[2.2]" />
              </button>

              {openDropdown === 'sort' && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-[#899aa9] text-[#1f272e] rounded-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.55)] py-1.5 z-40 text-[12px]">
                  {SORT_OPTIONS.map((o) => {
                    const isSelected = sortBy === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          setSortBy(o.value);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-3.5 py-1 flex items-center justify-between hover:bg-[#677786] hover:text-white transition-colors cursor-pointer ${
                          isSelected ? 'font-bold text-white bg-[#677786]/70' : ''
                        }`}
                      >
                        <span>{t(o.label)}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 👁 (Watched / Fade Watched) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((d) => (d === 'watched' ? null : 'watched'))}
                aria-label={t('flt_watched')}
                className={`flex items-center gap-0.5 text-[11px] transition-colors cursor-pointer ${
                  watchedMode !== 'all' ? 'text-[#00e054]' : 'text-[#778899] hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <ChevronDown className="w-3 h-3 stroke-[2.2]" />
              </button>

              {openDropdown === 'watched' && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-[#899aa9] text-[#1f272e] rounded-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.55)] py-1.5 z-40 text-[12px]">
                  {(
                    [
                      { value: 'all', label: t('sim_show_all') },
                      { value: 'watched', label: t('sim_show_watched') },
                      { value: 'unwatched', label: t('sim_hide_watched') },
                    ] as const
                  ).map((opt) => {
                    const isSelected = watchedMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setWatchedMode(opt.value);
                          setShowAllFilms(false);
                          setOpenDropdown(null);
                        }}
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
                    onClick={() => {
                      setFadeWatched((v) => !v);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-3.5 py-1 flex items-center justify-between hover:bg-[#677786] hover:text-white transition-colors cursor-pointer ${
                      fadeWatched ? 'font-bold text-white bg-[#677786]/70' : ''
                    }`}
                  >
                    <span>{t('sim_fade_watched')}</span>
                    {fadeWatched && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Área principal em 2 colunas: Esquerda (670px - 5 pôsteres) + Direita (230px - Foto + Bio + Links) */}
      <div className="flex flex-col md:flex-row gap-x-[50px] gap-y-8 items-start">
        {/* Coluna Esquerda: Grade de 5 colunas */}
        <div className="w-full md:w-[670px] flex-shrink-0 min-w-0">
          {visibleFilms.length > 0 ? (
            <>
              <div className="grid grid-cols-5 gap-[10px]">
                {listed.map((film) => {
                  const isFaded = fadeWatched && isMovieWatched(film.id);
                  return (
                    <PosterCard
                      key={`${film.media_type ?? 'movie'}-${film.id}`}
                      movie={{
                        id: film.id,
                        title: film.title,
                        poster_path: film.poster_path,
                        release_date: film.release_date,
                        vote_average: film.vote_average,
                      }}
                      tv={film.media_type === 'tv'}
                      size="fluid"
                      faded={isFaded}
                      linkState={{
                        fromPerson: {
                          id: person.id,
                          name: person.name,
                          profile_path: person.profile_path,
                          character: film.character,
                          job: film.job,
                          role: desktopActiveTabDef?.key ?? 'Actor',
                        },
                      }}
                    />
                  );
                })}
              </div>
              {showMoreButton}
            </>
          ) : (
            <div className="py-20 text-center space-y-2 border border-dashed border-[#2c3440] rounded">
              <p className="text-sm text-white font-semibold">{t('person_nothing')}</p>
              <p className="text-xs text-[#778899]">{t('person_no_films')}</p>
            </div>
          )}
        </div>

        {/* Coluna Direita: Retrato 230x345 + Biografia sempre visível + Links TMDB / Wikipedia */}
        <aside className="w-full md:w-[230px] flex-shrink-0 flex flex-col">
          {profileImg && (
            <button
              type="button"
              onClick={() => setShowPhotoLightbox(true)}
              aria-label={person.name}
              className="w-[230px] h-[345px] rounded-[4px] border border-white/15 shadow-md overflow-hidden cursor-pointer group relative p-0 block bg-[#1c2228]"
            >
              <img
                loading="lazy"
                decoding="async"
                src={profileImg}
                alt={person.name}
                className="w-full h-full object-cover"
              />
              <span className="absolute inset-0 ring-inset ring-2 ring-transparent group-hover:ring-[#00e054] rounded-[4px] transition-all pointer-events-none" />
            </button>
          )}

          {/* Biografia logo abaixo da foto */}
          <div className="mt-3.5 text-[12.5px] leading-[1.6] text-[#778899]">
            {rawBio ? (
              <>
                <p className="whitespace-pre-line">
                  {bioExpanded || !isBioLong ? rawBio : collapsedBioText}
                </p>
                {isBioLong && (
                  <button
                    type="button"
                    onClick={() => setBioExpanded((v) => !v)}
                    className="mt-0.5 block text-white hover:text-[#40bcf4] font-semibold transition-colors cursor-pointer"
                  >
                    {bioExpanded
                      ? language === 'pt-BR'
                        ? 'menos'
                        : 'less'
                      : language === 'pt-BR'
                        ? 'mais'
                        : 'more'}
                  </button>
                )}
              </>
            ) : (
              <p>{t('person_bio_empty')}</p>
            )}
          </div>

          {/* Rodapé de links externos: More details at [TMDB] [Wikipedia] */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[#778899]">
            <span>{language === 'pt-BR' ? 'Mais detalhes em' : 'More details at'}</span>
            <a
              href={tmdbPersonHref}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[#303844] bg-[#1a2026] hover:border-[#667788] text-[#778899] hover:text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-[2px] transition-colors"
            >
              TMDB
            </a>
            <a
              href={wikipediaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[#303844] bg-[#1a2026] hover:border-[#667788] text-[#778899] hover:text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-[2px] transition-colors"
            >
              Wikipedia
            </a>
          </div>
        </aside>
      </div>

      {photoLightbox}
    </div>
  );
}

export default ActorPage;
