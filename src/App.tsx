import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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

// Code splitting com retry resiliente
const HomePage = lazyWithRetry(() => import('./pages/HomePage'), 'HomePage');
const FilmPage = lazyWithRetry(() => import('./pages/FilmPage'), 'FilmPage');
const ActorPage = lazyWithRetry(() => import('./pages/ActorPage'), 'ActorPage');
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
const SearchPage = lazyWithRetry(() => import('./pages/SearchPage'), 'SearchPage');
const BrowseDrilldownPage = lazyWithRetry(() => import('./pages/BrowseDrilldownPage'), 'BrowseDrilldownPage');
const BrowseResultsPage = lazyWithRetry(() => import('./pages/BrowseResultsPage'), 'BrowseResultsPage');


// Pré-carrega o chunk da página de detalhes em background para navegação instantânea
import('./pages/FilmPage').catch(() => {});

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-40">
      <Loader2 className="w-8 h-8 animate-spin text-lb-green" />
    </div>
  );
}

// Entrada suave por mudança de pathname.
// Para rotas de filmes e séries no celular, o slide horizontal da esquerda para a direita
// roda sem interferência de mw-page-in e sem o spinner redondo.
function AnimatedRoutes() {
  const location = useLocation();
  const isDetailRoute = location.pathname.startsWith('/film/') || location.pathname.startsWith('/tv/');
  return (
    <div key={location.pathname} className={isDetailRoute ? 'max-md:overflow-x-hidden md:mw-page-in' : 'mw-page-in'}>
      <ErrorBoundary>
        <Suspense fallback={isDetailRoute ? null : <PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/film/:id" element={<FilmPage />} />
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
            <Route path="/tv/:id" element={<FilmPage />} />
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

// Conteúdo principal: no mobile, tanto as 4 abas principais (FILMES / SÉRIES /
// CRÍTICAS / LISTAS) quanto as 4 abas do perfil (PERFIL / DIÁRIO / LISTAS /
// WATCHLIST) vivem numa ESTEIRA HORIZONTAL (ViewPager) que desliza ao tocar ou
// puxar com o dedo.
function MainContent() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user } = useApp();
  const { isAuthenticated, profile } = useAuth();
  const displayUsername = isAuthenticated && profile ? profile.username : user.username;

  const isMainTab = isMobile && tabPanelIndex(location.pathname) >= 0;
  const profileMatch = isMobile ? parseProfileTabRoute(location.pathname, displayUsername) : null;
  const isProfileTab = isMobile && profileMatch !== null;

  return (
    <>
      {/* No mobile, mantém o TabViewPager das abas principais vivo em segundo plano
          para que ao voltar de um filme/detalhe o estado e o scroll estejam 100% preservados */}
      {isMobile && (
        <div className={isMainTab ? 'contents' : 'hidden'} aria-hidden={!isMainTab}>
          <TabViewPager mode="main" />
        </div>
      )}
      {isMobile && isProfileTab && (
        <TabViewPager
          key={`pager-profile-${profileMatch!.username}`}
          mode="profile"
          profileUsername={profileMatch!.username}
        />
      )}
      {(!isMobile || (!isMainTab && !isProfileTab)) && <AnimatedRoutes />}
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
    <AppProvider>
      {/* No build do APK (base './') o basename relativo quebraria o router */}
      <BrowserRouter basename={import.meta.env.BASE_URL === './' ? '/' : import.meta.env.BASE_URL}>
        <div className="min-h-screen bg-lb-bg text-lb-text flex flex-col selection:bg-lb-green selection:text-lb-bg">
          {/* Main Top Header */}
          <Header />

          {/* Main Content Viewport (pb: espaço para a BottomNav de 60px no mobile) */}
          <main className="flex-1 flex flex-col pb-[calc(60px+env(safe-area-inset-bottom,0px)+16px)] md:pb-0">
            <MainContent />
          </main>

          {/* MyWorld Global Modals (lazy) */}
          <GlobalModals />

          {/* Bottom Navigation (somente mobile) */}
          <BottomNav />

          {/* Main Footer */}
          <Footer />
        </div>
      </BrowserRouter>
    </AppProvider>
    </AuthProvider>
  );
}

export default App;
