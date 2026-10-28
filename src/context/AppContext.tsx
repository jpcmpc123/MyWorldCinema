import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
  useSyncExternalStore,
} from 'react';
import { createMovieStore, type MovieSnapshot } from '../store/movieStore';
import type { UserProfile, LogEntry, MovieList, Review } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  guestUser,
  type AppContextType,
  type ListImportOptions,
  type MovieMetaCache,
  type MovieShort,
  type ProfileImportPayloadItem,
  type ProfileImportSummary,
} from './app/types';
import {
  clearAllGuestStorageKeys,
  readLocalJson,
  scheduleStorageWrite,
} from './app/storageScheduler';
import {
  deleteRemoteLog,
  fetchRemoteAccountSnapshot,
  persistFullLogRemote,
  persistMovieOverrideRemote,
  persistQuickLogRemote,
  persistTop4Remote,
  persistWatchlistAddRemote,
  persistWatchlistRemoveRemote,
} from './app/supabaseSync';
import {
  executeListImport,
  executeProfileImport,
  executeWatchlistImport,
} from './app/importEngine';

export type {
  ProfileImportPayloadItem,
  ProfileImportSummary,
  ListImportOptions,
};

const initialLogs: LogEntry[] = [];
const initialWatchedIds: number[] = [];
const initialLikedIds: number[] = [];
const initialRatings: Record<number, number> = {};
const initialReviewsList: Review[] = [];

const AppContext = createContext<AppContextType | undefined>(undefined);

