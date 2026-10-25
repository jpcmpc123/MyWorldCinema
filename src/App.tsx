import React, { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigationType, type Location } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Footer } from './components/Footer';
import { useApp } from './context/AppContext';
import { TabViewPager } from './components/TabViewPager';
import { useIsMobile } from './hooks/useIsMobile';
import { tabPanelIndex, parseProfileTabRoute } from './utils/tabRoutes';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomePage } from './pages/HomePage';
import { FilmPage } from './pages/FilmPage';
import { ActorPage } from './pages/ActorPage';
import { SearchPage } from './pages/SearchPage';
import { CollectionPage } from './pages/CollectionPage';
import { SeriesHubPage } from './pages/SeriesHubPage';
import { ProfilePage } from './pages/ProfilePage';
import { DiaryPage } from './pages/DiaryPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { ListsPage } from './pages/ListsPage';
import { CineIaPage } from './pages/CineIaPage';
import { PullToRefresh } from './components/PullToRefresh';

function parseDetailRoute(pathname: string): { type: 'movie' | 'tv'; id: number } | null {
  const m = pathname.match(/^\/(film|tv)\/(\d+)/);
  if (!m) return null;
  return { type: m[1] === 'tv' ? 'tv' : 'movie', id: Number(m[2]) };
}

/**
 * Mapa em memória das posições de scroll por rota (location.key e pathname+search).
 * Alimentado por um listener passivo de scroll enquanto a rota está ativa, garantindo
 * que o valor nunca seja sobrescrito pelo 0 da nova página durante uma transição.
 */
const routeScrollPositions = new Map<string, number>();

function getRouteScrollKey(loc: Location): string {
  return `${loc.pathname}${loc.search}`;
}

/**
 * Resilient lazy loader that retries failed dynamic imports (e.g. after Vite
 * module invalidations or server restarts) and falls back to a page reload if needed.
 */
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<any>,
  namedExport?: string
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      const comp = (namedExport && mod[namedExport]) || mod.default || mod[Object.keys(mod)[0]];
      return { default: comp };
    } catch (err) {
      console.warn('Initial dynamic import failed, retrying once...', err);
      try {
        await new Promise((resolve) => setTimeout(resolve, 600));
        const mod = await factory();
        const comp = (namedExport && mod[namedExport]) || mod.default || mod[Object.keys(mod)[0]];
        return { default: comp };
      } catch (retryErr) {
        console.error('Dynamic import failed on retry:', retryErr);
        const reloadKey = 'vite_chunk_retry_' + window.location.pathname;
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          window.location.reload();
        }
        throw retryErr;
      }
    }
  });
}

// Modais globais carregados sob demanda: fora do bundle inicial.
const LogModal = lazyWithRetry(() => import('./components/LogModal'), 'LogModal');
const Top4PickerModal = lazyWithRetry(() => import('./components/Top4PickerModal'), 'Top4PickerModal');
const ActionBottomSheet = lazyWithRetry(() => import('./components/ActionBottomSheet'), 'ActionBottomSheet');

// Só monta (e baixa o chunk de) cada modal quando ele está aberto.
function GlobalModals() {
  const { isLogModalOpen, isTop4PickerOpen, actionSheetMovie, closeActionSheet } = useApp();
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        {isLogModalOpen && <LogModal />}
        {isTop4PickerOpen && <Top4PickerModal />}
        {actionSheetMovie && (
          <ActionBottomSheet
            open={Boolean(actionSheetMovie)}
            onClose={closeActionSheet}
            movie={actionSheetMovie}
          />
        )}
      </Suspense>
    </ErrorBoundary>
  );
}

// Páginas secundárias de menor frequência com code splitting resiliente
const FilmsHubPage = lazyWithRetry(() => import('./pages/FilmsHubPage'), 'FilmsHubPage');
const FilmsPage = lazyWithRetry(() => import('./pages/FilmsPage'), 'FilmsPage');
const SeriesPage = lazyWithRetry(() => import('./pages/SeriesPage'), 'SeriesPage');
const ListDetailPage = lazyWithRetry(() => import('./pages/ListDetailPage'), 'ListDetailPage');
const CreateListPage = lazyWithRetry(() => import('./pages/CreateListPage'), 'CreateListPage');
const AuthPage = lazyWithRetry(() => import('./pages/AuthPage'), 'AuthPage');
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage'), 'SettingsPage');
const BrowseDrilldownPage = lazyWithRetry(() => import('./pages/BrowseDrilldownPage'), 'BrowseDrilldownPage');
const BrowseResultsPage = lazyWithRetry(() => import('./pages/BrowseResultsPage'), 'BrowseResultsPage');

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-40">
      <Loader2 className="w-8 h-8 animate-spin text-lb-green" />
    </div>
  );
}

