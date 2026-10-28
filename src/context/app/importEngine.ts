import { supabase } from '../../lib/supabase';
import type { LogEntry, MovieList, Review, UserProfile } from '../../types';
import type {
  ListImportOptions,
  MovieShort,
  ProfileImportPayloadItem,
  ProfileImportSummary,
  RememberMovieFn,
} from './types';

export interface ProfileImportExecutionResult {
  summary: ProfileImportSummary;
  nextLogs: LogEntry[];
  nextWatchedIds: number[];
  nextLikedIds: number[];
  nextRatings: Record<number, number>;
  updatedReviews: Review[];
}

export async function executeProfileImport(params: {
  items: ProfileImportPayloadItem[];
  currentLogs: LogEntry[];
  currentWatchedIds: number[];
  currentLikedIds: number[];
  currentUser: UserProfile;
  authUserId: string | null;
  rememberMovie: RememberMovieFn;
}): Promise<ProfileImportExecutionResult> {
  const {
    items,
    currentLogs,
    currentWatchedIds,
    currentLikedIds,
    currentUser,
    authUserId,
    rememberMovie,
  } = params;

  if (items.length === 0) {
    return {
      summary: {
        watchedCount: 0,
        diaryCreatedCount: 0,
        diaryUpdatedCount: 0,
        reviewsCount: 0,
        ratingsCount: 0,
      },
      nextLogs: currentLogs,
      nextWatchedIds: currentWatchedIds,
      nextLikedIds: currentLikedIds,
      nextRatings: {},
      updatedReviews: [],
    };
  }

  // 1. Combine multiple lines containing the same film with the same WatchedDate
  const combinedItems: ProfileImportPayloadItem[] = [];
  const datedIndexMap = new Map<string, number>();

  for (const raw of items) {
    rememberMovie({
      id: raw.movieId,
      movieTitle: raw.movieTitle,
      moviePoster: raw.moviePoster,
      movieYear: raw.movieYear,
    });

    if (raw.watchedDate) {
      const key = `${raw.movieId}:${raw.watchedDate}`;
      const existingIdx = datedIndexMap.get(key);
      if (existingIdx !== undefined) {
        const prev = combinedItems[existingIdx];
        combinedItems[existingIdx] = {
          ...prev,
          rating: raw.rating > 0 ? raw.rating : prev.rating,
          isRewatch: prev.isRewatch || raw.isRewatch,
          liked: prev.liked || raw.liked,
          tags: Array.from(new Set([...prev.tags, ...raw.tags])),
          reviewText:
            prev.reviewText && raw.reviewText && prev.reviewText !== raw.reviewText
              ? `${prev.reviewText}\n\n${raw.reviewText}`
              : raw.reviewText || prev.reviewText,
        };
        continue;
      }
      datedIndexMap.set(key, combinedItems.length);
    }
    combinedItems.push({ ...raw });
  }

  let diaryCreatedCount = 0;
  let diaryUpdatedCount = 0;
  let reviewsCount = 0;
  let ratingsCount = 0;
  const uniqueMovieIds = new Set<number>();

  const nextLogs = [...currentLogs];
  const newWatchedSet = new Set<number>(currentWatchedIds);
  const newLikedSet = new Set<number>(currentLikedIds);
  const nextRatings: Record<number, number> = {};
  const nowIso = new Date().toISOString();

  const supabaseUpsertRows: {
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
  }[] = [];

  for (const item of combinedItems) {
    uniqueMovieIds.add(item.movieId);
    newWatchedSet.add(item.movieId);

    if (item.liked) {
      newLikedSet.add(item.movieId);
    }
    if (item.rating > 0) {
      nextRatings[item.movieId] = item.rating;
      ratingsCount++;
    }

    if (item.watchedDate) {
      const existingLogIdx = nextLogs.findIndex(
        (l) => l.movieId === item.movieId && l.watchedDate === item.watchedDate,
      );

      if (existingLogIdx !== -1) {
        const existing = nextLogs[existingLogIdx];
        const updatedTags = Array.from(new Set([...(existing.tags || []), ...(item.tags || [])]));
        const updatedReview = item.reviewText.trim() || existing.reviewText;
        const updatedRating = item.rating > 0 ? item.rating : existing.rating;
        const updatedLiked = existing.liked || item.liked;
        const updatedRewatch = existing.isRewatch || item.isRewatch;

        nextLogs[existingLogIdx] = {
          ...existing,
          rating: updatedRating,
          liked: updatedLiked,
          isRewatch: updatedRewatch,
          tags: updatedTags,
          reviewText: updatedReview,
        };
        diaryUpdatedCount++;
        if (item.reviewText.trim()) reviewsCount++;

        if (supabase && authUserId) {
          supabaseUpsertRows.push({
            user_id: authUserId,
            film_id: item.movieId,
            film_title: item.movieTitle || existing.movieTitle,
            film_poster: item.moviePoster ?? existing.moviePoster,
            film_year: item.movieYear ? parseInt(item.movieYear.slice(0, 4), 10) || null : null,
            watched_on: item.watchedDate,
            rating: updatedRating > 0 ? updatedRating : null,
            liked: updatedLiked,
            review_text: updatedReview.trim() || null,
            contains_spoilers: existing.containsSpoilers,
          });
        }
      } else {
        const newId = `log-imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newEntry: LogEntry = {
          id: newId,
          movieId: item.movieId,
          movieTitle: item.movieTitle,
          moviePoster: item.moviePoster,
          movieYear: item.movieYear,
          watchedDate: item.watchedDate,
          rating: item.rating,
          isRewatch: item.isRewatch,
          liked: item.liked,
          reviewText: item.reviewText,
          containsSpoilers: false,
          tags: item.tags,
          createdAt: nowIso,
        };
        nextLogs.unshift(newEntry);
        diaryCreatedCount++;
        if (item.reviewText.trim()) reviewsCount++;

        if (supabase && authUserId) {
          supabaseUpsertRows.push({
            user_id: authUserId,
            film_id: item.movieId,
            film_title: item.movieTitle,
            film_poster: item.moviePoster,
            film_year: item.movieYear ? parseInt(item.movieYear.slice(0, 4), 10) || null : null,
            watched_on: item.watchedDate,
            rating: item.rating > 0 ? item.rating : null,
            liked: item.liked,
            review_text: item.reviewText.trim() || null,
            contains_spoilers: false,
          });
        }
      }
    } else {
      const hasReview = Boolean(item.reviewText.trim());
      if (hasReview) {
        reviewsCount++;
      }

      const existingDatelessIdx = nextLogs.findIndex(
        (l) => l.movieId === item.movieId && !l.watchedDate,
      );
      const existingAnyIdx = nextLogs.findIndex((l) => l.movieId === item.movieId);

      if (existingDatelessIdx !== -1) {
        const existing = nextLogs[existingDatelessIdx];
        nextLogs[existingDatelessIdx] = {
          ...existing,
          movieTitle: item.movieTitle || existing.movieTitle,
          moviePoster: item.moviePoster ?? existing.moviePoster,
          movieYear: item.movieYear || existing.movieYear,
          rating: item.rating > 0 ? item.rating : existing.rating,
          liked: existing.liked || item.liked,
          reviewText: item.reviewText.trim() || existing.reviewText,
          tags: Array.from(new Set([...(existing.tags || []), ...(item.tags || [])])),
        };
      } else if (existingAnyIdx !== -1 && !hasReview) {
        const existing = nextLogs[existingAnyIdx];
        nextLogs[existingAnyIdx] = {
          ...existing,
          rating: existing.rating > 0 ? existing.rating : item.rating,
          liked: existing.liked || item.liked,
        };
      } else {
        const newId = `log-imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        nextLogs.push({
          id: newId,
          movieId: item.movieId,
          movieTitle: item.movieTitle,
          moviePoster: item.moviePoster,
          movieYear: item.movieYear,
          watchedDate: '',
          rating: item.rating,
          isRewatch: false,
          liked: item.liked,
          reviewText: item.reviewText.trim(),
          containsSpoilers: false,
          tags: item.tags || [],
          createdAt: nowIso,
        });
      }

      if (supabase && authUserId) {
        supabaseUpsertRows.push({
          user_id: authUserId,
          film_id: item.movieId,
          film_title: item.movieTitle,
          film_poster: item.moviePoster,
          film_year: item.movieYear ? parseInt(item.movieYear.slice(0, 4), 10) || null : null,
          watched_on: null,
          rating: item.rating > 0 ? item.rating : null,
          liked: item.liked,
          review_text: item.reviewText.trim() || null,
          contains_spoilers: false,
        });
      }
    }
  }

  const updatedReviews: Review[] = nextLogs
    .filter((l) => l.reviewText && l.reviewText.trim())
    .map((l) => ({
      id: `rev-${l.id}`,
      movieId: l.movieId,
      movieTitle: l.movieTitle,
      moviePoster: l.moviePoster,
      movieYear: l.movieYear,
      author: {
        username: currentUser.username,
        displayName: currentUser.displayName,
        avatarUrl: currentUser.avatarUrl,
        isPro: currentUser.isPro,
      },
      rating: l.rating,
      liked: l.liked,
      content: l.reviewText,
      containsSpoilers: l.containsSpoilers,
      watchedDate: l.watchedDate,
      likesCount: 0,
      commentsCount: 0,
      createdAt: l.createdAt,
    }));

  if (supabase && authUserId && supabaseUpsertRows.length > 0) {
    try {
      const CHUNK_SIZE = 100;
      const datedRows = supabaseUpsertRows.filter((r) => r.watched_on !== null);
      const datelessRowsRaw = supabaseUpsertRows.filter((r) => r.watched_on === null);

      const datelessByFilm = new Map<number, (typeof datelessRowsRaw)[number]>();
      for (const r of datelessRowsRaw) {
        datelessByFilm.set(r.film_id, r);
      }
      const datelessRows = Array.from(datelessByFilm.values());

      for (let i = 0; i < datedRows.length; i += CHUNK_SIZE) {
        const chunk = datedRows.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
          .from('film_logs')
          .upsert(chunk, { onConflict: 'user_id,film_id,watched_on' });
        if (error) console.error('Supabase bulk dated import error:', error);
      }

      if (datelessRows.length > 0) {
        const { data: existingDateless } = await supabase
          .from('film_logs')
          .select('id, film_id')
          .eq('user_id', authUserId)
          .is('watched_on', null);

        const existingMap = new Map<number, string>();
        for (const row of (existingDateless ?? []) as { id: string; film_id: number }[]) {
          existingMap.set(row.film_id, row.id);
        }

        const toInsert = datelessRows.filter((r) => !existingMap.has(r.film_id));
        const toUpdate = datelessRows.filter((r) => existingMap.has(r.film_id));

        for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
          const chunk = toInsert.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from('film_logs').insert(chunk);
          if (error) console.error('Supabase bulk dateless insert error:', error);
        }

        for (let i = 0; i < toUpdate.length; i += 25) {
          const batch = toUpdate.slice(i, i + 25);
          await Promise.all(
            batch.map((dRow) =>
              supabase!
                .from('film_logs')
                .update({
                  film_title: dRow.film_title,
                  film_poster: dRow.film_poster,
                  film_year: dRow.film_year,
                  rating: dRow.rating,
                  liked: dRow.liked,
                  review_text: dRow.review_text,
                })
                .eq('id', existingMap.get(dRow.film_id)!),
            ),
          );
        }
      }
    } catch (err) {
      console.error('Supabase importToProfile sync error:', err);
    }
  }

  return {
    summary: {
      watchedCount: uniqueMovieIds.size,
      diaryCreatedCount,
      diaryUpdatedCount,
      reviewsCount,
      ratingsCount,
    },
    nextLogs,
    nextWatchedIds: Array.from(newWatchedSet),
    nextLikedIds: Array.from(newLikedSet),
    nextRatings,
    updatedReviews,
  };
}