// Armazenamento por filme: alimentado pelo provider, lido pelos PosterCard
// via useMovieState (cada cartão só re-renderiza quando o próprio filme muda).
const movieStore = createMovieStore();

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser, profile, isAuthenticated } = useAuth();

  // Movie metadata cache so quick toggles (watched/like/rating by id) can
  // still persist meaningful rows to Supabase.
  const movieMetaRef = useRef<MovieMetaCache>({});
  const rememberMovie = useCallback(
    (m: {
      id: number;
      title?: string;
      poster_path?: string | null;
      release_date?: string;
      movieTitle?: string;
      moviePoster?: string | null;
      movieYear?: string | number;
    }) => {
      const year =
        m.release_date?.slice(0, 4) ?? (m.movieYear ? String(m.movieYear).slice(0, 4) : '');
      movieMetaRef.current[m.id] = {
        title: m.title ?? m.movieTitle ?? movieMetaRef.current[m.id]?.title ?? '',
        poster:
          m.poster_path !== undefined
            ? m.poster_path
            : (m.moviePoster ?? movieMetaRef.current[m.id]?.poster ?? null),
        year: year ? parseInt(year, 10) : (movieMetaRef.current[m.id]?.year ?? null),
      };
    },
    [],
  );

  // AuthProvider já garante que a sessão foi resolvida antes deste mount,
  // então isAuthenticated é confiável aqui. DESLOGADO → estado visitante vazio.
  const [user, setUser] = useState<UserProfile>(() => {
    if (!isAuthenticated) return guestUser;
    const parsed = readLocalJson<UserProfile | null>(
      'lb_user',
      null,
      (v): v is UserProfile => typeof v === 'object' && v !== null && 'username' in v,
    );
    if (!parsed || parsed.username === 'cinephile' || parsed.username === 'jpcmpc23') {
      return guestUser;
    }
    return parsed;
  });

  const [logs, setLogs] = useState<LogEntry[]>(() => {
    if (!isAuthenticated) return initialLogs;
    return readLocalJson<LogEntry[]>('lb_logs', initialLogs, Array.isArray);
  });

  const [watchlist, setWatchlist] = useState<MovieShort[]>(() => {
    if (!isAuthenticated) return [];
    return readLocalJson<MovieShort[]>('lb_watchlist', [], Array.isArray);
  });

  const [watchedMovieIds, setWatchedMovieIds] = useState<number[]>(() => {
    if (!isAuthenticated) return initialWatchedIds;
    return readLocalJson<number[]>('lb_watched', initialWatchedIds, Array.isArray);
  });

  const [likedMovieIds, setLikedMovieIds] = useState<number[]>(() => {
    if (!isAuthenticated) return initialLikedIds;
    return readLocalJson<number[]>('lb_likes', initialLikedIds, Array.isArray);
  });

  const [ratingsMap, setRatingsMap] = useState<Record<number, number>>(() => {
    if (!isAuthenticated) return initialRatings;
    return readLocalJson<Record<number, number>>(
      'lb_ratings',
      initialRatings,
      (v): v is Record<number, number> => typeof v === 'object' && v !== null && !Array.isArray(v),
    );
  });

  const [top4MovieIds, setTop4MovieIds] = useState<number[]>(() => {
    if (!isAuthenticated) return guestUser.top4MovieIds;
    const parsed = readLocalJson<number[]>('lb_top4', guestUser.top4MovieIds, Array.isArray);
    if (parsed.includes(157336)) return guestUser.top4MovieIds;
    return parsed;
  });

  const [lists, setLists] = useState<MovieList[]>(() => {
    if (!isAuthenticated) return [];
    return readLocalJson<MovieList[]>('lb_lists', [], Array.isArray);
  });

  const [reviews, setReviews] = useState<Review[]>(() => {
    if (!isAuthenticated) return [];
    return readLocalJson<Review[]>('lb_reviews', initialReviewsList, Array.isArray);
  });

  const [movieOverrides, setMovieOverrides] = useState<
    Record<number, { poster?: string; backdrop?: string }>
  >(() =>
    readLocalJson<Record<number, { poster?: string; backdrop?: string }>>(
      'lb_movie_overrides',
      {},
      (v): v is Record<number, { poster?: string; backdrop?: string }> =>
        typeof v === 'object' && v !== null && !Array.isArray(v),
    ),
  );

  // Índices Set O(1) sincronizados para consultas instantâneas sem percorrer arrays
  const watchedSet = useMemo(() => new Set(watchedMovieIds), [watchedMovieIds]);
  const likedSet = useMemo(() => new Set(likedMovieIds), [likedMovieIds]);
  const watchlistIds = useMemo(() => watchlist.map((m) => m.id), [watchlist]);
  const watchlistSet = useMemo(() => new Set(watchlistIds), [watchlistIds]);

  const userRef = useRef(user);
  userRef.current = user;
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;
  const watchedIdsRef = useRef(watchedMovieIds);
  watchedIdsRef.current = watchedMovieIds;
  const likedIdsRef = useRef(likedMovieIds);
  likedIdsRef.current = likedMovieIds;
  const watchedSetRef = useRef(watchedSet);
  watchedSetRef.current = watchedSet;
  const likedSetRef = useRef(likedSet);
  likedSetRef.current = likedSet;
  const watchlistSetRef = useRef(watchlistSet);
  watchlistSetRef.current = watchlistSet;
  const overridesRef = useRef(movieOverrides);
  overridesRef.current = movieOverrides;
  const logsRef = useRef(logs);
  logsRef.current = logs;
  const listsRef = useRef(lists);
  listsRef.current = lists;

  const setMovieOverride = useCallback(
    (movieId: number, override: { poster?: string; backdrop?: string }) => {
      const next = { ...(overridesRef.current[movieId] || {}), ...override };

      setMovieOverrides((prev) => {
        const merged = { ...prev[movieId], ...override };
        if (!merged.poster && !merged.backdrop) {
          const { [movieId]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [movieId]: merged };
      });

      if (supabase && isAuthenticated && authUser) {
        void persistMovieOverrideRemote(authUser.id, movieId, next);
      }
    },
    [isAuthenticated, authUser],
  );

  // Modal controls
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedMovieForLog, setSelectedMovieForLog] = useState<MovieShort | null>(null);
  const [isTop4PickerOpen, setIsTop4PickerOpen] = useState(false);
  const [activeTop4Slot, setActiveTop4Slot] = useState<number | null>(null);
  const [actionSheetMovie, setActionSheetMovie] = useState<{
    id: number;
    title: string;
    release_date?: string;
  } | null>(null);

  // Sync with LocalStorage (agendado em idle para não travar scroll/toques)
  useEffect(() => {
    scheduleStorageWrite('lb_user', user);
  }, [user]);
  useEffect(() => {
    scheduleStorageWrite('lb_logs', logs);
  }, [logs]);
  useEffect(() => {
    scheduleStorageWrite('lb_watchlist', watchlist);
  }, [watchlist]);
  useEffect(() => {
    scheduleStorageWrite('lb_watched', watchedMovieIds);
  }, [watchedMovieIds]);
  useEffect(() => {
    scheduleStorageWrite('lb_likes', likedMovieIds);
  }, [likedMovieIds]);
  useEffect(() => {
    scheduleStorageWrite('lb_ratings', ratingsMap);
  }, [ratingsMap]);
  useEffect(() => {
    scheduleStorageWrite('lb_top4', top4MovieIds);
  }, [top4MovieIds]);
  useEffect(() => {
    scheduleStorageWrite('lb_lists', lists);
  }, [lists]);
  useEffect(() => {
    scheduleStorageWrite('lb_reviews', reviews);
  }, [reviews]);
  useEffect(() => {
    if (isAuthenticated) return;
    scheduleStorageWrite('lb_movie_overrides', movieOverrides);
  }, [movieOverrides, isAuthenticated]);

  // ────────────────────────────────────────────────────────────────
  // Supabase integration — ativa apenas quando há usuário autenticado
  // ────────────────────────────────────────────────────────────────
  const syncedUserIdRef = useRef<string | null>(null);
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !authUser || !profile) return;
    setUser((prev) => ({
      ...prev,
      id: authUser.id,
      username: profile.username,
      displayName: profile.display_name || profile.username,
      avatarUrl: profile.avatar_url || prev.avatarUrl,
      bio: profile.bio || prev.bio,
    }));
  }, [isAuthenticated, authUser, profile]);

  useEffect(() => {
    if (!supabase || !isAuthenticated || !authUser) {
      syncedUserIdRef.current = null;
      setSyncedUserId(null);
      setUser(guestUser);
      setLogs([]);
      setWatchedMovieIds([]);
      setLikedMovieIds([]);
      setRatingsMap({});
      setReviews([]);
      setWatchlist([]);
      setLists([]);
      setTop4MovieIds([0, 0, 0, 0]);
      setMovieOverrides({});
      clearAllGuestStorageKeys();
      return;
    }

    const isInitialSync = syncedUserIdRef.current !== authUser.id;
    syncedUserIdRef.current = authUser.id;

    if (isInitialSync) {
      setLogs([]);
      setWatchedMovieIds([]);
      setLikedMovieIds([]);
      setRatingsMap({});
      setReviews([]);
      setWatchlist([]);
      setTop4MovieIds([0, 0, 0, 0]);
      setMovieOverrides({});
    }

    const loadRemoteData = async () => {
      const snapshot = await fetchRemoteAccountSnapshot(authUser.id, profile, rememberMovie);
      if (snapshot.overrides) setMovieOverrides(snapshot.overrides);
      if (snapshot.top4Ids) setTop4MovieIds(snapshot.top4Ids);
      if (snapshot.logsData) {
        setLogs(snapshot.logsData.logs);
        setWatchedMovieIds(snapshot.logsData.watchedIds);
        setLikedMovieIds(snapshot.logsData.likedIds);
        setRatingsMap(snapshot.logsData.ratingsMap);
        setReviews(snapshot.logsData.reviews);
      }
      if (snapshot.watchlist) setWatchlist(snapshot.watchlist);
    };

    if (isInitialSync) {
      void loadRemoteData()
        .catch((err) => console.error('Supabase remote load failed:', err))
        .finally(() => setSyncedUserId(authUser.id));
    }

    const onPullToRefresh = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ registerPromise?: (p: Promise<unknown>) => void }>;
      const task = loadRemoteData().catch((err) => {
        console.error('Supabase pull-to-refresh failed:', err);
      });
      customEvt.detail?.registerPromise?.(task);
    };
    window.addEventListener('mw:pull-to-refresh', onPullToRefresh);

    return () => {
      window.removeEventListener('mw:pull-to-refresh', onPullToRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authUser?.id]);

  const updateUser = useCallback((updates: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  }, []);

  const saveLog = useCallback(
    (entry: Omit<LogEntry, 'id' | 'createdAt'>) => {
      const newId = `log-${Date.now()}`;
      const newEntry: LogEntry = {
        ...entry,
        id: newId,
        createdAt: new Date().toISOString(),
      };

      setLogs((prev) => [newEntry, ...prev]);

      if (!watchedSetRef.current.has(entry.movieId)) {
        setWatchedMovieIds((prev) => [entry.movieId, ...prev]);
      }

      if (entry.liked && !likedSetRef.current.has(entry.movieId)) {
        setLikedMovieIds((prev) => [entry.movieId, ...prev]);
      } else if (!entry.liked && likedSetRef.current.has(entry.movieId)) {
        setLikedMovieIds((prev) => prev.filter((id) => id !== entry.movieId));
      }

      if (entry.rating > 0) {
        setRatingsMap((prev) => ({ ...prev, [entry.movieId]: entry.rating }));
      }

      if (entry.reviewText.trim()) {
        const u = userRef.current;
        const review: Review = {
          id: `rev-${newId}`,
          movieId: entry.movieId,
          movieTitle: entry.movieTitle,
          moviePoster: entry.moviePoster,
          movieYear: entry.movieYear,
          author: {
            username: u.username,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl,
            isPro: u.isPro,
          },
          rating: entry.rating,
          liked: entry.liked,
          content: entry.reviewText,
          containsSpoilers: entry.containsSpoilers,
          watchedDate: entry.watchedDate,
          likesCount: 1,
          commentsCount: 0,
          createdAt: new Date().toISOString(),
        };
        setReviews((prev) => [review, ...prev]);
      }

      rememberMovie({
        id: entry.movieId,
        movieTitle: entry.movieTitle,
        moviePoster: entry.moviePoster,
        movieYear: entry.movieYear,
      });

      if (isAuthenticated && authUser) {
        void persistFullLogRemote(authUser.id, entry, movieMetaRef.current, (realId) => {
          setLogs((prev) => prev.map((l) => (l.id === newId ? { ...l, id: realId } : l)));
          setReviews((prev) =>
            prev.map((r) => (r.id === `rev-${newId}` ? { ...r, id: `rev-${realId}` } : r)),
          );
        });
      }
    },
    [isAuthenticated, authUser, rememberMovie],
  );

  const deleteLog = useCallback(
    (id: string) => {
      const currentLogs = logsRef.current;
      const target = currentLogs.find((item) => item.id === id);
      const remaining = currentLogs.filter((item) => item.id !== id);
      setLogs(remaining);
      setReviews((prev) => prev.filter((r) => r.id !== `rev-${id}`));

      if (target) {
        const movieLogsLeft = remaining.filter((item) => item.movieId === target.movieId);
        if (movieLogsLeft.length === 0) {
          setWatchedMovieIds((prev) => prev.filter((mId) => mId !== target.movieId));
          setLikedMovieIds((prev) => prev.filter((mId) => mId !== target.movieId));
          setRatingsMap((prev) => {
            const { [target.movieId]: _removed, ...rest } = prev;
            return rest;
          });
        } else {
          const latestRated = movieLogsLeft.find((l) => l.rating > 0);
          setRatingsMap((prev) => {
            if (latestRated) return { ...prev, [target.movieId]: latestRated.rating };
            const { [target.movieId]: _removed, ...rest } = prev;
            return rest;
          });
          const anyLiked = movieLogsLeft.some((l) => l.liked);
          if (!anyLiked) {
            setLikedMovieIds((prev) => prev.filter((mId) => mId !== target.movieId));
          }
        }
      }

      if (isAuthenticated && authUser && !id.startsWith('log-')) {
        void deleteRemoteLog(authUser.id, id);
      }
    },
    [isAuthenticated, authUser],
  );

  const toggleWatchlist = useCallback(
    (movie: MovieShort) => {
      const exists = watchlistSetRef.current.has(movie.id);
      rememberMovie(movie);
      setWatchlist((prev) => {
        const wasInList = prev.some((m) => m.id === movie.id);
        if (wasInList) {
          return prev.filter((m) => m.id !== movie.id);
        }
        return [movie, ...prev];
      });
      if (isAuthenticated && authUser) {
        if (exists) {
          void persistWatchlistRemoveRemote(authUser.id, movie.id);
        } else {
          void persistWatchlistAddRemote(authUser.id, movie, movieMetaRef.current);
        }
      }
    },
    [isAuthenticated, authUser, rememberMovie],
  );

  const isMovieInWatchlist = useCallback((movieId: number) => {
    return watchlistSetRef.current.has(movieId);
  }, []);

  const toggleWatched = useCallback(
    (movieId: number) => {
      const wasWatched = watchedSetRef.current.has(movieId);
      setWatchedMovieIds((prev) =>
        prev.includes(movieId) ? prev.filter((id) => id !== movieId) : [movieId, ...prev],
      );
      if (isAuthenticated && authUser) {
        void persistQuickLogRemote(
          authUser.id,
          movieId,
          { watched: !wasWatched },
          movieMetaRef.current,
        );
      }
    },
    [isAuthenticated, authUser],
  );

  const isMovieWatched = useCallback((movieId: number) => {
    return watchedSetRef.current.has(movieId);
  }, []);

  const toggleLikeMovie = useCallback(
    (movieId: number) => {
      const wasLiked = likedSetRef.current.has(movieId);
      setLikedMovieIds((prev) =>
        prev.includes(movieId) ? prev.filter((id) => id !== movieId) : [movieId, ...prev],
      );
      if (isAuthenticated && authUser && watchedSetRef.current.has(movieId)) {
        void persistQuickLogRemote(
          authUser.id,
          movieId,
          { liked: !wasLiked },
          movieMetaRef.current,
        );
      }
    },
    [isAuthenticated, authUser],
  );

  const isMovieLiked = useCallback((movieId: number) => {
    return likedSetRef.current.has(movieId);
  }, []);

  const setMovieRating = useCallback(
    (movieId: number, rating: number) => {
      if (rating <= 0) {
        setRatingsMap((prev) => {
          const { [movieId]: _removed, ...rest } = prev;
          return rest;
        });
        if (isAuthenticated && authUser) {
          void persistQuickLogRemote(authUser.id, movieId, { rating: 0 }, movieMetaRef.current);
        }
        return;
      }
      setRatingsMap((prev) => ({ ...prev, [movieId]: rating }));
      if (!watchedSetRef.current.has(movieId)) {
        setWatchedMovieIds((prev) => [movieId, ...prev]);
      }
      if (isAuthenticated && authUser) {
        void persistQuickLogRemote(authUser.id, movieId, { rating }, movieMetaRef.current);
      }
    },
    [isAuthenticated, authUser],
  );

  const setTop4Movie = useCallback(
    (slotIndex: number, movieId: number) => {
      setTop4MovieIds((prev) => {
        const updated = [...prev];
        updated[slotIndex] = movieId;
        if (isAuthenticated && authUser) {
          void persistTop4Remote(authUser.id, updated);
        }
        return updated;
      });
    },
    [isAuthenticated, authUser],
  );

  const createList = useCallback(
    (
      newList: Omit<MovieList, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>,
    ): string => {
      const u = userRef.current;
      const list: MovieList = {
        ...newList,
        id: `list-${Date.now()}`,
        author: {
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
        },
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
      };
      setLists((prev) => [list, ...prev]);
      return list.id;
    },
    [],
  );

  const updateList = useCallback(
    (
      listId: string,
      updates: Omit<MovieList, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>,
    ) => {
      setLists((prev) =>
        prev.map((l) =>
          l.id === listId
            ? {
                ...l,
                ...updates,
              }
            : l,
        ),
      );
    },
    [],
  );

  const deleteList = useCallback((listId: string) => {
    setLists((prev) => prev.filter((l) => l.id !== listId));
  }, []);

  const addReview = useCallback(
    (newReview: Omit<Review, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>) => {
      const u = userRef.current;
      const rev: Review = {
        ...newReview,
        id: `rev-${Date.now()}`,
        author: {
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          isPro: u.isPro,
        },
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
      };
      setReviews((prev) => [rev, ...prev]);
    },
    [],
  );

  const openLogModal = useCallback((movie?: MovieShort) => {
    setSelectedMovieForLog(movie || null);
    setIsLogModalOpen(true);
  }, []);

  const closeLogModal = useCallback(() => {
    setIsLogModalOpen(false);
    setSelectedMovieForLog(null);
  }, []);

  const openTop4Picker = useCallback((slotIndex: number) => {
    setActiveTop4Slot(slotIndex);
    setIsTop4PickerOpen(true);
  }, []);

  const closeTop4Picker = useCallback(() => {
    setIsTop4PickerOpen(false);
    setActiveTop4Slot(null);
  }, []);

  const openActionSheet = useCallback(
    (movie: { id: number; title: string; release_date?: string }) => {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
      setActionSheetMovie(movie);
    },
    [],
  );

  const closeActionSheet = useCallback(() => {
    setActionSheetMovie(null);
  }, []);

  // Registra a ação de abrir a gaveta e ações rápidas para os atalhos estáveis
  useLayoutEffect(() => {
    openSheetImpl = openActionSheet;
    movieActionsImpl = {
      toggleWatched,
      toggleLikeMovie,
      setMovieRating,
      toggleWatchlist,
      openLogModal,
    };
  }, [openActionSheet, toggleWatched, toggleLikeMovie, setMovieRating, toggleWatchlist, openLogModal]);

  // Alimenta o armazenamento por filme e notifica só os cartões que mudaram.
  // useLayoutEffect: a atualização chega antes do paint, sem flicker.
  useLayoutEffect(() => {
    movieStore.setState({
      watchedIds: watchedMovieIds,
      likedIds: likedMovieIds,
      watchlistIds,
      ratings: ratingsMap,
      overrides: movieOverrides,
    });
    movieStore.flush();
  }, [watchedMovieIds, likedMovieIds, watchlistIds, ratingsMap, movieOverrides]);

  const importToProfile = useCallback(
    async (items: ProfileImportPayloadItem[]): Promise<ProfileImportSummary> => {
      if (items.length === 0) {
        return {
          watchedCount: 0,
          diaryCreatedCount: 0,
          diaryUpdatedCount: 0,
          reviewsCount: 0,
          ratingsCount: 0,
        };
      }

      const res = await executeProfileImport({
        items,
        currentLogs: logsRef.current,
        currentWatchedIds: watchedIdsRef.current,
        currentLikedIds: likedIdsRef.current,
        currentUser: userRef.current,
        authUserId: isAuthenticated && authUser ? authUser.id : null,
        rememberMovie,
      });

      setLogs(res.nextLogs);
      setWatchedMovieIds(res.nextWatchedIds);
      setLikedMovieIds(res.nextLikedIds);
      if (Object.keys(res.nextRatings).length > 0) {
        setRatingsMap((prev) => ({ ...prev, ...res.nextRatings }));
      }
      setReviews(res.updatedReviews);

      return res.summary;
    },
    [isAuthenticated, authUser, rememberMovie],
  );

  const importToWatchlist = useCallback(
    async (movies: MovieShort[]): Promise<{ addedCount: number; skippedCount: number }> => {
      const res = await executeWatchlistImport({
        movies,
        currentWatchlist: watchlistRef.current,
        authUserId: isAuthenticated && authUser ? authUser.id : null,
        rememberMovie,
      });

      if (res.toAdd.length > 0) {
        setWatchlist((prev) => [...res.toAdd, ...prev]);
      }

      return { addedCount: res.addedCount, skippedCount: res.skippedCount };
    },
    [isAuthenticated, authUser, rememberMovie],
  );

  const importToList = useCallback(
    async (
      options: ListImportOptions,
    ): Promise<{ listId: string; totalCount: number; addedCount: number }> => {
      return executeListImport({
        options,
        currentLists: listsRef.current,
        createList,
        updateList,
        importToProfile,
      });
    },
    [createList, updateList, importToProfile],
  );

  const value = useMemo<AppContextType>(
    () => ({
      user,
      updateUser,
      logs,
      saveLog,
      deleteLog,
      watchlist,
      toggleWatchlist,
      isMovieInWatchlist,
      watchedMovieIds,
      toggleWatched,
      isMovieWatched,
      likedMovieIds,
      toggleLikeMovie,
      isMovieLiked,
      ratingsMap,
      setMovieRating,
      top4MovieIds,
      setTop4Movie,
      lists,
      createList,
      updateList,
      deleteList,
      reviews,
      addReview,
      movieOverrides,
      setMovieOverride,
      importToProfile,
      importToWatchlist,
      importToList,
      isLogModalOpen,
      selectedMovieForLog,
      openLogModal,
      closeLogModal,
      isTop4PickerOpen,
      activeTop4Slot,
      openTop4Picker,
      closeTop4Picker,
      actionSheetMovie,
      openActionSheet,
      closeActionSheet,
    }),
    [
      user,
      updateUser,
      logs,
      saveLog,
      deleteLog,
      watchlist,
      toggleWatchlist,
      isMovieInWatchlist,
      watchedMovieIds,
      toggleWatched,
      isMovieWatched,
      likedMovieIds,
      toggleLikeMovie,
      isMovieLiked,
      ratingsMap,
      setMovieRating,
      top4MovieIds,
      setTop4Movie,
      lists,
      createList,
      updateList,
      deleteList,
      reviews,
      addReview,
      movieOverrides,
      setMovieOverride,
      importToProfile,
      importToWatchlist,
      importToList,
      isLogModalOpen,
      selectedMovieForLog,
      openLogModal,
      closeLogModal,
      isTop4PickerOpen,
      activeTop4Slot,
      openTop4Picker,
      closeTop4Picker,
      actionSheetMovie,
      openActionSheet,
      closeActionSheet,
    ],
  );

  // Gate: autenticado mas dados remotos ainda não sincronizados → spinner.
  if (isAuthenticated && authUser && syncedUserId !== authUser.id) {
    return (
      <div className="min-h-screen bg-[#14181c] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#00e054] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

/**
 * Estado de um único filme (assistido / curtido / nota / pôster). Usar nos
 * cartões em vez de useApp(): só re-renderiza quando ESTE filme muda.
 */
export const useMovieState = (movieId: number): MovieSnapshot => {
  const subscribe = useCallback(
    (listener: () => void) => movieStore.subscribe(movieId, listener),
    [movieId],
  );
  const getSnapshot = useCallback(() => movieStore.get(movieId), [movieId]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

/**
 * Abrir a gaveta de ações sem assinar o contexto. A função é a mesma por toda a
 * vida do app (módulo), então o cartão não re-renderiza com mudanças de dados.
 */
type OpenSheet = (movie: { id: number; title: string; release_date?: string }) => void;
let openSheetImpl: OpenSheet | null = null;
const openSheetStable: OpenSheet = (movie) => {
  if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
  openSheetImpl?.(movie);
};
export const useOpenActionSheet = (): OpenSheet => openSheetStable;

interface MovieActions {
  toggleWatched: (movieId: number) => void;
  toggleLikeMovie: (movieId: number) => void;
  setMovieRating: (movieId: number, rating: number) => void;
  toggleWatchlist: (movie: MovieShort) => void;
  openLogModal: (movie?: MovieShort) => void;
}
let movieActionsImpl: MovieActions | null = null;
const movieActionsStable: MovieActions = {
  toggleWatched: (id) => movieActionsImpl?.toggleWatched(id),
  toggleLikeMovie: (id) => movieActionsImpl?.toggleLikeMovie(id),
  setMovieRating: (id, rating) => movieActionsImpl?.setMovieRating(id, rating),
  toggleWatchlist: (movie) => movieActionsImpl?.toggleWatchlist(movie),
  openLogModal: (movie) => movieActionsImpl?.openLogModal(movie),
};
export const useMovieActions = (): MovieActions => movieActionsStable;

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
