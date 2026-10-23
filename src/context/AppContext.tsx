import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect, useSyncExternalStore } from 'react';
import { createMovieStore, type MovieSnapshot } from '../store/movieStore';
import type { UserProfile, LogEntry, MovieList, Review } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface MovieShort {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
}

interface AppContextType {
  user: UserProfile;
  updateUser: (updates: Partial<UserProfile>) => void;
  logs: LogEntry[];
  saveLog: (entry: Omit<LogEntry, 'id' | 'createdAt'>) => void;
  deleteLog: (id: string) => void;
  watchlist: MovieShort[];
  toggleWatchlist: (movie: MovieShort) => void;
  isMovieInWatchlist: (movieId: number) => boolean;
  watchedMovieIds: number[];
  toggleWatched: (movieId: number) => void;
  isMovieWatched: (movieId: number) => boolean;
  likedMovieIds: number[];
  toggleLikeMovie: (movieId: number) => void;
  isMovieLiked: (movieId: number) => boolean;
  ratingsMap: Record<number, number>;
  setMovieRating: (movieId: number, rating: number) => void;
  top4MovieIds: number[];
  setTop4Movie: (slotIndex: number, movieId: number) => void;
  lists: MovieList[];
  createList: (newList: Omit<MovieList, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>) => string;
  updateList: (listId: string, updates: Omit<MovieList, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>) => void;
  deleteList: (listId: string) => void;
  reviews: Review[];
  addReview: (newReview: Omit<Review, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>) => void;
  movieOverrides: Record<number, { poster?: string; backdrop?: string }>;
  setMovieOverride: (movieId: number, override: { poster?: string; backdrop?: string }) => void;
  // ActionBottomSheet (mobile long-press / actions)
  actionSheetMovie: { id: number; title: string; release_date?: string } | null;
  openActionSheet: (movie: { id: number; title: string; release_date?: string }) => void;
  closeActionSheet: () => void;
  // Modal states
  isLogModalOpen: boolean;
  selectedMovieForLog: MovieShort | null;
  openLogModal: (movie?: MovieShort) => void;
  closeLogModal: () => void;
  isTop4PickerOpen: boolean;
  activeTop4Slot: number | null;
  openTop4Picker: (slotIndex: number) => void;
  closeTop4Picker: () => void;
}

// Helper para gravar no localStorage fora do caminho crítico de animação/toque
const pendingWrites = new Map<string, unknown>();
let storageIdleHandle: number | null = null;

function scheduleStorageWrite(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  pendingWrites.set(key, value);
  if (storageIdleHandle !== null) return;
  const flush = () => {
    storageIdleHandle = null;
    pendingWrites.forEach((val, k) => {
      try {
        localStorage.setItem(k, JSON.stringify(val));
      } catch {
        // Ignora quota exceeded em modo privado/cheio
      }
    });
    pendingWrites.clear();
  };
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === 'function') {
    storageIdleHandle = win.requestIdleCallback(flush, { timeout: 1000 });
  } else {
    storageIdleHandle = window.setTimeout(flush, 120);
  }
}