export async function executeWatchlistImport(params: {
  movies: MovieShort[];
  currentWatchlist: MovieShort[];
  authUserId: string | null;
  rememberMovie: RememberMovieFn;
}): Promise<{
  toAdd: MovieShort[];
  addedCount: number;
  skippedCount: number;
}> {
  const { movies, currentWatchlist, authUserId, rememberMovie } = params;
  const existingIds = new Set(currentWatchlist.map((m) => m.id));
  const toAdd: MovieShort[] = [];
  let skippedCount = 0;

  for (const m of movies) {
    rememberMovie(m);
    if (existingIds.has(m.id)) {
      skippedCount++;
    } else {
      existingIds.add(m.id);
      toAdd.push(m);
    }
  }

  if (toAdd.length > 0 && supabase && authUserId) {
    try {
      const rows = toAdd.map((m) => ({
        user_id: authUserId,
        film_id: m.id,
        film_title: m.title,
        film_poster: m.poster_path,
        film_year: m.release_date ? parseInt(m.release_date.slice(0, 4), 10) || null : null,
      }));
      const CHUNK_SIZE = 100;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
          .from('watchlist')
          .upsert(chunk, { onConflict: 'user_id,film_id' });
        if (error) console.error('Supabase watchlist bulk import error:', error);
      }
    } catch (err) {
      console.error('Supabase importToWatchlist error:', err);
    }
  }

  return {
    toAdd,
    addedCount: toAdd.length,
    skippedCount,
  };
}

