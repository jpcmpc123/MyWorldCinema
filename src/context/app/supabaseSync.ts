import { supabase } from '../../lib/supabase';
import type { LogEntry, MovieList, Review } from '../../types';
import {
  rowToLogEntry,
  type FilmLogRow,
  type ListRow,
  type MovieMetaCache,
  type MovieShort,
  type RememberMovieFn,
  type WatchlistRow,
} from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const pendingListCreates = new Map<string, Promise<void>>();

export async function waitForPendingList(listId: string): Promise<void> {
  const pending = pendingListCreates.get(listId);
  if (pending) {
    await pending;
  }
}

export interface RemoteAccountSnapshot {
  overrides?: Record<number, { poster?: string; backdrop?: string }>;
  top4Ids?: number[];
  logsData?: {
    logs: LogEntry[];
    watchedIds: number[];
    likedIds: number[];
    ratingsMap: Record<number, number>;
    reviews: Review[];
  };
  watchlist?: MovieShort[];
  lists?: MovieList[];
}

export async function fetchRemoteAccountSnapshot(
  userId: string,
  profileInfo: { username?: string; display_name?: string | null; avatar_url?: string | null } | null,
  rememberMovie: RememberMovieFn,
): Promise<RemoteAccountSnapshot> {
  if (!supabase) return {};

  const [logsRes, watchlistRes, favRes, overridesRes, listsResInitial] = await Promise.all([
    supabase
      .from('film_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false }),
    supabase.from('profiles').select('favorite_films').eq('id', userId).maybeSingle(),
    supabase
      .from('film_overrides')
      .select('film_id, poster_url, backdrop_url')
      .eq('user_id', userId),
    supabase
      .from('lists')
      .select(
        'id, user_id, title, description, is_public, created_at, list_items(film_id, film_title, film_poster, film_year, position), list_comments(count)',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  const result: RemoteAccountSnapshot = {};

  if (overridesRes.error) {
    console.warn(
      'film_overrides indisponível (rode supabase/migration_film_overrides.sql):',
      overridesRes.error.message,
    );
  } else if (overridesRes.data) {
    const map: Record<number, { poster?: string; backdrop?: string }> = {};
    for (const row of overridesRes.data as {
      film_id: number;
      poster_url: string | null;
      backdrop_url: string | null;
    }[]) {
      map[row.film_id] = {
        poster: row.poster_url || undefined,
        backdrop: row.backdrop_url || undefined,
      };
    }
    result.overrides = map;
  }

  if (favRes.error) {
    console.warn(
      'favorite_films indisponível (rode supabase/migration_settings.sql):',
      favRes.error.message,
    );
  } else if (Array.isArray(favRes.data?.favorite_films)) {
    const ids = (favRes.data.favorite_films as unknown[])
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
      .slice(0, 4);
    while (ids.length < 4) ids.push(0);
    result.top4Ids = ids;
  }

  if (logsRes.error) {
    console.error('Supabase film_logs load error:', logsRes.error);
  } else if (logsRes.data) {
    const remoteLogs = (logsRes.data as FilmLogRow[]).map(rowToLogEntry);
    remoteLogs.forEach((l) =>
      rememberMovie({
        id: l.movieId,
        movieTitle: l.movieTitle,
        moviePoster: l.moviePoster,
        movieYear: l.movieYear,
      }),
    );

    result.logsData = {
      logs: remoteLogs,
      watchedIds: Array.from(new Set(remoteLogs.map((l) => l.movieId))),
      likedIds: remoteLogs.filter((l) => l.liked).map((l) => l.movieId),
      ratingsMap: Object.fromEntries(
        remoteLogs.filter((l) => l.rating > 0).map((l) => [l.movieId, l.rating]),
      ),
      reviews: remoteLogs
        .filter((l) => l.reviewText.trim())
        .map((l) => ({
          id: `rev-${l.id}`,
          movieId: l.movieId,
          movieTitle: l.movieTitle,
          moviePoster: l.moviePoster,
          movieYear: l.movieYear,
          author: {
            username: profileInfo?.username ?? 'me',
            displayName: profileInfo?.display_name ?? 'me',
            avatarUrl: profileInfo?.avatar_url ?? '',
          },
          rating: l.rating,
          liked: l.liked,
          content: l.reviewText,
          containsSpoilers: l.containsSpoilers,
          watchedDate: l.watchedDate,
          likesCount: 0,
          commentsCount: 0,
          createdAt: l.createdAt,
        })),
    };
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
    result.watchlist = remoteWatchlist;
  }

  let listsData = listsResInitial.data as ListRow[] | null;
  let listsError = listsResInitial.error;

  if (listsError && /list_comments/i.test(listsError.message)) {
    const fallback = await supabase
      .from('lists')
      .select(
        'id, user_id, title, description, is_public, created_at, list_items(film_id, film_title, film_poster, film_year, position)',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    listsData = fallback.data as ListRow[] | null;
    listsError = fallback.error;
  }

  if (listsError) {
    console.error('Supabase lists load error:', listsError);
  } else if (listsData) {
    const mappedLists: MovieList[] = listsData.map((row) => {
      const sortedItems = [...(row.list_items ?? [])].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0),
      );
      const movies = sortedItems.map((item) => {
        const movieShort = {
          id: item.film_id,
          title: item.film_title,
          poster_path: item.film_poster,
          release_date: item.film_year ? `${item.film_year}-01-01` : '',
        };
        rememberMovie(movieShort);
        return movieShort;
      });
      const commentsCount = Array.isArray(row.list_comments)
        ? Number(row.list_comments[0]?.count ?? 0)
        : 0;
      return {
        id: row.id,
        title: row.title,
        description: row.description ?? '',
        isRanked: false,
        isPrivate: !row.is_public,
        tags: [],
        movies,
        author: {
          username: profileInfo?.username ?? 'me',
          displayName: profileInfo?.display_name ?? profileInfo?.username ?? 'me',
          avatarUrl: profileInfo?.avatar_url ?? '',
        },
        likesCount: 0,
        commentsCount,
        createdAt: row.created_at,
      };
    });
    result.lists = mappedLists;
  }

  return result;
}

export async function persistMovieOverrideRemote(
  userId: string,
  movieId: number,
  nextOverride: { poster?: string; backdrop?: string },
): Promise<void> {
  if (!supabase) return;
  try {
    if (!nextOverride.poster && !nextOverride.backdrop) {
      const { error } = await supabase
        .from('film_overrides')
        .delete()
        .eq('user_id', userId)
        .eq('film_id', movieId);
      if (error) {
        console.warn(
          'film_overrides delete error (rode migration_film_overrides.sql):',
          error.message,
        );
      }
    } else {
      const { error } = await supabase.from('film_overrides').upsert(
        {
          user_id: userId,
          film_id: movieId,
          poster_url: nextOverride.poster ?? null,
          backdrop_url: nextOverride.backdrop ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,film_id' },
      );
      if (error) {
        console.warn(
          'film_overrides upsert error (rode migration_film_overrides.sql):',
          error.message,
        );
      }
    }
  } catch (err) {
    console.error('Supabase film_overrides sync error:', err);
  }
}

export async function persistQuickLogRemote(
  userId: string,
  filmId: number,
  patch: { watched?: boolean; liked?: boolean; rating?: number },
  movieMeta: MovieMetaCache,
): Promise<void> {
  if (!supabase) return;
  try {
    if (patch.watched === false) {
      const { error } = await supabase
        .from('film_logs')
        .delete()
        .eq('user_id', userId)
        .eq('film_id', filmId)
        .is('watched_on', null);
      if (error) console.error('Supabase film_logs unwatch delete error:', error);
      return;
    }

    const meta = movieMeta[filmId] ?? { title: '', poster: null, year: null };

    const { data: rows } = await supabase
      .from('film_logs')
      .select('id, rating, liked, review_text')
      .eq('user_id', userId)
      .eq('film_id', filmId)
      .is('watched_on', null)
      .order('created_at', { ascending: false })
      .limit(1);

    const existing = rows?.[0] ?? null;

    if (existing) {
      const updates: Record<string, unknown> = {};
      if (patch.liked !== undefined) updates.liked = patch.liked;
      if (patch.rating !== undefined) updates.rating = patch.rating > 0 ? patch.rating : null;

      const nextRating =
        patch.rating !== undefined ? (patch.rating > 0 ? patch.rating : null) : existing.rating;
      const nextLiked = patch.liked !== undefined ? patch.liked : existing.liked;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('film_logs').update(updates).eq('id', existing.id);
        if (error) console.error('Supabase film_logs update error:', error);
      } else if (!nextRating && !nextLiked && !existing.review_text && patch.watched === undefined) {
        await supabase.from('film_logs').delete().eq('id', existing.id);
      }
    } else if (
      patch.watched === true ||
      (patch.rating !== undefined && patch.rating > 0) ||
      patch.liked === true
    ) {
      const { error } = await supabase.from('film_logs').insert({
        user_id: userId,
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
  } catch (err) {
    console.error('Supabase persistQuickLog error:', err);
  }
}

export async function persistWatchlistAddRemote(
  userId: string,
  movie: MovieShort,
  movieMeta: MovieMetaCache,
): Promise<void> {
  if (!supabase) return;
  try {
    const meta = movieMeta[movie.id];
    const { error } = await supabase.from('watchlist').upsert(
      {
        user_id: userId,
        film_id: movie.id,
        film_title: meta?.title ?? movie.title,
        film_poster: meta?.poster ?? movie.poster_path,
        film_year:
          meta?.year ??
          (movie.release_date ? parseInt(movie.release_date.slice(0, 4), 10) : null),
      },
      { onConflict: 'user_id,film_id' },
    );
    if (error) console.error('Supabase watchlist upsert error:', error);
  } catch (err) {
    console.error('Supabase persistWatchlistAdd error:', err);
  }
}

export async function persistWatchlistRemoveRemote(
  userId: string,
  filmId: number,
): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('film_id', filmId);
    if (error) console.error('Supabase watchlist delete error:', error);
  } catch (err) {
    console.error('Supabase persistWatchlistRemove error:', err);
  }
}

export async function persistFullLogRemote(
  userId: string,
  entry: Omit<LogEntry, 'id' | 'createdAt'>,
  movieMeta: MovieMetaCache,
  onResolvedId: (realId: string) => void,
): Promise<void> {
  if (!supabase) return;
  try {
    const meta = movieMeta[entry.movieId] ?? {
      title: entry.movieTitle,
      poster: entry.moviePoster,
      year: entry.movieYear ? parseInt(entry.movieYear.slice(0, 4), 10) || null : null,
    };
    const { data, error } = await supabase
      .from('film_logs')
      .insert({
        user_id: userId,
        film_id: entry.movieId,
        film_title: meta.title,
        film_poster: meta.poster,
        film_year: meta.year,
        watched_on: entry.watchedDate || null,
        rating: entry.rating > 0 ? entry.rating : null,
        liked: entry.liked,
        review_text: entry.reviewText.trim() || null,
        contains_spoilers: entry.containsSpoilers,
        tags: Array.isArray(entry.tags) ? entry.tags.slice(0, 20) : [],
        is_rewatch: Boolean(entry.isRewatch),
      })
      .select('id')
      .maybeSingle();
    if (error) {
      console.error('Supabase film_logs insert error:', error);
    } else if (data?.id) {
      onResolvedId(String(data.id));
    }
  } catch (err) {
    console.error('Supabase persistFullLog error:', err);
  }
}

export async function deleteRemoteLog(userId: string, logId: string): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('film_logs')
      .delete()
      .eq('id', logId)
      .eq('user_id', userId);
    if (error) console.error('Supabase film_logs delete error:', error);
  } catch (err) {
    console.error('Supabase deleteLog error:', err);
  }
}

export async function persistTop4Remote(userId: string, ids: number[]): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ favorite_films: ids })
      .eq('id', userId);
    if (error) {
      console.warn(
        'Não foi possível salvar favorite_films — rode supabase/migration_settings.sql no Supabase SQL Editor.',
        error.message,
      );
    }
  } catch (err) {
    console.error('Supabase persistTop4 error:', err);
  }
}

