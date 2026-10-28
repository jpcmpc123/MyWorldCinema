import { supabase } from '../../lib/supabase';
import type { LogEntry, Review } from '../../types';
import {
  rowToLogEntry,
  type FilmLogRow,
  type MovieMetaCache,
  type MovieShort,
  type RememberMovieFn,
  type WatchlistRow,
} from './types';

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
}

export async function fetchRemoteAccountSnapshot(
  userId: string,
  profileInfo: { username?: string; display_name?: string | null; avatar_url?: string | null } | null,
  rememberMovie: RememberMovieFn,
): Promise<RemoteAccountSnapshot> {
  if (!supabase) return {};

  const [logsRes, watchlistRes, favRes, overridesRes] = await Promise.all([
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
    const meta = movieMeta[filmId] ?? { title: '', poster: null, year: null };

    const { data: existing } = await supabase
      .from('film_logs')
      .select('id, rating, liked, review_text')
      .eq('user_id', userId)
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
    } else if (
      patch.watched !== false &&
      (patch.watched === true || (patch.rating && patch.rating > 0) || patch.liked)
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