export async function executeListImport(params: {
  options: ListImportOptions;
  currentLists: MovieList[];
  createList: (
    newList: Omit<MovieList, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>,
  ) => string;
  updateList: (
    listId: string,
    updates: Omit<MovieList, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>,
  ) => void;
  importToProfile: (items: ProfileImportPayloadItem[]) => Promise<ProfileImportSummary>;
}): Promise<{ listId: string; totalCount: number; addedCount: number }> {
  const { options, currentLists, createList, updateList, importToProfile } = params;
  const {
    targetListId,
    newListTitle,
    newListDescription = '',
    newListTags,
    isRanked = false,
    isPrivate = false,
    replaceExisting = false,
    markAsWatched = false,
    items,
  } = options;

  if (markAsWatched && items.length > 0) {
    await importToProfile(
      items.map((m) => ({
        movieId: m.id,
        movieTitle: m.title,
        moviePoster: m.poster_path,
        movieYear: m.release_date ? m.release_date.slice(0, 4) : '',
        watchedDate: '',
        rating: 0,
        isRewatch: false,
        liked: false,
        reviewText: '',
        tags: [],
      })),
    );
  }

  const existingList =
    targetListId !== 'new' ? currentLists.find((l) => l.id === targetListId) : undefined;

  if (existingList) {
    let finalMovies: MovieList['movies'];
    let addedCount = 0;

    if (replaceExisting) {
      const seen = new Set<number>();
      finalMovies = [];
      for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        finalMovies.push({
          id: item.id,
          title: item.title,
          poster_path: item.poster_path,
          release_date: item.release_date,
          notes: item.notes,
          director: item.director,
        });
        addedCount++;
      }
    } else {
      const existingSet = new Set(existingList.movies.map((m) => m.id));
      const appended: MovieList['movies'] = [];
      for (const item of items) {
        if (existingSet.has(item.id)) continue;
        existingSet.add(item.id);
        appended.push({
          id: item.id,
          title: item.title,
          poster_path: item.poster_path,
          release_date: item.release_date,
          notes: item.notes,
          director: item.director,
        });
        addedCount++;
      }
      finalMovies = [...existingList.movies, ...appended];
    }

    updateList(existingList.id, {
      title: existingList.title,
      description: existingList.description,
      isRanked: existingList.isRanked,
      isPrivate: existingList.isPrivate,
      tags: existingList.tags,
      movies: finalMovies,
    });

    return {
      listId: existingList.id,
      totalCount: finalMovies.length,
      addedCount,
    };
  }

  const seen = new Set<number>();
  const dedupedMovies: MovieList['movies'] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    dedupedMovies.push({
      id: item.id,
      title: item.title,
      poster_path: item.poster_path,
      release_date: item.release_date,
      notes: item.notes,
      director: item.director,
    });
  }

  const newId = createList({
    title: (newListTitle || 'Imported List').trim(),
    description: newListDescription.trim(),
    isRanked,
    isPrivate,
    tags: newListTags && newListTags.length > 0 ? newListTags : undefined,
    movies: dedupedMovies,
  });

  return {
    listId: newId,
    totalCount: dedupedMovies.length,
    addedCount: dedupedMovies.length,
  };
}
