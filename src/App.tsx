import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, type Location } from 'react-router-dom';
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

function parseDetailRoute(pathname: string): { type: 'movie' | 'tv'; id: number } | null {
  const m = pathname.match(/^\/(film|tv)\/(\d+)/);
  if (!m) return null;
  return { type: m[1] === 'tv' ? 'tv' : 'movie', id: Number(m[2]) };
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

// Páginas secundárias e de detalhes com code splitting resiliente
const FilmPage = lazyWithRetry(() => import('./pages/FilmPage'), 'FilmPage');
const ActorPage = lazyWithRetry(() => import('./pages/ActorPage'), 'ActorPage');
const SearchPage = lazyWithRetry(() => import('./pages/SearchPage'), 'SearchPage');
const CollectionPage = lazyWithRetry(() => import('./pages/CollectionPage'), 'CollectionPage');
const FilmsHubPage = lazyWithRetry(() => import('./pages/FilmsHubPage'), 'FilmsHubPage');
const FilmsPage = lazyWithRetry(() => import('./pages/FilmsPage'), 'FilmsPage');
const SeriesHubPage = lazyWithRetry(() => import('./pages/SeriesHubPage'), 'SeriesHubPage');
const SeriesPage = lazyWithRetry(() => import('./pages/SeriesPage'), 'SeriesPage');
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'), 'ProfilePage');
const DiaryPage = lazyWithRetry(() => import('./pages/DiaryPage'), 'DiaryPage');
const WatchlistPage = lazyWithRetry(() => import('./pages/WatchlistPage'), 'WatchlistPage');
const ListsPage = lazyWithRetry(() => import('./pages/ListsPage'), 'ListsPage');
const ListDetailPage = lazyWithRetry(() => import('./pages/ListDetailPage'), 'ListDetailPage');
const CreateListPage = lazyWithRetry(() => import('./pages/CreateListPage'), 'CreateListPage');
const AuthPage = lazyWithRetry(() => import('./pages/AuthPage'), 'AuthPage');
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage'), 'SettingsPage');
const BrowseDrilldownPage = lazyWithRetry(() => import('./pages/BrowseDrilldownPage'), 'BrowseDrilldownPage');
const BrowseResultsPage = lazyWithRetry(() => import('./pages/BrowseResultsPage'), 'BrowseResultsPage');

// Pré-aquece os chunks de navegação mais comuns em background após o 1º paint
if (typeof window !== 'undefined') {
  const warmRoutes = () => {
    void import('./pages/FilmPage');
    void import('./pages/SearchPage');
    void import('./pages/ActorPage');
  };
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(warmRoutes, { timeout: 2000 });
  } else {
    window.setTimeout(warmRoutes, 1200);
  }
}

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
            <Route path="/lists" element={<ListsPage />} />
            <Route path="/list/new" element={<CreateListPage />} />
            <Route path="/list/:id/edit" element={<CreateListPage />} />
            <Route path="/list/:id" element={<ListDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
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
  const isMobile = useIsMobile();
  const { user } = useApp();
  const { isAuthenticated, profile } = useAuth();
  const displayUsername = isAuthenticated && profile ? profile.username : user.username;

  const [committedLocation, setCommittedLocation] = useState<Location>(location);
  const [outgoingState, setOutgoingState] = useState<{ location: Location; scrollY: number } | null>(null);
  const [slidePhase, setSlidePhase] = useState<'idle' | 'prepare' | 'run'>('idle');

  useEffect(() => {
    if (
      location.pathname === committedLocation.pathname &&
      location.search === committedLocation.search
    ) {
      return;
    }

    // Se apenas a query string mudou na mesma rota (ex.: digitação em /search?q=...)
    if (location.pathname === committedLocation.pathname) {
      setCommittedLocation(location);
      return;
    }

    const detail = parseDetailRoute(location.pathname);
    if (!detail) {
      setOutgoingState(null);
      setSlidePhase('idle');
      setCommittedLocation(location);
      window.scrollTo(0, 0);
      return;
    }

    const prevLoc = committedLocation;
    const prevScroll = window.scrollY;

    if (isMobile) {
      setOutgoingState({ location: prevLoc, scrollY: prevScroll });
      setSlidePhase('prepare');
      setCommittedLocation(location);
      window.scrollTo(0, 0);
    } else {
      setOutgoingState(null);
      setSlidePhase('idle');
      setCommittedLocation(location);
      window.scrollTo(0, 0);
    }
  }, [location, committedLocation, isMobile]);

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

      {/* Main Footer */}
      <Footer />
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
