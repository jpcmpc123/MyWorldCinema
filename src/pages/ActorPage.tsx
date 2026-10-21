import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, List, Loader2, Share2, SlidersHorizontal } from 'lucide-react';
import { tmdb, type TMDBPersonDetails, type TMDBPersonMovieCredit } from '../services/tmdb';
import { PosterCard } from '../components/PosterCard';
import { useLanguage, type TranslationKey } from '../i18n/LanguageContext';
import {
  PERSON_ROLE_ORDER,
  isPersonRole,
  personRoleFromDepartment,
  personRoleFromJob,
  type PersonRole,
} from '../utils/personNav';
import {
  animateElasticIndicator,
  type IndicatorPos,
} from '../utils/tabIndicator';
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

/** Filmes renderizados antes do botão "ver mais" — a constante vive no painel
 *  (ActorTabPanel) e é importada aqui para o botão do layout desktop. */

const selectCls =
  'bg-[#202830] border border-lb-elevated text-white text-[11px] uppercase font-bold tracking-wider px-3 py-1.5 rounded cursor-pointer focus:outline-none focus:border-lb-green';

/**
 * Centraliza a aba ativa dentro do container de abas horizontais, deixando
 * visíveis as opções vizinhas à esquerda E à direita (como no app Letterboxd).
 * O requestAnimationFrame garante que o DOM já calculou a largura dos botões.
 */
function centerActiveTab(tabButton: HTMLElement | null, tabsContainer: HTMLElement | null) {
  if (!tabButton || !tabsContainer) return;

  requestAnimationFrame(() => {
    const targetScrollLeft =
      tabButton.offsetLeft -
      tabsContainer.clientWidth / 2 +
      tabButton.clientWidth / 2;

    tabsContainer.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: 'smooth',
    });
  });
}

