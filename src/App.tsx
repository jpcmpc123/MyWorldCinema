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
import { tmdb } from './services/tmdb';
import { HomePage } from './pages/HomePage';
import { FilmPage } from './pages/FilmPage';
import { ActorPage } from './pages/ActorPage';
import { SearchPage } from './pages/SearchPage';
import { CollectionPage } from './pages/CollectionPage';

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

// Páginas secundárias com code splitting resiliente
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

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-40">
      <Loader2 className="w-8 h-8 animate-spin text-lb-green" />
    </div>
  );
}

function AnimatedRoutes({
  routeLocation,
  isOutgoing = false,
}: {
  routeLocation: Location;
  isOutgoing?: boolean;
}) {
  const isDetailRoute =
    routeLocation.pathname.startsWith('/film/') || routeLocation.pathname.startsWith('/tv/');
  return (
    <div
      key={routeLocation.pathname}
      className={
        isOutgoing
          ? ''
          : isDetailRoute
            ? 'max-md:overflow-x-hidden md:mw-page-in'
            : 'mw-page-in'
      }
    >
      <ErrorBoundary>
        <Suspense fallback={isDetailRoute ? null : <PageLoader />}>
          <Routes location={routeLocation}>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/film/:id"
              element={<FilmPage isTvRoute={false} disableSlideAnimation={isOutgoing} />}
            />
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
            <Route
              path="/tv/:id"
              element={<FilmPage isTvRoute={true} disableSlideAnimation={isOutgoing} />}
            />
            <Route path="/films/decade/:decade" element={<FilmsPage />} />
            <Route path="/films/year/:year" element={<FilmsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/diary" element={<DiaryPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/lists" element={<ListsPage />} />
            <Route path="/list/:id" element={<ListDetailPage />} />
            <Route path="/list/new" element={<CreateListPage />} />
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
    </div>
  );
}

function AppShell() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user } = useApp();
  const { isAuthenticated, profile } = useAuth();
  const displayUsername = isAuthenticated && profile ? profile.username : user.username;

  const [committedLocation, setCommittedLocation] = useState<Location>(location);
  const [outgoingState, setOutgoingState] = useState<{ location: Location; scrollY: number } | null>(null);

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
      setCommittedLocation(location);
      return;
    }

    const cached = tmdb.getCachedDetails(detail.id, detail.type);
    const isComplete = Boolean(
      cached && (cached.credits?.cast?.length || cached.credits?.crew?.length || cached.runtime),
    );

    if (isComplete) {
      const prevScroll = window.scrollY;
      setOutgoingState({ location: committedLocation, scrollY: prevScroll });
      setCommittedLocation(location);
      window.scrollTo(0, 0);
      return;
    }

    let cancelled = false;
    const prevLoc = committedLocation;
    const prevScroll = window.scrollY;

    const loadPromise =
      detail.type === 'tv' ? tmdb.getTVDetails(detail.id) : tmdb.getMovieDetails(detail.id);

    loadPromise
      .catch(() => null)
      .then(() => {
        if (cancelled) return;
        setOutgoingState({ location: prevLoc, scrollY: prevScroll });
        setCommittedLocation(location);
        window.scrollTo(0, 0);
      });

    return () => {
      cancelled = true;
    };
  }, [location, committedLocation]);

  useEffect(() => {
    if (!outgoingState) return;
    const timer = window.setTimeout(() => {
      setOutgoingState(null);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [outgoingState]);

  const outgoingLocation = outgoingState?.location ?? null;
  const outgoingScrollY = outgoingState?.scrollY ?? 0;

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

  return (
    <div className="min-h-screen bg-lb-bg text-lb-text flex flex-col selection:bg-lb-green selection:text-lb-bg">
      {/* Main Top Header */}
      <Header pathnameOverride={headerPathname} pushingOut={headerPushingOut} />

      {/* Main Content Viewport (pb: espaço para a BottomNav de 60px no mobile) */}
      <main className="relative flex-1 flex flex-col overflow-x-hidden pb-[calc(60px+env(safe-area-inset-bottom,0px)+16px)] md:pb-0">
        {/* No mobile, mantém o TabViewPager das abas principais vivo em segundo plano.
            Durante a transição para detalhes do filme, ele é empurrado suavemente para a esquerda. */}
        {isMobile && (
          <div
            className={
              isMainTab
                ? 'contents'
                : outgoingIsMainTab
                  ? 'fixed inset-x-0 top-[100px] bottom-0 z-20 overflow-hidden pointer-events-none bg-lb-bg mw-push-out-left'
                  : 'hidden'
            }
            aria-hidden={!isMainTab}
          >
            <div
              style={
                outgoingIsMainTab ? { transform: `translateY(-${outgoingScrollY}px)` } : undefined
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
                ? 'fixed inset-x-0 top-[100px] bottom-0 z-20 overflow-hidden pointer-events-none bg-lb-bg mw-push-out-left'
                : 'contents'
            }
          >
            <div
              style={
                outgoingIsProfileTab && !isProfileTab
                  ? { transform: `translateY(-${outgoingScrollY}px)` }
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

        {/* Se a página anterior era uma rota normal (ex.: /search, /actor/:id, outro filme),
            empurra ela para a esquerda sincronizada com a entrada do novo filme */}
        {isMobile && outgoingLocation && !outgoingIsMainTab && !outgoingIsProfileTab && (
          <div
            key={`outgoing-${outgoingLocation.pathname}`}
            className="fixed inset-0 z-20 overflow-hidden pointer-events-none bg-lb-bg mw-push-out-left"
            aria-hidden="true"
          >
            <div style={{ transform: `translateY(-${outgoingScrollY}px)` }}>
              <AnimatedRoutes routeLocation={outgoingLocation} isOutgoing />
            </div>
          </div>
        )}

        {(!isMobile || (!isMainTab && !isProfileTab)) && (
          <AnimatedRoutes routeLocation={committedLocation} />
        )}
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