function buildListItemRows(listId: string, movies: MovieList['movies']) {
  const seen = new Set<number>();
  const rows: {
    list_id: string;
    film_id: number;
    film_title: string;
    film_poster: string | null;
    film_year: number | null;
    position: number;
  }[] = [];
  for (const m of movies) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const parsedYear = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : NaN;
    rows.push({
      list_id: listId,
      film_id: m.id,
      film_title: (m.title || '').slice(0, 300),
      film_poster: m.poster_path ?? null,
      film_year: Number.isFinite(parsedYear) ? parsedYear : null,
      position: rows.length,
    });
  }
  return rows;
}

export function persistCreateListRemote(userId: string, list: MovieList): Promise<void> {
  if (!supabase) return Promise.resolve();
  const client = supabase;
  const task = (async () => {
    try {
      const { error: listError } = await client.from('lists').insert({
        id: list.id,
        user_id: userId,
        title: list.title.trim().slice(0, 150),
        description: (list.description || '').slice(0, 5000),
        is_public: !list.isPrivate,
        created_at: list.createdAt,
      });
      if (listError) {
        console.error('Supabase lists insert error:', listError);
        return;
      }

      const itemRows = buildListItemRows(list.id, list.movies);
      if (itemRows.length > 0) {
        const { error: itemsError } = await client.from('list_items').insert(itemRows);
        if (itemsError) {
          console.error('Supabase list_items insert error:', itemsError);
        }
      }
    } catch (err) {
      console.error('Supabase persistCreateList error:', err);
    } finally {
      pendingListCreates.delete(list.id);
    }
  })();

  pendingListCreates.set(list.id, task);
  return task;
}