export function ActorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const [person, setPerson] = useState<TMDBPersonDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('Bio');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('popularity');
  const [genreFilter, setGenreFilter] = useState<number | null>(null);
  const [decadeFilter, setDecadeFilter] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAllFilms, setShowAllFilms] = useState(false);

  // Barra de abas: container com scroll horizontal + botão de cada aba
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const tabButtonsRef = useRef(new Map<TabKey, HTMLButtonElement>());
  // Elemento da barra verde elástica (o mesmo serve mobile e desktop,
  // já que apenas uma das duas barras é montada por vez) + posição anterior,
  // usada para saber a direção do estiramento.
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const prevIndicatorPosRef = useRef<IndicatorPos>({ left: 0, width: 0 });

  // Controla quando a aba inicial do cargo já foi decidida para liberar a animação
  const [roleReady, setRoleReady] = useState(false);

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
    setDecadeFilter(null);
    setGenreFilter(null);
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

  // ---- Actor: SOMENTE movie_credits.cast, sem duplicatas -------------------
  const castFilms = useMemo(() => {
    const seen = new Set<number>();
    return (person?.movie_credits?.cast ?? [])
      .filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .sort((a, b) => b.popularity - a.popularity);
  }, [person]);

  // ---- Equipe: agrupada por job (nunca misturada com atuação) --------------
  // FILMES e SÉRIES entram na MESMA lista de cada cargo (é o que permite a aba
  // "Criador" existir: o job 'Creator' só aparece em tv_credits).
  const crewByRole = useMemo(() => {
    const lists = new Map<PersonRole, TMDBPersonMovieCredit[]>();
    const seen = new Map<PersonRole, Set<number>>();
    const crew = [...(person?.movie_credits?.crew ?? []), ...(person?.tv_credits?.crew ?? [])];
    for (const credit of crew) {
      const role = personRoleFromJob(credit.job);
      if (!role) continue;
      let ids = seen.get(role);
      if (!ids) {
        ids = new Set<number>();
        seen.set(role, ids);
      }
      if (ids.has(credit.id)) continue; // mesmo título, jobs equivalentes
      ids.add(credit.id);
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

  const activeTabDef = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const tabItems = activeTabDef?.items ?? [];

  // ---- Décadas disponíveis na aba atual -----------------------------------
  const decades = useMemo(() => {
    const set = new Set<string>();
    tabItems.forEach((f) => {
      const y = f.release_date?.slice(0, 4);
      if (y) set.add(`${y.slice(0, 3)}0s`);
    });
    return Array.from(set).sort().reverse();
  }, [tabItems]);

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
    if (genreFilter) list = list.filter((f) => f.genre_ids?.includes(genreFilter));
    if (decadeFilter) list = list.filter((f) => f.release_date?.startsWith(decadeFilter.slice(0, 3)));
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'rating') return b.vote_average - a.vote_average;
      if (sortBy === 'newest') return (b.release_date || '').localeCompare(a.release_date || '');
      if (sortBy === 'oldest') return (a.release_date || '').localeCompare(b.release_date || '');
      return b.popularity - a.popularity;
    });
    return sorted;
  }, [tabItems, genreFilter, decadeFilter, sortBy]);

  const listed = showAllFilms ? visibleFilms : visibleFilms.slice(0, INITIAL_VISIBLE);

  const selectTab = (key: TabKey) => {
    setActiveTab(key);
    setShowAllFilms(false);
    setFiltersOpen(false);
    setDecadeFilter(null);
    setGenreFilter(null);
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

  // ---- Centraliza a aba ativa na barra horizontal (desktop) ----------------
  useEffect(() => {
    if (isMobile || !roleReady) return;
    centerActiveTab(tabButtonsRef.current.get(activeTab) ?? null, tabsContainerRef.current);
  }, [activeTab, person, isMobile, roleReady, tabs.length]);

  // ---- Barra verde ELÁSTICA unificada embaixo da aba ativa (desktop) -------
  const desktopPrevMetaRef = useRef<{
    personId: number | null;
    labelsKey: string;
    wasReady: boolean;
    activeTab: TabKey;
  }>({
    personId: null,
    labelsKey: tabLabelsKey,
    wasReady: false,
    activeTab,
  });

  useLayoutEffect(() => {
    if (isMobile || !roleReady) {
      desktopPrevMetaRef.current.wasReady = false;
      return;
    }
    const activeBtn = tabsContainerRef.current?.querySelector<HTMLElement>('.person-tab.active');
    const indicator = indicatorRef.current;
    if (!activeBtn || !indicator) return;

    const prev = desktopPrevMetaRef.current;
    const currentPersonId = person?.id ?? null;
    const isInitialOrMetaChange =
      !prev.wasReady ||
      prev.personId !== currentPersonId ||
      prev.labelsKey !== tabLabelsKey ||
      prevIndicatorPosRef.current.width <= 0;

    const immediate = isInitialOrMetaChange || prev.activeTab === activeTab;
    prev.wasReady = true;
    prev.personId = currentPersonId;
    prev.labelsKey = tabLabelsKey;
    prev.activeTab = activeTab;

    animateElasticIndicator(activeBtn, indicator, prevIndicatorPosRef.current, immediate);
  }, [activeTab, isMobile, roleReady, tabLabelsKey, person?.id]);

  // Recalcula a barra ao girar a tela / redimensionar (desktop)
  useEffect(() => {
    if (isMobile) return;
    const sync = () => {
      const activeBtn = tabsContainerRef.current?.querySelector<HTMLElement>('.person-tab.active');
      const indicator = indicatorRef.current;
      if (activeBtn && indicator)
        animateElasticIndicator(activeBtn, indicator, prevIndicatorPosRef.current, true);
    };
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, [isMobile]);

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

  const clearFilters = () => {
    setDecadeFilter(null);
    setGenreFilter(null);
  };
  const hasFilters = Boolean(decadeFilter || genreFilter);

  // ---- Estados de carregamento / erro (com barra nativa no mobile) --------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#14181c]">
        <div className="md:hidden sticky top-0 z-40 h-14 px-4 bg-black flex items-center">
          <button onClick={() => navigate(-1)} aria-label={t('common_back')} className="text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center justify-center py-40">
          <Loader2 className="w-8 h-8 animate-spin text-lb-green" />
        </div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="min-h-screen bg-[#14181c]">
        <div className="md:hidden sticky top-0 z-40 h-14 px-4 bg-black flex items-center">
          <button onClick={() => navigate(-1)} aria-label={t('common_back')} className="text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="max-w-[950px] mx-auto px-4 py-20 text-center space-y-2">
          <p className="text-white font-semibold">{error || t('person_not_found')}</p>
          <p className="text-xs text-lb-muted">{t('person_bio_empty')}</p>
        </div>
      </div>
    );
  }

  const crumb = activeTabDef?.crumb ? t(activeTabDef.crumb) : t('person_films_starring');
  const profileImg = person.profile_path
    ? tmdb.getProfileUrl(person.profile_path, 'h632')
    : null;

  // Filtros (selects) — usados na barra do desktop e no painel recolhível do mobile
  const decadeGenreSelects = (
    <>
      <select
        value={decadeFilter ?? ''}
        onChange={(e) => setDecadeFilter(e.target.value || null)}
        className={selectCls}
        aria-label={t('person_all_decades')}
      >
        <option value="">{t('person_all_decades')}</option>
        {decades.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        value={genreFilter ?? ''}
        onChange={(e) => setGenreFilter(e.target.value ? Number(e.target.value) : null)}
        className={selectCls}
        aria-label={t('person_all_genres')}
      >
        <option value="">{t('person_all_genres')}</option>
        {tmdb.genres.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      {hasFilters && (
        <button
          onClick={clearFilters}
          className="text-lb-muted hover:text-white text-[11px] uppercase font-bold tracking-wider px-2 transition-colors cursor-pointer"
        >
          ✕ {t('person_clear')}
        </button>
      )}
    </>
  );

  const sortSelect = (
    <span className="flex items-center gap-2 text-[11px] uppercase font-bold tracking-wider">
      <span className="text-lb-muted">{t('person_sort_by')}</span>
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as SortKey)}
        className={selectCls}
        aria-label={t('person_sort_by')}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {t(o.label)}
          </option>
        ))}
      </select>
    </span>
  );

  const showMoreButton =
    visibleFilms.length > INITIAL_VISIBLE && !showAllFilms ? (
      <div className="px-3 pb-8 -mt-1">
        <button
          onClick={() => setShowAllFilms(true)}
          className="w-full py-2.5 rounded border border-white/10 bg-[#1c2228] text-[11px] font-bold uppercase tracking-wider text-[#9ab] active:scale-[0.98] transition-transform cursor-pointer"
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
        <div className="sticky top-0 z-40 bg-black">
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
                      personName={person.name}
                      biography={person.biography}
                      profileImg={profileImg}
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
      </div>
    );
  }

  // =========================================================================
  // DESKTOP (>= 768px) — layout MyWorld original + barra de abas por função
  // =========================================================================
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-widest text-lb-muted mb-1">
          {crumb}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white">{person.name}</h1>
      </div>

      {/* Abas por função (mesma lógica e mesmo indicador deslizante do mobile) */}
      <div ref={tabsContainerRef} className="person-tabs-container tabs-plain">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            ref={(el) => {
              if (el) tabButtonsRef.current.set(tab.key, el);
              else tabButtonsRef.current.delete(tab.key);
            }}
            onClick={() => selectTab(tab.key)}
            className={`person-tab${activeTab === tab.key ? ' active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
        <span ref={indicatorRef} className="tab-indicator" aria-hidden="true" />
      </div>

      {activeTab === 'Bio' ? (
        <div key={activeTab} className="mw-fade flex flex-col lg:flex-row gap-8 py-6">
          {profileImg && (
            <img
              src={profileImg}
              alt={person.name}
              loading="lazy"
              decoding="async"
              className="w-[180px] h-[270px] object-cover rounded border border-lb-elevated shadow-md shrink-0"
            />
          )}
          <div className="min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-lb-muted mb-3">
              {t('person_tab_bio')}
            </h3>
            <p className="text-[13px] text-lb-text leading-relaxed whitespace-pre-line">
              {person.biography || t('person_bio_empty')}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Filter Bar (funcional) */}
          <div className="flex flex-wrap items-center justify-between gap-2 py-3 mb-6 border-t border-b border-lb-elevated">
            <div className="flex flex-wrap items-center gap-2">{decadeGenreSelects}</div>
            {sortSelect}
          </div>

          <div key={activeTab} className="mw-fade flex flex-col lg:flex-row gap-8">
            {/* Left: Poster Grid */}
            <div className="flex-1 min-w-0">
              {visibleFilms.length > 0 ? (
                <>
                  <div className="grid grid-cols-4 lg:grid-cols-5 gap-3">
                    {listed.map((film) => (
                      <PosterCard
                        key={film.id}
                        movie={{
                          id: film.id,
                          title: film.title,
                          poster_path: film.poster_path,
                          release_date: film.release_date,
                          vote_average: film.vote_average,
                        }}
                        size="fluid"
                      />
                    ))}
                  </div>
                  {showMoreButton}
                </>
              ) : (
                <div className="py-20 text-center space-y-2 border border-dashed border-lb-elevated rounded">
                  <p className="text-sm text-white font-semibold">{t('person_nothing')}</p>
                  <p className="text-xs text-lb-muted">{t('person_no_films')}</p>
                </div>
              )}
            </div>

            {/* Right: Sidebar (foto + biografia resumida, como antes) */}
            <aside className="w-full lg:w-56 xl:w-64 flex-shrink-0 flex flex-col gap-4">
              {profileImg && (
                <img
                  loading="lazy"
                  decoding="async"
                  src={profileImg}
                  alt={person.name}
                  className="w-full max-w-64 lg:max-w-none mx-auto rounded border border-lb-elevated shadow-md object-cover"
                />
              )}

              {person.biography && (
                <div className="border-t border-b border-lb-elevated py-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-lb-muted mb-3">
                    {t('person_tab_bio')}
                  </h3>
                  <p
                    className={`text-[13px] text-lb-text leading-relaxed whitespace-pre-line ${
                      bioExpanded ? '' : 'line-clamp-6'
                    }`}
                  >
                    {person.biography}
                  </p>
                  <button
                    onClick={() => setBioExpanded((v) => !v)}
                    className="mt-2 text-xs font-semibold text-lb-muted hover:text-white uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    {bioExpanded ? '−' : t('show_more')}
                  </button>
                </div>
              )}

              {person.birthday && (
                <div className="text-[11px] uppercase tracking-wider">
                  <span className="text-lb-muted font-bold">{t('common_born')} </span>
                  <span className="text-lb-text">
                    {new Date(person.birthday).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

export default ActorPage;