const MemoizedRouteTree = React.memo(
  function RouteTree({ routeLocation }: { routeLocation: Location }) {
    const isDetailRoute =
      routeLocation.pathname.startsWith('/film/') || routeLocation.pathname.startsWith('/tv/');
    return (
      <ErrorBoundary>
        <Suspense fallback={isDetailRoute ? null : <PageLoader />}>
          <Routes location={routeLocation}>
            <Route path="/" element={<HomePage />} />
            <Route path="/film/:id" element={<FilmPage isTvRoute={false} />} />
            <Route path="/collection/:id" element={<CollectionPage />} />
            <Route path="/actor/:id" element={<ActorPage />} />
            <Route path="/films" element={<FilmsHubPage />} />
            <Route path="/films/browse" element={<FilmsPage />} />
            <Route path="/films/popular" element={<FilmsPage />} />
            <Route path="/films/genre/:genre" element={<FilmsPage />} />
            <Route path="/series" element={<SeriesHubPage />} />
            <Route path="/series/browse" element={<SeriesPage />} />
            <Route path="/series/genre/:genre" element={<SeriesPage />} />
            <Route path="/series/decade/:decade" element={<SeriesPage />} />
            <Route path="/series/year/:year" element={<SeriesPage />} />
            <Route path="/series/popular" element={<SeriesPage />} />
            <Route path="/tv/:id" element={<FilmPage isTvRoute={true} />} />
            <Route path="/films/decade/:decade" element={<FilmsPage />} />
            <Route path="/films/year/:year" element={<FilmsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/diary" element={<DiaryPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/cine-ia" element={<CineIaPage />} />
            <Route path="/lists" element={<ListsPage />} />
            <Route path="/list/new" element={<CreateListPage />} />
            <Route path="/list/:id/edit" element={<CreateListPage />} />
            <Route path="/list/:id" element={<ListDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/import" element={<SettingsPage />} />
            <Route path="/signin" element={<AuthPage />} />
            <Route path="/signup" element={<AuthPage />} />
            <Route path="/search" element={<SearchPage />} />
            {/* BROWSE BY em cascata (drill-down) + grade de resultados filtrada */}
            <Route path="/browse/release-date" element={<BrowseDrilldownPage kind="decades" />} />
            <Route path="/browse/release-date/:decade" element={<BrowseDrilldownPage kind="years" />} />
            <Route path="/browse/genre" element={<BrowseDrilldownPage kind="genre" />} />
            <Route path="/browse/country" element={<BrowseDrilldownPage kind="country" />} />
            <Route path="/browse/language" element={<BrowseDrilldownPage kind="language" />} />
            <Route path="/browse/service" element={<BrowseDrilldownPage kind="service" />} />
            <Route path="/browse/results" element={<BrowseResultsPage />} />
            {/* Stand-ins usados pela BottomNav/abas mobile do app */}
            <Route path="/reviews" element={<DiaryPage />} />
            <Route path="/activity" element={<DiaryPage />} />
            {/* MyWorld profile sub-routes */}
            <Route path="/:username" element={<ProfilePage />} />
            <Route path="/:username/diary" element={<DiaryPage />} />
            <Route path="/:username/watchlist" element={<WatchlistPage />} />
            <Route path="/:username/lists" element={<ListsPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  },
  (prev, next) =>
    prev.routeLocation.pathname === next.routeLocation.pathname &&
    prev.routeLocation.search === next.routeLocation.search,
);

function AppShell() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isMobile = useIsMobile();
  const { user } = useApp();
  const { isAuthenticated, profile } = useAuth();
  const displayUsername = isAuthenticated && profile ? profile.username : user.username;

  const [committedLocation, setCommittedLocation] = useState<Location>(location);
  const [outgoingState, setOutgoingState] = useState<{ location: Location; scrollY: number } | null>(null);
  const [slidePhase, setSlidePhase] = useState<'idle' | 'prepare' | 'run'>('idle');

  // Referências para captura exata de scrollY antes de qualquer troca de rota
  const activeLocationRef = useRef<Location>(location);
  const isTransitioningRouteRef = useRef(false);
  const lastLiveScrollYRef = useRef<number>(typeof window !== 'undefined' ? window.scrollY : 0);

  // Se o React Router já trocou `location` neste render (antes dos effects rodarem),
  // trancamos imediatamente a gravação do listener de scroll para que um scrollTo(0, 0)
  // da nova página jamais sobrescreva o scrollY salvo da página anterior.
  if (
    location.pathname !== activeLocationRef.current.pathname ||
    location.search !== activeLocationRef.current.search
  ) {
    isTransitioningRouteRef.current = true;
  }

  useEffect(() => {
    const onScroll = () => {
      if (isTransitioningRouteRef.current) return;
      const y = window.scrollY;
      lastLiveScrollYRef.current = y;
      const activeLoc = activeLocationRef.current;
      if (activeLoc.key) {
        routeScrollPositions.set(`key:${activeLoc.key}`, y);
      }
      routeScrollPositions.set(getRouteScrollKey(activeLoc), y);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    if (
      location.pathname === committedLocation.pathname &&
      location.search === committedLocation.search
    ) {
      activeLocationRef.current = location;
      isTransitioningRouteRef.current = false;
      return;
    }

    // Salva a posição exata da rota que está saindo antes de atualizar committedLocation
    const prevLoc = committedLocation;
    const savedPrevScroll =
      (prevLoc.key ? routeScrollPositions.get(`key:${prevLoc.key}`) : undefined) ??
      routeScrollPositions.get(getRouteScrollKey(prevLoc)) ??
      lastLiveScrollYRef.current;

    if (prevLoc.key) {
      routeScrollPositions.set(`key:${prevLoc.key}`, savedPrevScroll);
    }
    routeScrollPositions.set(getRouteScrollKey(prevLoc), savedPrevScroll);

    // Se apenas a query string mudou na mesma rota (ex.: digitação em /search?q=...)
    if (location.pathname === committedLocation.pathname) {
      setCommittedLocation(location);
      activeLocationRef.current = location;
      isTransitioningRouteRef.current = false;
      return;
    }

    const detail = parseDetailRoute(location.pathname);
    const wasDetail = Boolean(parseDetailRoute(prevLoc.pathname));
    const isBackRestore = navigationType === 'POP' || (wasDetail && !detail);

    if (!detail) {
      setOutgoingState(null);
      setSlidePhase('idle');
      setCommittedLocation(location);
      activeLocationRef.current = location;

      // Ao voltar (POP ou saindo de /film/:id ou /tv/:id para a listagem anterior),
      // restaura imediatamente a posição de rolagem salva sem cair para o topo.
      const targetScrollY = isBackRestore
        ? (location.key ? routeScrollPositions.get(`key:${location.key}`) : undefined) ??
          routeScrollPositions.get(getRouteScrollKey(location)) ??
          0
        : 0;

      window.scrollTo({ top: targetScrollY, left: 0, behavior: 'auto' });
      lastLiveScrollYRef.current = targetScrollY;
      const raf = window.requestAnimationFrame(() => {
        window.scrollTo({ top: targetScrollY, left: 0, behavior: 'auto' });
        lastLiveScrollYRef.current = targetScrollY;
        isTransitioningRouteRef.current = false;
      });
      return () => {
        window.cancelAnimationFrame(raf);
        isTransitioningRouteRef.current = false;
      };
    }

    if (isMobile && navigationType !== 'POP' && !wasDetail) {
      setOutgoingState({ location: prevLoc, scrollY: savedPrevScroll });
      setSlidePhase('prepare');
      setCommittedLocation(location);
      activeLocationRef.current = location;
      window.scrollTo(0, 0);
      lastLiveScrollYRef.current = 0;
      isTransitioningRouteRef.current = false;
    } else {
      setOutgoingState(null);
      setSlidePhase('idle');
      setCommittedLocation(location);
      activeLocationRef.current = location;
      const targetDetailScrollY =
        navigationType === 'POP'
          ? (location.key ? routeScrollPositions.get(`key:${location.key}`) : undefined) ?? 0
          : 0;
      window.scrollTo(0, targetDetailScrollY);
      lastLiveScrollYRef.current = targetDetailScrollY;
      isTransitioningRouteRef.current = false;
    }
  }, [location, committedLocation, isMobile, navigationType]);

  // Fase 1 ('prepare') -> Fase 2 ('run'): aguarda 2 frames (layout + upload das texturas na GPU)
  // antes de disparar o transform 340ms nos dois planos simultaneamente a 60/120 FPS.
  useEffect(() => {
    if (slidePhase !== 'prepare') return;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setSlidePhase('run');
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [slidePhase]);

  useEffect(() => {
    if (slidePhase !== 'run') return;
    const timer = window.setTimeout(() => {
      setOutgoingState(null);
      setSlidePhase('idle');
    }, 355);
    return () => window.clearTimeout(timer);
  }, [slidePhase]);

  const isTransitioning = isMobile && slidePhase !== 'idle' && outgoingState !== null;
  const outgoingLocation = isTransitioning ? outgoingState.location : null;
  const outgoingScrollY = isTransitioning ? outgoingState.scrollY : 0;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const isDetailOnMobile = Boolean(isMobile && parseDetailRoute(committedLocation.pathname));
    const targetColor = isDetailOnMobile ? 'transparent' : '#000000';
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    metas.forEach((meta) => {
      if (meta.getAttribute('content') !== targetColor) {
        meta.setAttribute('content', targetColor);
      }
    });
  }, [isMobile, committedLocation.pathname]);

  const isMainTab = isMobile && tabPanelIndex(committedLocation.pathname) >= 0;
  const outgoingIsMainTab = Boolean(
    isMobile && outgoingLocation && tabPanelIndex(outgoingLocation.pathname) >= 0,
  );

  const profileMatch = isMobile
    ? parseProfileTabRoute(committedLocation.pathname, displayUsername)
    : null;
  const isProfileTab = isMobile && profileMatch !== null;
  const outgoingProfileMatch =
    isMobile && outgoingLocation
      ? parseProfileTabRoute(outgoingLocation.pathname, displayUsername)
      : null;
  const outgoingIsProfileTab = isMobile && outgoingProfileMatch !== null;

  const headerPushingOut = Boolean(
    isMobile &&
      outgoingLocation &&
      (outgoingIsMainTab || outgoingIsProfileTab || outgoingLocation.pathname === '/settings'),
  );
  const headerPathname = headerPushingOut
    ? outgoingLocation!.pathname
    : committedLocation.pathname;

  const outgoingTransformStyle: React.CSSProperties | undefined = isTransitioning
    ? {
        transform: slidePhase === 'run' ? 'translate3d(-100%, 0, 0)' : 'translate3d(0, 0, 0)',
        transition:
          slidePhase === 'run'
            ? 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1)'
            : 'none',
      }
    : undefined;

  const incomingTransformStyle: React.CSSProperties | undefined = isTransitioning
    ? {
        transform: slidePhase === 'run' ? 'translate3d(0, 0, 0)' : 'translate3d(100%, 0, 0)',
        transition:
          slidePhase === 'run'
            ? 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1)'
            : 'none',
      }
    : undefined;

  // Lista estável de painéis de rotas secundárias (ex.: /search, /actor/:id, /film/:id):
  // preserva a mesma key={panel.location.pathname} quando a rota passa de ativa para
  // sainte (isOutgoing: true), evitando desmontar e remontar a página anterior no 1º frame!
  const nonTabPanels: Array<{ location: Location; isOutgoing: boolean; scrollY: number }> = [];
  if (isMobile && outgoingLocation && !outgoingIsMainTab && !outgoingIsProfileTab) {
    nonTabPanels.push({
      location: outgoingLocation,
      isOutgoing: true,
      scrollY: outgoingScrollY,
    });
  }
  if (!isMobile || (!isMainTab && !isProfileTab)) {
    nonTabPanels.push({
      location: committedLocation,
      isOutgoing: false,
      scrollY: 0,
    });
  }

  return (
    <div className="min-h-screen bg-lb-bg md:bg-transparent text-lb-text flex flex-col selection:bg-lb-green selection:text-lb-bg">
      {/* Main Top Header */}
      <Header
        pathnameOverride={headerPathname}
        pushingOut={headerPushingOut}
        pushPhase={slidePhase}
      />

      {/* Mobile Pull-to-Refresh (estilo nativo Letterboxd / SwipeRefreshLayout) */}
      <PullToRefresh />

      {/* Main Content Viewport (pb: espaço para a BottomNav de 60px no mobile) */}
      <main className="relative flex-1 flex flex-col max-md:overflow-x-clip md:overflow-x-visible pb-[calc(60px+env(safe-area-inset-bottom,0px)+16px)] md:pb-0">
        {/* No mobile, mantém o TabViewPager das abas principais vivo em segundo plano.
            Sem `display: contents` para nunca destruir/reconstruir a árvore de layout no início do slide. */}
        {isMobile && (
          <div
            className={
              isMainTab
                ? 'w-full flex-1 flex flex-col'
                : outgoingIsMainTab
                  ? 'fixed inset-x-0 top-[100px] bottom-0 z-20 overflow-hidden pointer-events-none bg-lb-bg mw-gpu-layer'
                  : 'hidden'
            }
            style={outgoingIsMainTab ? outgoingTransformStyle : undefined}
            aria-hidden={!isMainTab}
          >
            <div
              style={
                outgoingIsMainTab
                  ? { transform: `translate3d(0, -${outgoingScrollY}px, 0)` }
                  : undefined
              }
            >
              <TabViewPager mode="main" />
            </div>
          </div>
        )}

        {isMobile && (isProfileTab || outgoingIsProfileTab) && (
          <div
            className={
              outgoingIsProfileTab && !isProfileTab
                ? 'fixed inset-x-0 top-[100px] bottom-0 z-20 overflow-hidden pointer-events-none bg-lb-bg mw-gpu-layer'
                : 'w-full flex-1 flex flex-col'
            }
            style={outgoingIsProfileTab && !isProfileTab ? outgoingTransformStyle : undefined}
          >
            <div
              style={
                outgoingIsProfileTab && !isProfileTab
                  ? { transform: `translate3d(0, -${outgoingScrollY}px, 0)` }
                  : undefined
              }
            >
              <TabViewPager
                key={`pager-profile-${(profileMatch ?? outgoingProfileMatch)!.username}`}
                mode="profile"
                profileUsername={(profileMatch ?? outgoingProfileMatch)!.username}
              />
            </div>
          </div>
        )}

        {nonTabPanels.map((panel) => {
          const isDetail =
            panel.location.pathname.startsWith('/film/') ||
            panel.location.pathname.startsWith('/tv/');
          return (
            <div
              key={panel.location.pathname}
              className={
                panel.isOutgoing
                  ? 'fixed inset-0 z-20 overflow-hidden pointer-events-none bg-lb-bg mw-gpu-layer'
                  : isTransitioning
                    ? 'relative z-30 bg-lb-bg md:bg-transparent mw-gpu-layer'
                    : isDetail
                      ? 'max-md:overflow-x-hidden'
                      : 'mw-page-in'
              }
              style={panel.isOutgoing ? outgoingTransformStyle : incomingTransformStyle}
              aria-hidden={panel.isOutgoing ? 'true' : undefined}
            >
              <div
                style={
                  panel.isOutgoing
                    ? { transform: `translate3d(0, -${panel.scrollY}px, 0)` }
                    : undefined
                }
              >
                <MemoizedRouteTree routeLocation={panel.location} />
              </div>
            </div>
          );
        })}
      </main>

      {/* MyWorld Global Modals (lazy) */}
      <GlobalModals />

      {/* Bottom Navigation (somente mobile) */}
      <BottomNav />

      {/* Main Footer (oculto no chat CINE IA para manter a barra de digitação colada embaixo) */}
      {committedLocation.pathname !== '/cine-ia' && <Footer />}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppProvider>
        {/* No build do APK (base './') o basename relativo quebraria o router */}
        <BrowserRouter basename={import.meta.env.BASE_URL === './' ? '/' : import.meta.env.BASE_URL}>
          <AppShell />
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