export async function persistUpdateListRemote(
  userId: string,
  listId: string,
  updates: Omit<MovieList, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>,
): Promise<void> {
  if (!supabase || !isUuid(listId)) return;
  try {
    await waitForPendingList(listId);

    const { error: listError } = await supabase
      .from('lists')
      .update({
        title: updates.title.trim().slice(0, 150),
        description: (updates.description || '').slice(0, 5000),
        is_public: !updates.isPrivate,
      })
      .eq('id', listId)
      .eq('user_id', userId);

    if (listError) {
      console.error('Supabase lists update error:', listError);
      return;
    }

    const { error: delError } = await supabase
      .from('list_items')
      .delete()
      .eq('list_id', listId);
    if (delError) {
      console.error('Supabase list_items clear error:', delError);
      return;
    }

    const itemRows = buildListItemRows(listId, updates.movies);
    if (itemRows.length > 0) {
      const { error: insertError } = await supabase.from('list_items').insert(itemRows);
      if (insertError) {
        console.error('Supabase list_items replace error:', insertError);
      }
    }
  } catch (err) {
    console.error('Supabase persistUpdateList error:', err);
  }
}

export async function persistDeleteListRemote(userId: string, listId: string): Promise<void> {
  if (!supabase || !isUuid(listId)) return;
  try {
    await waitForPendingList(listId);
    const { error } = await supabase
      .from('lists')
      .delete()
      .eq('id', listId)
      .eq('user_id', userId);
    if (error) {
      console.error('Supabase lists delete error:', error);
    }
  } catch (err) {
    console.error('Supabase persistDeleteList error:', err);
  }
}