// Perfil neutro para visitante DESLOGADO - nunca exibimos dados de outra
// conta (era o bug: guestUser hardcoded "jpcmpc23" aparecia no F5 sem login).
const guestUser: UserProfile = {
  id: 'guest',
  username: 'visitante',
  displayName: 'Visitante',
  bio: '',
  avatarUrl: '',
  backdropUrl: '',
  location: '',
  website: '',
  isPro: false,
  isPatron: false,
  top4MovieIds: [0, 0, 0, 0],
  followingCount: 0,
  followersCount: 0,
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

// Row shape of public.film_logs in Supabase
interface FilmLogRow {
  id: string;
  user_id: string;
  film_id: number;
  film_title: string;
  film_poster: string | null;
  film_year: number | null;
  watched_on: string | null;
  rating: number | null;
  liked: boolean;
  review_text: string | null;
  contains_spoilers: boolean;
  created_at: string;
}

interface WatchlistRow {
  user_id: string;
  film_id: number;
  film_title: string;
  film_poster: string | null;
  film_year: number | null;
}

const rowToLogEntry = (row: FilmLogRow): LogEntry => ({
  id: row.id,
  movieId: row.film_id,
  movieTitle: row.film_title,
  moviePoster: row.film_poster,
  movieYear: row.film_year ? String(row.film_year) : '',
  watchedDate: row.watched_on ?? '',
  rating: row.rating ?? 0,
  isRewatch: false,
  liked: row.liked,
  reviewText: row.review_text ?? '',
  containsSpoilers: row.contains_spoilers,
  tags: [],
  createdAt: row.created_at,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser, profile, isAuthenticated } = useAuth();

  // Movie metadata cache so quick toggles (watched/like/rating by id) can
  // still persist meaningful rows to Supabase.
  const movieMetaRef = useRef<Record<number, { title: string; poster: string | null; year: number | null }>>({});
  const rememberMovie = (m: { id: number; title?: string; poster_path?: string | null; release_date?: string; movieTitle?: string; moviePoster?: string | null; movieYear?: string | number }) => {
    const year = m.release_date?.slice(0, 4) ?? (m.movieYear ? String(m.movieYear).slice(0, 4) : '');
    movieMetaRef.current[m.id] = {
      title: m.title ?? m.movieTitle ?? movieMetaRef.current[m.id]?.title ?? '',
      poster: m.poster_path !== undefined ? m.poster_path : (m.moviePoster ?? movieMetaRef.current[m.id]?.poster ?? null),
      year: year ? parseInt(year, 10) : (movieMetaRef.current[m.id]?.year ?? null),
    };
  };

  // AuthProvider já garante que a sessão foi resolvida antes deste mount,
  // então isAuthenticated é confiável aqui. DESLOGADO → estado visitante vazio
  // (nunca reidrata lb_* do localStorage — seriam dados de outra conta).
  const [user, setUser] = useState<UserProfile>(() => {
    if (!isAuthenticated) return guestUser;
    const saved = localStorage.getItem('lb_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.username === 'cinephile' || parsed.username === 'jpcmpc23') return guestUser;
      return parsed;
    }
    return guestUser;
  });

  const [logs, setLogs] = useState<LogEntry[]>(() => {
    if (!isAuthenticated) return initialLogs;
    const saved = localStorage.getItem('lb_logs');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length <= 4) return initialLogs;
      return parsed;
    }
    return initialLogs;
  });

  const [watchlist, setWatchlist] = useState<MovieShort[]>(() => {
    if (!isAuthenticated) return [];
    const saved = localStorage.getItem('lb_watchlist');
    return saved ? JSON.parse(saved) : [];
  });

  const [watchedMovieIds, setWatchedMovieIds] = useState<number[]>(() => {
    if (!isAuthenticated) return initialWatchedIds;
    const saved = localStorage.getItem('lb_watched');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length <= 5) return initialWatchedIds;
      return parsed;
    }
    return initialWatchedIds;
  });

  const [likedMovieIds, setLikedMovieIds] = useState<number[]>(() => {
    if (!isAuthenticated) return initialLikedIds;
    const saved = localStorage.getItem('lb_likes');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length <= 5) return initialLikedIds;
      return parsed;
    }
    return initialLikedIds;
  });

  const [ratingsMap, setRatingsMap] = useState<Record<number, number>>(() => {
    if (!isAuthenticated) return initialRatings;
    const saved = localStorage.getItem('lb_ratings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Object.keys(parsed).length <= 5) return initialRatings;
      return parsed;
    }
    return initialRatings;
  });

  const [top4MovieIds, setTop4MovieIds] = useState<number[]>(() => {
    if (!isAuthenticated) return guestUser.top4MovieIds;
    const saved = localStorage.getItem('lb_top4');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.includes(157336)) return guestUser.top4MovieIds;
      return parsed;
    }
    return guestUser.top4MovieIds;
  });

  const [lists, setLists] = useState<MovieList[]>(() => {
    if (!isAuthenticated) return [];
    const saved = localStorage.getItem('lb_lists');
    return saved ? JSON.parse(saved) : [];
  });

  const [reviews, setReviews] = useState<Review[]>(() => {
    if (!isAuthenticated) return [];
    const saved = localStorage.getItem('lb_reviews');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length <= 2) return initialReviewsList;
      return parsed;
    }
    return initialReviewsList;
  });

  // Custom poster/backdrop overrides per film (like MyWorld's "Set film poster/backdrop")
  const [movieOverrides, setMovieOverrides] = useState<Record<number, { poster?: string; backdrop?: string }>>(() => {
    const saved = localStorage.getItem('lb_movie_overrides');
    return saved ? JSON.parse(saved) : {};
  });

  // Refs-espelho do estado: permitem useCallback com deps mínimas (identidade
  // estável) sem capturar closures stale. refs apenas de LEITURA nos callbacks.
  const userRef = useRef(user); userRef.current = user;
  const watchlistRef = useRef(watchlist); watchlistRef.current = watchlist;
  const watchedIdsRef = useRef(watchedMovieIds); watchedIdsRef.current = watchedMovieIds;
  const likedIdsRef = useRef(likedMovieIds); likedIdsRef.current = likedMovieIds;
  const overridesRef = useRef(movieOverrides); overridesRef.current = movieOverrides;

  const setMovieOverride = useCallback((movieId: number, override: { poster?: string; backdrop?: string }) => {
    const next = { ...(overridesRef.current[movieId] || {}), ...override };

    setMovieOverrides((prev) => {
      const merged = { ...prev[movieId], ...override };
      if (!merged.poster && !merged.backdrop) {
        const { [movieId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [movieId]: merged };
    });

    // Persiste no Supabase (tabela film_overrides â€” migration_film_overrides.sql)
    if (supabase && isAuthenticated && authUser) {
      void (async () => {
        if (!next.poster && !next.backdrop) {
          const { error } = await supabase
            .from('film_overrides')
            .delete()
            .eq('user_id', authUser.id)
            .eq('film_id', movieId);
          if (error) console.warn('film_overrides delete error (rode migration_film_overrides.sql):', error.message);
        } else {
          const { error } = await supabase
            .from('film_overrides')
            .upsert(
              {
                user_id: authUser.id,
                film_id: movieId,
                poster_url: next.poster ?? null,
                backdrop_url: next.backdrop ?? null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,film_id' }
            );
          if (error) console.warn('film_overrides upsert error (rode migration_film_overrides.sql):', error.message);
        }
      })();
    }
  }, [isAuthenticated, authUser]);

  // Modal controls
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedMovieForLog, setSelectedMovieForLog] = useState<MovieShort | null>(null);
  const [isTop4PickerOpen, setIsTop4PickerOpen] = useState(false);
  const [activeTop4Slot, setActiveTop4Slot] = useState<number | null>(null);
  const [actionSheetMovie, setActionSheetMovie] = useState<{ id: number; title: string; release_date?: string } | null>(null);

  // Sync with LocalStorage (agendado em idle para não travar scroll/toques)
  useEffect(() => { scheduleStorageWrite('lb_user', user); }, [user]);
  useEffect(() => { scheduleStorageWrite('lb_logs', logs); }, [logs]);
  useEffect(() => { scheduleStorageWrite('lb_watchlist', watchlist); }, [watchlist]);
  useEffect(() => { scheduleStorageWrite('lb_watched', watchedMovieIds); }, [watchedMovieIds]);
  useEffect(() => { scheduleStorageWrite('lb_likes', likedMovieIds); }, [likedMovieIds]);
  useEffect(() => { scheduleStorageWrite('lb_ratings', ratingsMap); }, [ratingsMap]);
  useEffect(() => { scheduleStorageWrite('lb_top4', top4MovieIds); }, [top4MovieIds]);
  useEffect(() => { scheduleStorageWrite('lb_lists', lists); }, [lists]);
  useEffect(() => { scheduleStorageWrite('lb_reviews', reviews); }, [reviews]);
  useEffect(() => {
    // Enquanto logado, overrides vivem no Supabase (não no localStorage!)
    if (isAuthenticated) return;
    scheduleStorageWrite('lb_movie_overrides', movieOverrides);
  }, [movieOverrides, isAuthenticated]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Supabase integration â€” ativa apenas quando hÃ¡ usuÃ¡rio autenticado
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const syncedUserIdRef = useRef<string | null>(null);
  // Estado (nÃ£o ref) para gatear o primeiro render: enquanto autenticado e
  // ainda nÃ£o sincronizado, nenhum filho renderiza (evita flash dos dados de
  // demo/localStorage, pois o clear acontece em useEffect, apÃ³s o 1Âº paint).
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);

  // Quando autenticado, sobrepÃµe o usuÃ¡rio local com o perfil real do Supabase
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

  // Carrega film_logs + watchlist do Supabase no login
  useEffect(() => {
    const client = supabase;
    if (!client || !isAuthenticated || !authUser) {
      syncedUserIdRef.current = null;
      setSyncedUserId(null);
      // Ao deslogar, volta TUDO para o estado de visitante: dados da conta
      // anterior não podem "vazar" (nem aparecer depois de F5) para visitantes.
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
      localStorage.removeItem('lb_movie_overrides');
      localStorage.removeItem('lb_user');
      localStorage.removeItem('lb_logs');
      localStorage.removeItem('lb_watched');
      localStorage.removeItem('lb_likes');
      localStorage.removeItem('lb_ratings');
      localStorage.removeItem('lb_top4');
      localStorage.removeItem('lb_lists');
      localStorage.removeItem('lb_reviews');
      localStorage.removeItem('lb_watchlist');
      return;
    }
    if (syncedUserIdRef.current === authUser.id) return;
    syncedUserIdRef.current = authUser.id;

    // Zera o estado local imediatamente para nÃ£o vazar dados de demo/localStorage
    // em "flash" enquanto o Supabase responde (ex.: refresh na pÃ¡gina de perfil).
    setLogs([]);
    setWatchedMovieIds([]);
    setLikedMovieIds([]);
    setRatingsMap({});
    setReviews([]);
    setWatchlist([]);
    setTop4MovieIds([0, 0, 0, 0]);
    setMovieOverrides({});

    const loadRemoteData = async () => {
      const [logsRes, watchlistRes, favRes, overridesRes] = await Promise.all([
        client.from('film_logs').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }),
        client.from('watchlist').select('*').eq('user_id', authUser.id).order('added_at', { ascending: false }),
        // favorite_films exige supabase/migration_settings.sql; tolerante a coluna ausente
        client.from('profiles').select('favorite_films').eq('id', authUser.id).maybeSingle(),
        // film_overrides exige supabase/migration_film_overrides.sql; tolerante a tabela ausente
        client.from('film_overrides').select('film_id, poster_url, backdrop_url').eq('user_id', authUser.id),
      ]);

      if (overridesRes.error) {
        console.warn('film_overrides indisponÃ­vel (rode supabase/migration_film_overrides.sql):', overridesRes.error.message);
      } else if (overridesRes.data) {
        const map: Record<number, { poster?: string; backdrop?: string }> = {};
        for (const row of overridesRes.data as { film_id: number; poster_url: string | null; backdrop_url: string | null }[]) {
          map[row.film_id] = {
            poster: row.poster_url || undefined,
            backdrop: row.backdrop_url || undefined,
          };
        }
        setMovieOverrides(map);
      }

      // Top 4 vindo do Supabase sobrepÃµe o local (quando a coluna existir e tiver dados)
      if (favRes.error) {
        console.warn('favorite_films indisponÃ­vel (rode supabase/migration_settings.sql):', favRes.error.message);
      } else if (Array.isArray(favRes.data?.favorite_films)) {
        // Conta nova tem favorite_films = {} â€” nesse caso os 4 slots ficam vazios
        const ids = (favRes.data.favorite_films as unknown[])
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
          .slice(0, 4);
        // Garante 4 slots; slots vazios sÃ£o representados como 0
        while (ids.length < 4) ids.push(0);
        setTop4MovieIds(ids);
      }

      if (logsRes.error) {
        console.error('Supabase film_logs load error:', logsRes.error);
      } else if (logsRes.data) {
        const remoteLogs = (logsRes.data as FilmLogRow[]).map(rowToLogEntry);
        setLogs(remoteLogs);
        setWatchedMovieIds(Array.from(new Set(remoteLogs.map((l) => l.movieId))));
        setLikedMovieIds(remoteLogs.filter((l) => l.liked).map((l) => l.movieId));
        setRatingsMap(
          Object.fromEntries(remoteLogs.filter((l) => l.rating > 0).map((l) => [l.movieId, l.rating]))
        );
        remoteLogs.forEach((l) => rememberMovie({ id: l.movieId, movieTitle: l.movieTitle, moviePoster: l.moviePoster, movieYear: l.movieYear }));
        setReviews(
          remoteLogs
            .filter((l) => l.reviewText.trim())
            .map((l) => ({
              id: `rev-${l.id}`,
              movieId: l.movieId,
              movieTitle: l.movieTitle,
              moviePoster: l.moviePoster,
              movieYear: l.movieYear,
              author: {
                username: profile?.username ?? 'me',
                displayName: profile?.display_name ?? 'me',
                avatarUrl: profile?.avatar_url ?? '',
              },
              rating: l.rating,
              liked: l.liked,
              content: l.reviewText,
              containsSpoilers: l.containsSpoilers,
              watchedDate: l.watchedDate,
              likesCount: 0,
              commentsCount: 0,
              createdAt: l.createdAt,
            }))
        );
      }

      if (watchlistRes.error) {
        console.error('Supabase watchlist load error:', watchlistRes.error);
      } else if (watchlistRes.data) {
        const remoteWatchlist = (watchlistRes.data as WatchlistRow[]).map((row) => ({
          id: row.film_id,
          title: row.film_title,
          poster_path: row.film_poster,
          release_date: row.film_year ? `${row.film_year}-01-01` : '',
        }));
        remoteWatchlist.forEach((m) => rememberMovie(m));
        setWatchlist(remoteWatchlist);
      }
    };

    void loadRemoteData()
      .catch((err) => console.error('Supabase remote load failed:', err))
      .finally(() => setSyncedUserId(authUser.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authUser?.id]);

  // Upsert de um "quick log" (sem data) em film_logs â€” usado por toggles/rating
  const persistQuickLog = async (filmId: number, patch: { watched?: boolean; liked?: boolean; rating?: number }) => {
    if (!supabase || !isAuthenticated || !authUser) return;
    const meta = movieMetaRef.current[filmId] ?? { title: '', poster: null, year: null };

    const { data: existing } = await supabase
      .from('film_logs')
      .select('id, rating, liked, review_text')
      .eq('user_id', authUser.id)
      .eq('film_id', filmId)
      .is('watched_on', null)
      .maybeSingle();

    if (existing) {
      const updates: Record<string, unknown> = {};
      if (patch.liked !== undefined) updates.liked = patch.liked;
      if (patch.rating !== undefined) updates.rating = patch.rating > 0 ? patch.rating : null;
      if (patch.watched === false && !existing.review_text) {
        await supabase.from('film_logs').delete().eq('id', existing.id);
        return;
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('film_logs').update(updates).eq('id', existing.id);
        if (error) console.error('Supabase film_logs update error:', error);
      }
    } else if (patch.watched !== false) {
      const { error } = await supabase.from('film_logs').insert({
        user_id: authUser.id,
        film_id: filmId,
        film_title: meta.title,
        film_poster: meta.poster,
        film_year: meta.year,
        watched_on: null,
        rating: patch.rating && patch.rating > 0 ? patch.rating : null,
        liked: patch.liked ?? false,
      });
      if (error) console.error('Supabase film_logs insert error:', error);
    }
  };

  const persistWatchlistAdd = async (movie: MovieShort) => {
    if (!supabase || !isAuthenticated || !authUser) return;
    rememberMovie(movie);
    const meta = movieMetaRef.current[movie.id];
    const { error } = await supabase.from('watchlist').upsert(
      {
        user_id: authUser.id,
        film_id: movie.id,
        film_title: meta?.title ?? movie.title,
        film_poster: meta?.poster ?? movie.poster_path,
        film_year: meta?.year ?? (movie.release_date ? parseInt(movie.release_date.slice(0, 4), 10) : null),
      },
      { onConflict: 'user_id,film_id' }
    );
    if (error) console.error('Supabase watchlist upsert error:', error);
  };

  const persistWatchlistRemove = async (filmId: number) => {
    if (!supabase || !isAuthenticated || !authUser) return;
    const { error } = await supabase.from('watchlist').delete().eq('user_id', authUser.id).eq('film_id', filmId);
    if (error) console.error('Supabase watchlist delete error:', error);
  };

  const persistFullLog = async (entry: Omit<LogEntry, 'id' | 'createdAt'>) => {
    if (!supabase || !isAuthenticated || !authUser) return;
    rememberMovie({ id: entry.movieId, movieTitle: entry.movieTitle, moviePoster: entry.moviePoster, movieYear: entry.movieYear });
    const meta = movieMetaRef.current[entry.movieId];
    const { error } = await supabase.from('film_logs').insert({
      user_id: authUser.id,
      film_id: entry.movieId,
      film_title: meta.title,
      film_poster: meta.poster,
      film_year: meta.year,
      watched_on: entry.watchedDate || null,
      rating: entry.rating > 0 ? entry.rating : null,
      liked: entry.liked,
      review_text: entry.reviewText.trim() || null,
      contains_spoilers: entry.containsSpoilers,
    });
    if (error) console.error('Supabase film_logs insert error:', error);
  };

  const updateUser = useCallback((updates: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  }, []);

  const saveLog = useCallback((entry: Omit<LogEntry, 'id' | 'createdAt'>) => {
    const newId = `log-${Date.now()}`;
    const newEntry: LogEntry = {
      ...entry,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    setLogs((prev) => [newEntry, ...prev]);

    // Update watched
    if (!watchedIdsRef.current.includes(entry.movieId)) {
      setWatchedMovieIds((prev) => [entry.movieId, ...prev]);
    }

    // Update liked
    if (entry.liked && !likedIdsRef.current.includes(entry.movieId)) {
      setLikedMovieIds((prev) => [entry.movieId, ...prev]);
    } else if (!entry.liked && likedIdsRef.current.includes(entry.movieId)) {
      setLikedMovieIds((prev) => prev.filter((id) => id !== entry.movieId));
    }

    // Update rating
    if (entry.rating > 0) {
      setRatingsMap((prev) => ({ ...prev, [entry.movieId]: entry.rating }));
    }

    // If review exists, add to reviews list
    if (entry.reviewText.trim()) {
      const u = userRef.current;
      const review: Review = {
        id: `rev-${Date.now()}`,
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

    void persistFullLog(entry);
  }, [isAuthenticated, authUser]);

  const deleteLog = useCallback((id: string) => {
    setLogs((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toggleWatchlist = useCallback((movie: MovieShort) => {
    const exists = watchlistRef.current.some((m) => m.id === movie.id);
    rememberMovie(movie);
    setWatchlist((prev) => {
      const wasInList = prev.some((m) => m.id === movie.id);
      if (wasInList) {
        return prev.filter((m) => m.id !== movie.id);
      }
      return [movie, ...prev];
    });
    if (exists) {
      void persistWatchlistRemove(movie.id);
    } else {
      void persistWatchlistAdd(movie);
    }
  }, [isAuthenticated, authUser]);

  const isMovieInWatchlist = useCallback((movieId: number) => {
    return watchlistRef.current.some((m) => m.id === movieId);
  }, []);

  const toggleWatched = useCallback((movieId: number) => {
    const wasWatched = watchedIdsRef.current.includes(movieId);
    setWatchedMovieIds((prev) =>
      prev.includes(movieId) ? prev.filter((id) => id !== movieId) : [movieId, ...prev]
    );
    void persistQuickLog(movieId, { watched: !wasWatched });
  }, [isAuthenticated, authUser]);

  const isMovieWatched = useCallback((movieId: number) => {
    return watchedIdsRef.current.includes(movieId);
  }, []);

  const toggleLikeMovie = useCallback((movieId: number) => {
    const wasLiked = likedIdsRef.current.includes(movieId);
    setLikedMovieIds((prev) =>
      prev.includes(movieId) ? prev.filter((id) => id !== movieId) : [movieId, ...prev]
    );
    if (watchedIdsRef.current.includes(movieId)) {
      void persistQuickLog(movieId, { liked: !wasLiked });
    }
  }, [isAuthenticated, authUser]);

  const isMovieLiked = useCallback((movieId: number) => {
    return likedIdsRef.current.includes(movieId);
  }, []);

  const setMovieRating = useCallback((movieId: number, rating: number) => {
    setRatingsMap((prev) => ({ ...prev, [movieId]: rating }));
    if (!watchedIdsRef.current.includes(movieId)) {
      setWatchedMovieIds((prev) => [movieId, ...prev]);
    }
    void persistQuickLog(movieId, { rating });
  }, [isAuthenticated, authUser]);

  // Persiste o Top 4 no Supabase (profiles.favorite_films, int[]).
  // Slots vazios sÃ£o persistidos como 0 â€” int[] nÃ£o aceita null.
  const persistTop4 = async (ids: number[]) => {
    if (!supabase || !isAuthenticated || !authUser) return;
    const { error } = await supabase
      .from('profiles')
      .update({ favorite_films: ids })
      .eq('id', authUser.id);
    if (error) {
      console.warn(
        'NÃ£o foi possÃ­vel salvar favorite_films â€” rode supabase/migration_settings.sql no Supabase SQL Editor.',
        error.message
      );
    }
  };

  const setTop4Movie = useCallback((slotIndex: number, movieId: number) => {
    setTop4MovieIds((prev) => {
      const updated = [...prev];
      updated[slotIndex] = movieId;
      void persistTop4(updated);
      return updated;
    });
  }, [isAuthenticated, authUser]);

  const createList = useCallback((newList: Omit<MovieList, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>): string => {
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
  }, []);

  const updateList = useCallback((listId: string, updates: Omit<MovieList, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>) => {
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
  }, []);

  const deleteList = useCallback((listId: string) => {
    setLists((prev) => prev.filter((l) => l.id !== listId));
  }, []);

  const addReview = useCallback((newReview: Omit<Review, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>) => {
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
  }, []);

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

  const openActionSheet = useCallback((movie: { id: number; title: string; release_date?: string }) => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
    setActionSheetMovie(movie);
  }, []);

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
      watchlistIds: watchlist.map((m) => m.id),
      ratings: ratingsMap,
      overrides: movieOverrides,
    });
    movieStore.flush();
  }, [watchedMovieIds, likedMovieIds, watchlist, ratingsMap, movieOverrides]);

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
      user, updateUser, logs, saveLog, deleteLog, watchlist, toggleWatchlist,
      isMovieInWatchlist, watchedMovieIds, toggleWatched, isMovieWatched,
      likedMovieIds, toggleLikeMovie, isMovieLiked, ratingsMap, setMovieRating,
      top4MovieIds, setTop4Movie, lists, createList, updateList, deleteList, reviews,
      addReview, movieOverrides, setMovieOverride, isLogModalOpen,
      selectedMovieForLog, openLogModal, closeLogModal, isTop4PickerOpen,
      activeTop4Slot, openTop4Picker, closeTop4Picker, actionSheetMovie,
      openActionSheet, closeActionSheet,
    ]
  );

  // Gate: autenticado mas dados remotos ainda nÃ£o sincronizados â†’ spinner.
  // Sem isso, o primeiro render pintaria logs/watchlist/top4 do localStorage
  // (o clear sÃ³ roda em useEffect, depois do paint).
  if (isAuthenticated && authUser && syncedUserId !== authUser.id) {
    return (
      <div className="min-h-screen bg-[#14181c] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#00e054] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

/**
 * Estado de um único filme (assistido / curtido / nota / pôster). Usar nos
 * cartões em vez de useApp(): só re-renderiza quando ESTE filme muda.
 */
export const useMovieState = (movieId: number): MovieSnapshot => {
  // subscribe/getSnapshot estáveis por filme: funções novas a cada render fariam
  // o React reinscrever o listener e reler o snapshot sem parar.
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
