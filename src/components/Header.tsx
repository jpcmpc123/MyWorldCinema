import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Search, Plus, X, ChevronDown, Zap, Settings, Globe, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { tmdb, type TMDBMovie } from '../services/tmdb';
import {
  animateElasticIndicator,
  followTabIndicator,
  settleTabIndicator,
  syncTabIndicatorToButton,
  type IndicatorPos,
} from '../utils/tabIndicator';
import { isMainTabRoute, parseProfileTabRoute } from '../utils/tabRoutes';
import {
  TAB_SWIPE_EVENT,
  emitTabSwipeClaim,
  emitTabSwipeFinish,
  emitTabSwipeMove,
  type TabSwipeDetail,
} from '../utils/tabSwipe';

export const Header: React.FC = () => {
  const { user, openLogModal } = useApp();
  const { isAuthenticated, profile, signOut } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();

  // Authenticated profile takes precedence over the local/fake user
  const displayUsername = isAuthenticated && profile ? profile.username : user.username;
  const displayDisplayName = isAuthenticated && profile?.display_name ? profile.display_name : user.displayName;
  const displayAvatar = (isAuthenticated && profile?.avatar_url) ? profile.avatar_url : user.avatarUrl;
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBMovie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Barra de abas mobile (FILMES / SÉRIES / CRÍTICAS / LISTAS na Home, ou
  // PERFIL / DIÁRIO / LISTAS / WATCHLIST na área do usuário): container +
  // elemento da barra verde deslizante.
  const tabsContainerRef = useRef<HTMLElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
        if (!searchQuery) setIsSearchExpanded(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchQuery]);

  useEffect(() => {
    setIsSearchOpen(false);
    setIsUserMenuOpen(false);
    setIsSearchExpanded(false);
    setSearchQuery('');
  }, [location.pathname]);

  // Live Typeahead search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await tmdb.searchMovies(searchQuery.trim(), 1);
        setSearchResults(res.results.slice(0, 6));
        setIsSearchOpen(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleMovieSelect = (id: number) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(`/film/${id}`);
  };

  /**
   * Submissão da busca (Enter no input, clique na lupa ou "Ver todos os
   * resultados"): fecha o dropdown rápido e abre a PÁGINA de resultados
   * (/search?q=…) — sem sair do tema nem quebrar o header.
   */
  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim() || searchParam.trim();
    setIsSearchOpen(false);
    setIsSearching(false);
    setSearchResults([]);
    if (!q) {
      navigate('/search');
      return;
    }
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  // Páginas de detalhe (filme/série): navbar flutua transparente por cima do backdrop
  const overBackdrop = /^\/(film|tv)\/\d+/.test(location.pathname);

  // Mobile (<768px): páginas principais exibem título centrado + faixa de 4 abas
  const path = location.pathname;
  const isMainPage = !overBackdrop && isMainTabRoute(path);
  // Tela de busca: no mobile o campo ocupa a faixa preta do topo (em vez do título/sign in)
  const isSearchRoute = path === '/search';
  // Telas do BROWSE BY (cascata/resultados): no mobile têm header próprio
  // (preto, com ← voltar) — esconde a barra global "MyWorld" para não duplicar.
  const isBrowseRoute = path.startsWith('/browse');
  // Perfil de PESSOA (/actor/:id): no mobile tem Top App Bar própria
  // (← + nome + abas de função) — a barra global some só no mobile.
  const isActorRoute = /^\/actor\/\d+/.test(path);
  // Configurações (mobile): a tela "Profile Settings" tem o próprio cabeçalho (✕ / ✓),
  // então a barra global com "MyWorld" some só no mobile.
  const isSettingsRoute = path === '/settings';

  // Área de perfil (mobile): barra própria com ⚙ + usuário + abas elásticas
  const profileMatch = !overBackdrop && !isSearchRoute ? parseProfileTabRoute(path, displayUsername) : null;
  const isProfileArea = profileMatch !== null;
  const profileAreaUser = profileMatch?.username ?? displayUsername;
  const profileTab = profileMatch?.tab ?? 'profile';

  const [searchParams] = useSearchParams();
  const searchParam = searchParams.get('q') ?? '';
  const activeTab: 'films' | 'series' | 'reviews' | 'lists' =
    path === '/' || path.startsWith('/films')
      ? 'films'
      : path.startsWith('/series') || path.startsWith('/tv')
        ? 'series'
        : path === '/reviews' || path.startsWith('/reviews')
          ? 'reviews'
          : 'lists';
  const tabs: { key: typeof activeTab; label: string; to: string }[] = [
    { key: 'films', label: t('nav_films'), to: '/' },
    { key: 'series', label: t('nav_series'), to: '/series' },
    { key: 'reviews', label: t('nav_reviews'), to: '/reviews' },
    { key: 'lists', label: t('nav_lists'), to: '/lists' },
  ];
  const profileTabs: { key: typeof profileTab; label: string; to: string }[] = [
    { key: 'profile', label: t('nav_profile'), to: `/${encodeURIComponent(profileAreaUser)}` },
    { key: 'diary', label: t('hdr_diary'), to: `/${encodeURIComponent(profileAreaUser)}/diary` },
    { key: 'lists', label: t('nav_lists'), to: `/${encodeURIComponent(profileAreaUser)}/lists` },
    { key: 'watchlist', label: t('hdr_watchlist'), to: `/${encodeURIComponent(profileAreaUser)}/watchlist` },
  ];

  const currentBarTabs = isProfileArea ? profileTabs : tabs;
  const currentBarActiveKey = isProfileArea ? profileTab : activeTab;
  const currentBarActiveIndex = Math.max(
    0,
    currentBarTabs.findIndex((tab) => tab.key === currentBarActiveKey),
  );
  const currentBarActiveIndexRef = useRef<number>(currentBarActiveIndex);
  currentBarActiveIndexRef.current = currentBarActiveIndex;
  const barModeKey = isProfileArea ? `profile:${profileAreaUser}` : isMainPage ? 'main' : 'none';

  // ---------------------------------------------------------------------------
  // Barra verde elástica (Elastic Indicator) embaixo da aba ativa
  // (tanto para FILMES / SÉRIES / CRÍTICAS / LISTAS quanto para
  // PERFIL / DIÁRIO / LISTAS / WATCHLIST).
  // ---------------------------------------------------------------------------
  const prevPosRef = useRef<IndicatorPos>({ left: 0, width: 0 });
  const prevBarModeRef = useRef<string>(barModeKey);
  const tabsLabelKey = currentBarTabs.map((tab) => tab.label).join('|');
  const prevLabelsKeyRef = useRef<string>(tabsLabelKey);
  const lastBarWidthRef = useRef<number>(0);
  const suppressBarClickUntilRef = useRef<number>(0);
  const isSwipingBarRef = useRef<boolean>(false);

  const barButtonsRef = useRef<HTMLElement[]>([]);
  const buttonGeometriesRef = useRef<{ left: number; width: number }[]>([]);
  const currentHighlightIdxRef = useRef<number>(-1);

  const getBarButtons = (forceQuery = false): HTMLElement[] => {
    if (
      !forceQuery &&
      barButtonsRef.current.length > 0 &&
      barButtonsRef.current[0]?.isConnected
    ) {
      return barButtonsRef.current;
    }
    const btns = Array.from(
      tabsContainerRef.current?.querySelectorAll<HTMLElement>('.main-tab-btn') ?? [],
    );
    barButtonsRef.current = btns;
    return btns;
  };

  const measureBarButtons = (buttons?: HTMLElement[]): { left: number; width: number }[] => {
    const btns = buttons ?? getBarButtons(true);
    const geos = btns.map((b) => ({ left: b.offsetLeft, width: b.offsetWidth }));
    buttonGeometriesRef.current = geos;
    return geos;
  };

  const syncActiveHighlight = (buttons: ArrayLike<HTMLElement>, highlightedIdx: number) => {
    if (currentHighlightIdxRef.current === highlightedIdx) return;
    currentHighlightIdxRef.current = highlightedIdx;
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', i === highlightedIdx);
    }
  };

  // Único efeito síncrono de posicionamento e animação:
  // - Quando muda o modo da barra (Home <-> Perfil), idioma ou sai de estado oculto: posiciona sem animar (immediate = true).
  // - Quando muda a aba ativa (por clique ou confirmação de swipe): anima com o efeito elástico na GPU.
  useLayoutEffect(() => {
    const modeChanged = prevBarModeRef.current !== barModeKey;
    const labelsChanged = prevLabelsKeyRef.current !== tabsLabelKey;
    prevBarModeRef.current = barModeKey;
    prevLabelsKeyRef.current = tabsLabelKey;
    isSwipingBarRef.current = false;

    const indicator = indicatorRef.current;
    const buttons = getBarButtons(true);
    const btn = buttons[currentBarActiveIndex] ?? null;
    if (!indicator || !btn) return;

    currentHighlightIdxRef.current = -1;
    syncActiveHighlight(buttons, currentBarActiveIndex);
    measureBarButtons(buttons);

    const navWidth = tabsContainerRef.current?.clientWidth ?? 0;
    const wasHidden = lastBarWidthRef.current <= 0;
    if (navWidth > 0) {
      lastBarWidthRef.current = navWidth;
    }

    const immediate = modeChanged || labelsChanged || wasHidden || navWidth <= 0;
    animateElasticIndicator(btn, indicator, prevPosRef.current, immediate);

    const rafId = window.requestAnimationFrame(() => {
      if (isSwipingBarRef.current) return;
      const currentButtons = getBarButtons();
      const idx = currentBarActiveIndexRef.current;
      const activeBtn = currentButtons[idx] ?? null;
      if (!activeBtn || !indicatorRef.current) return;
      syncActiveHighlight(currentButtons, idx);
      if (prevPosRef.current.width <= 0) {
        measureBarButtons(currentButtons);
        syncTabIndicatorToButton(activeBtn, indicatorRef.current, prevPosRef.current);
      }
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [currentBarActiveKey, currentBarActiveIndex, tabsLabelKey, barModeKey]);

  // Girar a tela / redimensionar / carregar fontes ou retornar visibilidade:
  // garante que a barra verde esteja sempre cravada sob o botão ativo quando parada.
  useEffect(() => {
    const navEl = tabsContainerRef.current;
    if (!navEl) return;

    const remeasureAndSync = (forceImmediate = false) => {
      if (isSwipingBarRef.current) return;
      const container = tabsContainerRef.current;
      const indicator = indicatorRef.current;
      if (!container || !indicator) return;
      const w = container.clientWidth;
      if (w <= 0) {
        lastBarWidthRef.current = 0;
        return;
      }
      const widthChanged =
        lastBarWidthRef.current <= 0 || Math.abs(w - lastBarWidthRef.current) > 1;
      lastBarWidthRef.current = w;

      const buttons = getBarButtons(true);
      measureBarButtons(buttons);
      const idx = currentBarActiveIndexRef.current;
      const btn = buttons[idx] ?? null;
      if (!btn) return;
      syncActiveHighlight(buttons, idx);
      if (forceImmediate || widthChanged) {
        animateElasticIndicator(btn, indicator, prevPosRef.current, true);
      } else {
        syncTabIndicatorToButton(btn, indicator, prevPosRef.current);
      }
    };

    const onResize = () => remeasureAndSync(true);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') remeasureAndSync(false);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => remeasureAndSync(false));
      ro.observe(navEl);
    }

    if (typeof document !== 'undefined' && 'fonts' in document) {
      void document.fonts.ready.then(() => remeasureAndSync(false));
    }

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      ro?.disconnect();
    };
  }, [barModeKey]);

  // Durante o arrasto horizontal (swipe entre abas da Home ou do Perfil), a barra
  // verde acompanha o movimento do dedo em tempo real usando geometria em cache
  // (zero querySelectorAll e zero reflow por frame), acende a nova aba ao atingir
  // o limiar de confirmação e encaixa suavemente ao soltar.
  useEffect(() => {
    const onSwipe = (event: Event) => {
      const detail = (event as CustomEvent<TabSwipeDetail>).detail;
      if (!detail || barModeKey === 'none') return;

      const indicator = indicatorRef.current;
      if (!indicator) return;

      suppressBarClickUntilRef.current = performance.now() + 500;

      const buttons = getBarButtons(false);
      if (!buttons.length) return;

      const geometries =
        buttonGeometriesRef.current.length === buttons.length
          ? buttonGeometriesRef.current
          : measureBarButtons(buttons);

      const activeIdx = currentBarActiveIndexRef.current;
      const fromIdx = detail.fromIndex ?? activeIdx;
      const toIdx = detail.toIndex ?? fromIdx;

      // Descarta eventos órfãos de um gesto anterior se a aba ativa já mudou
      if (fromIdx !== activeIdx) {
        if (detail.end && detail.committed && toIdx === activeIdx) {
          isSwipingBarRef.current = false;
          const targetGeo = geometries[activeIdx] ?? geometries[0];
          syncActiveHighlight(buttons, activeIdx);
          settleTabIndicator(indicator, targetGeo.left, targetGeo.width, prevPosRef.current);
        }
        return;
      }

      const fromGeo = geometries[fromIdx] ?? geometries[0];
      const toGeo = geometries[toIdx] ?? fromGeo;

      if (detail.end) {
        isSwipingBarRef.current = false;
        suppressBarClickUntilRef.current = performance.now() + 450;
        const finalIdx = detail.committed ? toIdx : activeIdx;
        const targetGeo = geometries[finalIdx] ?? fromGeo;
        syncActiveHighlight(buttons, finalIdx);
        settleTabIndicator(indicator, targetGeo.left, targetGeo.width, prevPosRef.current);
        return;
      }

      isSwipingBarRef.current = true;
      suppressBarClickUntilRef.current = performance.now() + 450;
      const progress = detail.width > 0 ? Math.min(1, Math.abs(detail.shift) / detail.width) : 0;
      const highlightIdx = progress >= 0.22 && fromIdx !== toIdx ? toIdx : fromIdx;
      syncActiveHighlight(buttons, highlightIdx);

      if (fromIdx === toIdx || progress <= 0) {
        followTabIndicator(
          indicator,
          fromGeo,
          fromGeo,
          0,
          prevPosRef.current,
        );
        return;
      }

      followTabIndicator(
        indicator,
        fromGeo,
        toGeo,
        progress,
        prevPosRef.current,
      );
    };

    window.addEventListener(TAB_SWIPE_EVENT, onSwipe);
    return () => {
      isSwipingBarRef.current = false;
      window.removeEventListener(TAB_SWIPE_EVENT, onSwipe);
    };
  }, [barModeKey]);

  // ---------------------------------------------------------------------------
  // Gesto que começa na FAIXA DE ABAS: repassado ao TabViewPager com escudo
  // anti-click de 450ms caso o dedo arraste horizontalmente.
  // ---------------------------------------------------------------------------
  const barPointerIdRef = useRef<number | null>(null);
  const barDraggedRef = useRef<boolean>(false);
  const barStartXRef = useRef<number>(0);
  const barStartYRef = useRef<number>(0);

  const onBarPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!indicatorRef.current) return;
    barPointerIdRef.current = e.pointerId;
    barDraggedRef.current = false;
    barStartXRef.current = e.clientX;
    barStartYRef.current = e.clientY;
    emitTabSwipeClaim({
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      pointerType: e.pointerType,
      target: e.currentTarget as Element | null,
    });
  };

  const onBarPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    // Em telas de toque, o listener nativo onTouchMove já emite o movimento sincronizado
    if (e.pointerType === 'touch') return;
    if (barPointerIdRef.current !== e.pointerId) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      onBarPointerFinish(false);
      return;
    }
    const dx = Math.abs(e.clientX - barStartXRef.current);
    const dy = Math.abs(e.clientY - barStartYRef.current);
    if (dx >= 8 && dx > dy * 0.85) {
      barDraggedRef.current = true;
      suppressBarClickUntilRef.current = performance.now() + 450;
    }
    emitTabSwipeMove({
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      timeStamp: e.timeStamp,
      pointerType: e.pointerType,
    });
  };

  const onBarPointerFinish = (cancelled: boolean) => {
    if (barPointerIdRef.current === null) return;
    if (barDraggedRef.current) {
      suppressBarClickUntilRef.current = performance.now() + 450;
    }
    barPointerIdRef.current = null;
    barDraggedRef.current = false;
    emitTabSwipeFinish({ cancelled });
  };

  // Previne que o navegador mobile dispare pointercancel ao iniciar arrasto
  // horizontal intencional sobre a faixa de abas, e garante limpeza do ponteiro.
  useEffect(() => {
    const navEl = tabsContainerRef.current;
    if (!navEl) return;
    const onTouchMove = (e: TouchEvent) => {
      if (barPointerIdRef.current === null || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - barStartXRef.current);
      const dy = Math.abs(touch.clientY - barStartYRef.current);
      if (barDraggedRef.current || (dx >= 8 && dx > dy * 0.85)) {
        if (e.cancelable) e.preventDefault();
        barDraggedRef.current = true;
        suppressBarClickUntilRef.current = performance.now() + 450;
        emitTabSwipeMove({
          pointerId: barPointerIdRef.current,
          clientX: touch.clientX,
          clientY: touch.clientY,
          timeStamp: e.timeStamp,
          pointerType: 'touch',
        });
      }
    };
    const onWindowPointerEnd = () => {
      if (barPointerIdRef.current !== null) {
        barPointerIdRef.current = null;
        barDraggedRef.current = false;
      }
    };
    navEl.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('pointerup', onWindowPointerEnd);
    window.addEventListener('pointercancel', onWindowPointerEnd);
    return () => {
      navEl.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerup', onWindowPointerEnd);
      window.removeEventListener('pointercancel', onWindowPointerEnd);
    };
  }, [barModeKey]);

  /** Click sobrando de um arrasto na faixa não deve trocar de aba */
  const onBarClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (performance.now() < suppressBarClickUntilRef.current || barDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <header
      className={
        overBackdrop
          ? 'hidden md:block absolute inset-x-0 top-0 z-50 bg-transparent select-none'
          : !(isMainPage || isProfileArea || isSettingsRoute)
            ? 'hidden md:block sticky top-0 z-50 bg-black border-b border-lb-elevated shadow-md select-none'
            : 'sticky top-0 z-50 bg-black border-b border-lb-elevated shadow-md select-none'
      }
    >
      {/* Camada de contraste da navbar sobre o backdrop — MESMA receita do
          Letterboxd (.site-header .site-header-bg): 95px, gradiente de
          #14181c (sólido no topo) até transparente, opacidade 2/3 parada e
          0.85 no hover. Só existe nas rotas com backdrop (filme/série). */}
      {overBackdrop && <div className="site-header-bg hidden md:block" aria-hidden="true" />}
      <div className={`relative max-w-[950px] mx-auto px-4 h-[52px] md:h-[72px] flex items-center justify-between gap-4 ${
        overBackdrop ? '[text-shadow:0_1px_3px_rgba(0,0,0,0.8)] [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : ''
      }`}>
        {/* Mobile-only (páginas de detalhe): os botões ← e ⋮ flutuantes são
            renderizados pela própria FilmPage (o ⋮ abre o ActionBottomSheet) */}

        {/* Zone 1 (Left): Brand Logo — apenas Desktop */}
        <Link to="/" className="hidden md:flex items-center gap-2.5 shrink-0 group">
          <svg
            viewBox="0 0 32 32"
            className="w-7 h-7 shrink-0 drop-shadow-[0_2px_6px_rgba(0,224,84,0.35)] transition-transform duration-300 group-hover:rotate-6"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="mw-globe" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00e054" />
                <stop offset="55%" stopColor="#40bcf4" />
                <stop offset="100%" stopColor="#2c7fb8" />
              </linearGradient>
            </defs>
            {/* Globe */}
            <circle cx="16" cy="16" r="13" fill="url(#mw-globe)" />
            <ellipse cx="16" cy="16" rx="6" ry="13" fill="none" stroke="#14181c" strokeOpacity="0.35" strokeWidth="1.2" />
            <line x1="3.2" y1="16" x2="28.8" y2="16" stroke="#14181c" strokeOpacity="0.35" strokeWidth="1.2" />
            <path d="M5.2 9h21.6M5.2 23h21.6" stroke="#14181c" strokeOpacity="0.25" strokeWidth="1.1" fill="none" />
            {/* Shine */}
            <ellipse cx="10.5" cy="9.5" rx="4" ry="2.6" fill="#ffffff" opacity="0.25" transform="rotate(-20 10.5 9.5)" />
          </svg>
          <span className="font-extrabold text-[22px] tracking-tight text-white whitespace-nowrap leading-none">
            My<span className="text-lb-green">World</span>
          </span>
        </Link>

        {/* Mobile-only (páginas principais): seletor de idioma à esquerda para visitantes */}
        {isMainPage && !isAuthenticated && (
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={t('nav_language_label')}
            title={language === 'pt-BR' ? 'English (US)' : 'Português (Brasil)'}
            className="md:hidden min-h-[36px] text-[11px] font-bold text-[#9ab] hover:text-white border border-white/10 rounded px-2 py-1 flex items-center gap-1 bg-white/5 cursor-pointer transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'pt-BR' ? 'PT' : 'EN'}</span>
          </button>
        )}

        {/* Mobile-only (Configurações): barra preta com ✕ / "Profile Settings" / ✓,
            no lugar do "MyWorld". Ações vêm da própria tela via eventos. */}
        {isSettingsRoute && (
          <div className="md:hidden absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
            <button
              type="button"
              aria-label={t('btn_cancel')}
              onClick={() => window.dispatchEvent(new CustomEvent('settings:cancel'))}
              className="pointer-events-auto w-11 h-11 -ml-2.5 flex items-center justify-center text-white hover:text-lb-muted transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-base font-bold text-white truncate">{t('hdr_profile_settings')}</span>
            <button
              type="button"
              aria-label={t('btn_save')}
              onClick={() => window.dispatchEvent(new CustomEvent('settings:save'))}
              className="pointer-events-auto w-11 h-11 -mr-2.5 flex items-center justify-center text-white hover:text-lb-muted transition-colors cursor-pointer"
            >
              <Check className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Mobile-only (páginas principais): título centrado "MyWorld"
            Ajustado: deslocado 0.25mm (~1px) para baixo */}
        {isMainPage && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="md:hidden absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 translate-y-[1px] text-white text-[20px] font-bold tracking-[-0.01em] cursor-pointer leading-none whitespace-nowrap"
            style={{ fontFamily: 'var(--font-brand)' }}
          >
            MyWorld
          </button>
        )}

        {/* Mobile-only (área de perfil): ⚙ à esquerda + nome de usuário ao lado */}
        {isProfileArea && (
          <div className="md:hidden flex items-center gap-1.5">
            <Link
              to="/settings"
              aria-label={t('nav_settings')}
              className="w-11 h-11 -ml-2.5 flex items-center justify-center text-lb-muted hover:text-white transition-colors"
            >
              <Settings className="w-5 h-5" />
            </Link>
            <span className="text-base font-bold text-white tracking-tight truncate">
              {profileAreaUser}
            </span>
          </div>
        )}

        {/* Zone 2 (Right — Desktop Unified Navigation Cluster + Mobile Right Actions):
            No PC segue exatamente o formato Letterboxd:
            [Avatar + USERNAME ⌄]  ⚡  FILMS  SERIES  LISTS  🔍  [+ LOG ⌄] */}
        <div
          className={`${
            overBackdrop || isSearchRoute || isProfileArea || isSettingsRoute
              ? 'hidden md:flex'
              : 'flex'
          }${
            isMainPage ? ' ml-auto md:ml-auto' : ' md:ml-auto'
          } items-center gap-3 md:gap-5 text-[12px] font-bold uppercase tracking-[0.08em] shrink-0`}
        >
          {/* User Profile Dropdown (Desktop) or Sign In (Mobile/Desktop when logged out) */}
          {!isAuthenticated ? (
            <div className="flex items-center gap-2.5">
              {/* Seletor de idioma (desktop + rotas secundárias mobile; na Home mobile já fica à esquerda) */}
              <button
                type="button"
                onClick={toggleLanguage}
                aria-label={t('nav_language_label')}
                title={language === 'pt-BR' ? 'English (US)' : 'Português (Brasil)'}
                className={`${isMainPage ? 'hidden md:flex' : 'flex'} min-h-[32px] text-[11px] text-[#9ab] hover:text-white border border-white/10 rounded px-2 py-1 items-center gap-1 bg-white/5 cursor-pointer transition-colors`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{language === 'pt-BR' ? 'PT' : 'EN'}</span>
              </button>
              <Link
                to="/signin"
                className={`${isMainPage ? 'hidden md:flex' : 'flex'} min-h-[36px] items-center px-1.5 text-[11px] md:text-[12px] whitespace-nowrap transition-colors ${
                  location.pathname === '/signin' || location.pathname === '/signup'
                    ? 'text-white font-bold'
                    : 'text-[#99aabb] hover:text-white'
                }`}
              >
                {t('nav_sign_in')}
              </Link>
            </div>
          ) : (
            <div
              ref={userMenuRef}
              className="relative hidden md:block"
              onMouseEnter={() => setIsUserMenuOpen(true)}
              onMouseLeave={() => setIsUserMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((v) => !v)}
                className={`flex items-center gap-2 py-1.5 px-2 rounded-t-[3px] transition-colors cursor-pointer ${
                  isUserMenuOpen
                    ? 'bg-[#899aa9] text-white'
                    : 'text-[#99aabb] hover:text-white'
                }`}
              >
                <img
                  src={displayAvatar}
                  alt={displayDisplayName}
                  className="w-6 h-6 rounded-full object-cover border border-white/20 shrink-0"
                />
                <span
                  className={`text-[12px] font-bold tracking-[0.08em] uppercase whitespace-nowrap transition-colors ${
                    isUserMenuOpen ? 'text-white' : 'text-[#99aabb] hover:text-white'
                  }`}
                >
                  {displayUsername}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 stroke-[2.5] transition-colors ${
                    isUserMenuOpen ? 'text-white' : 'text-[#99aabb]'
                  }`}
                />
              </button>

              {isUserMenuOpen && (
                <div className="absolute left-0 top-full w-[196px] bg-[#899aa9] rounded-b-[3px] rounded-tr-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.55)] border-t border-[#6c7c8b] py-1.5 z-50 text-[13px] font-normal normal-case tracking-normal select-none">
                  {[
                    { label: t('nav_home'), to: '/' },
                    { label: t('nav_profile'), to: `/${encodeURIComponent(displayUsername)}` },
                    { label: t('nav_films'), to: `/${encodeURIComponent(displayUsername)}?tab=films` },
                    { label: t('hdr_diary'), to: `/${encodeURIComponent(displayUsername)}/diary` },
                    { label: t('reviews_label'), to: `/${encodeURIComponent(displayUsername)}?tab=reviews` },
                    { label: t('hdr_watchlist'), to: `/${encodeURIComponent(displayUsername)}/watchlist` },
                    { label: t('nav_lists'), to: `/${encodeURIComponent(displayUsername)}/lists` },
                    { label: t('pp_likes'), to: `/${encodeURIComponent(displayUsername)}?tab=likes` },
                  ].map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      onClick={() => setIsUserMenuOpen(false)}
                      className="block px-4 py-[5px] text-[#1f272e] hover:bg-[#677786] hover:text-white transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}

                  <div className="border-t border-[#738494] my-1.5" />

                  <Link
                    to="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="block px-4 py-[5px] text-[#1f272e] hover:bg-[#677786] hover:text-white transition-colors"
                  >
                    {t('nav_settings')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      void signOut();
                    }}
                    className="w-full text-left block px-4 py-[5px] text-[#1f272e] hover:bg-[#677786] hover:text-white transition-colors cursor-pointer"
                  >
                    {t('nav_sign_out')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Activity Zap Icon (Desktop) */}
          <Link
            to={`/${encodeURIComponent(displayUsername)}?tab=activity`}
            className="hidden md:flex items-center justify-center text-[#99aabb] hover:text-white transition-colors"
            title={t('nav_activity')}
          >
            <Zap className="w-4 h-4 fill-current text-transparent" />
          </Link>

          {/* Desktop Navigation Links (apenas as funcionalidades existentes no site: FILMS, SERIES, LISTS) */}
          <nav
            aria-label={t('nav_main')}
            className="hidden md:flex items-center gap-5 text-[12px] font-bold uppercase tracking-[0.08em]"
          >
            <Link
              to="/films"
              className={`whitespace-nowrap shrink-0 transition-colors ${
                location.pathname.startsWith('/films') ? 'text-white' : 'text-[#99aabb] hover:text-white'
              }`}
            >
              {t('nav_films')}
            </Link>
            <Link
              to="/series"
              className={`whitespace-nowrap shrink-0 transition-colors ${
                location.pathname.startsWith('/series') || location.pathname.startsWith('/tv')
                  ? 'text-white'
                  : 'text-[#99aabb] hover:text-white'
              }`}
            >
              {t('nav_series')}
            </Link>
            <Link
              to="/lists"
              className={`whitespace-nowrap shrink-0 transition-colors ${
                location.pathname === '/lists' || location.pathname.startsWith('/list/')
                  ? 'text-white'
                  : 'text-[#99aabb] hover:text-white'
              }`}
            >
              {t('nav_lists')}
            </Link>
          </nav>

          {/* Search Icon & Typeahead — desktop only (no mobile a busca vive na BottomNav/rota /search) */}
          <div ref={searchRef} className="relative hidden md:block">
            {isSearchExpanded ? (
              <form
                onSubmit={submitSearch}
                className="flex items-center h-7 bg-white rounded-full px-2.5 w-36 sm:w-44"
              >
                <input
                  type="text"
                  placeholder={t('search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitSearch(e);
                    if (e.key === 'Escape') {
                      setIsSearchOpen(false);
                      setIsSearchExpanded(false);
                      setSearchQuery('');
                    }
                  }}
                  autoFocus
                  className="no-focus-ring flex-1 min-w-0 h-full bg-transparent text-xs text-gray-900 placeholder-gray-500 border-0 outline-none p-0 normal-case tracking-normal font-normal"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setIsSearchOpen(false);
                      if (isSearchRoute) navigate('/');
                    }}
                    aria-label={t('search_clear')}
                    className="ml-1 shrink-0 text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="submit"
                  aria-label={t('search_placeholder')}
                  className="ml-2 shrink-0 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIsSearchExpanded(true)}
                className="text-[#99aabb] hover:text-white p-1 transition-colors cursor-pointer flex items-center justify-center"
                title={t('search_label')}
                aria-label={t('search_label')}
              >
                <Search className="w-4 h-4 stroke-[2.2]" />
              </button>
            )}

            {/* Typeahead Dropdown */}
            {isSearchOpen && (
              <div className="absolute right-0 top-9 w-72 sm:w-80 bg-lb-surface border border-lb-elevated rounded shadow-2xl overflow-hidden z-50 mw-pop-in">
                <div className="px-3 py-1.5 bg-lb-bg border-b border-lb-elevated text-[10px] uppercase font-bold text-lb-muted flex justify-between">
                  <span>
                    {t('search_showing_matches')} “{searchQuery}”
                  </span>
                  {isSearching && <span className="text-lb-green animate-pulse">{t('search_searching')}</span>}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-lb-elevated/60 normal-case">
                  {searchResults.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => handleMovieSelect(m.id)}
                      className="p-2 flex items-center gap-2.5 hover:bg-lb-elevated cursor-pointer w-full text-left"
                    >
                      <img
                        src={tmdb.getImageUrl(m.poster_path, 'w92')}
                        alt={m.title}
                        className="w-8 h-12 object-cover rounded bg-lb-bg shrink-0"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{m.title}</p>
                        <p className="text-[11px] text-lb-muted tabular-nums">{m.release_date?.slice(0, 4)}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => submitSearch()}
                  className="w-full text-center py-2 bg-lb-bg border-t border-lb-elevated text-[10px] uppercase font-bold tracking-wider text-lb-green hover:bg-lb-elevated transition-colors cursor-pointer"
                >
                  {t('search_view_all')}
                </button>
              </div>
            )}
          </div>

          {/* "+ LOG ⌄" Split Green Button — desktop only */}
          <div className="hidden md:flex items-center">
            <button
              onClick={() => openLogModal()}
              className="bg-[#00b020] hover:bg-[#00c030] flex items-center gap-1 text-white font-bold text-[12px] px-2.5 h-[26px] rounded-l-[3px] cursor-pointer tracking-[0.06em] whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>{t('nav_log')}</span>
            </button>
            <button
              onClick={() => navigate('/lists/new')}
              title={t('create_list_title')}
              aria-label={t('create_list_title')}
              className="bg-[#00a01d] hover:bg-[#00b522] px-1.5 h-[26px] rounded-r-[3px] border-l border-black/20 text-white cursor-pointer flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile-only (páginas principais ou área de perfil): faixa de 4 abas
          (FILMES / SÉRIES / CRÍTICAS / LISTAS ou PERFIL / DIÁRIO / LISTAS / WATCHLIST)
          com barra verde DESLIZANTE embaixo da aba ativa (.tab-indicator) e
          suporte completo ao gesto de puxar (swipe).
          Ajustado: pt-[16px] (~4mm) de afastamento entre a barra do título e as abas */}
      {(isMainPage || isProfileArea) && (
        <div className="md:hidden hidden max-md:block pt-[16px]">
          <nav
            ref={tabsContainerRef}
            aria-label={isProfileArea ? t('nav_profile') : t('nav_sections')}
            className="main-tabs-container"
            onPointerDown={onBarPointerDown}
            onPointerMove={onBarPointerMove}
            onPointerUp={() => onBarPointerFinish(false)}
            onPointerCancel={() => onBarPointerFinish(true)}
            onClickCapture={onBarClickCapture}
          >
            {currentBarTabs.map((tab) => {
              const active = currentBarActiveKey === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={(e) => {
                    if (
                      performance.now() < suppressBarClickUntilRef.current ||
                      barDraggedRef.current
                    ) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    if (barPointerIdRef.current !== null) {
                      barPointerIdRef.current = null;
                      barDraggedRef.current = false;
                      emitTabSwipeFinish({ cancelled: true });
                    }
                    navigate(tab.to);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`main-tab-btn${active ? ' active' : ''}`}
                >
                  {tab.label}
                </button>
              );
            })}
            {/* Barra verde deslizante (posição/largura via JS) */}
            <span ref={indicatorRef} className="tab-indicator" aria-hidden="true" />
          </nav>
        </div>
      )}
    </header>
  );
};
