import {
  getFilmsHubInFlight,
  getSeriesHubInFlight,
  setFilmsHubInFlight,
  setSeriesHubInFlight,
} from './cache';
import {
  CURRENT_YEAR,
  daysOffsetIso,
  daysSinceDate,
  fetchFromTMDB,
  isFuture,
  isReleasedWithVotes,
  itemDate,
  normalizeMediaItem,
  TMDB_TODAY,
  TMDB_TOMORROW,
  toOriginCountryIso,
  TV_EXCLUDED_GENRE_IDS,
  TV_EXCLUDED_GENRES,
} from './client';
import {
  buildCuratedMostAnticipatedMoviesPool,
  buildCuratedPopularMoviesPool,
  buildCuratedPopularSeriesPool,
  filterStrictlyUnreleasedMovies,
} from './curators';
import type { DiscoverMediaParams, HubSectionsResult, TMDBMovie, TMDBResponse } from './types';

export async function discoverByKeywordsOrGenres(
  type: 'movie' | 'tv',
  options: {
    genreIds?: number[];
    keywordIds?: number[];
    excludeId?: number;
    decade?: number;
    providerId?: number;
    page?: number;
  },
): Promise<{ results: TMDBMovie[]; total_results: number }> {
  const params: Record<string, string | number | undefined> = {
    sort_by: 'popularity.desc',
    'vote_count.gte': type === 'tv' ? 20 : 40,
    include_adult: 'false',
    page: options.page || 1,
  };
  if (type === 'tv') {
    params.without_genres = TV_EXCLUDED_GENRES;
    params['first_air_date.lte'] = TMDB_TODAY;
    if (options.decade) {
      params['first_air_date.gte'] = `${options.decade}-01-01`;
      params['first_air_date.lte'] = `${options.decade + 9}-12-31`;
    }
  } else {
    params['primary_release_date.lte'] = TMDB_TODAY;
    if (options.decade) {
      params['primary_release_date.gte'] = `${options.decade}-01-01`;
      params['primary_release_date.lte'] = `${options.decade + 9}-12-31`;
    }
  }
  if (options.providerId) {
    params.with_watch_providers = options.providerId;
    params.watch_region = 'US';
  }
  if (options.genreIds && options.genreIds.length > 0) {
    params.with_genres = options.genreIds.join(',');
  }
  if (options.keywordIds && options.keywordIds.length > 0) {
    params.with_keywords = options.keywordIds.join('|');
  }

  const res = await fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/discover/${type}`, params);
  const items = (res.results || [])
    .map(normalizeMediaItem)
    .filter((m) => Boolean(m.poster_path) && m.id !== options.excludeId);
  return {
    results: items,
    total_results: Math.max(res.total_results || items.length, items.length),
  };
}

export async function discoverMovies(params: DiscoverMediaParams): Promise<TMDBResponse<TMDBMovie>> {
  const futureYear =
    (params.year && params.year > CURRENT_YEAR) ||
    (params.decade && params.decade + 9 > CURRENT_YEAR);

  const apiParams: Record<string, string | number | undefined> = {
    page: params.page || 1,
    sort_by: params.sortBy || 'popularity.desc',
    'vote_count.gte':
      params.releaseDateGte || futureYear
        ? undefined
        : params.minVotes ??
          (params.sortBy?.includes('vote_average')
            ? 200
            : params.sortBy?.includes('vote_count')
              ? 100
              : 30),
    include_adult: 'false',
  };

  if (params.withoutGenres) {
    apiParams.without_genres = params.withoutGenres;
  }

  if (params.country) {
    const iso = toOriginCountryIso(params.country);
    if (iso) apiParams.with_origin_country = iso;
  }

  if (params.genreId) {
    apiParams.with_genres = params.genreId;
  }

  if (params.providerId) {
    apiParams.with_watch_providers = params.providerId;
    apiParams.watch_region = 'US';
  }

  if (params.language) {
    apiParams.with_original_language = params.language;
  } else if (params.releaseDateGte && params.releaseDateGte > TMDB_TODAY && !params.country) {
    apiParams.with_original_language = 'en|pt|es|fr|ja|ko';
  }

  if (params.year) {
    apiParams.primary_release_year = params.year;
  } else if (params.decade) {
    apiParams['primary_release_date.gte'] = `${params.decade}-01-01`;
    apiParams['primary_release_date.lte'] = `${params.decade + 9}-12-31`;
  }

  if (params.releaseDateGte) apiParams['primary_release_date.gte'] = params.releaseDateGte;
  if (params.releaseDateLte) apiParams['primary_release_date.lte'] = params.releaseDateLte;

  return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', apiParams);
}

export async function discoverMoviesBatch(
  params: DiscoverMediaParams,
): Promise<{ results: TMDBMovie[]; total_results: number; total_pages: number }> {
  const startPage = ((params.page || 1) - 1) * (params.pagesToFetch || 3) + 1;
  const count = params.pagesToFetch || 3;
  const pageNumbers = Array.from({ length: count }, (_, i) => startPage + i);

  const responses = await Promise.all(
    pageNumbers.map((p) =>
      discoverMovies({ ...params, page: p }).catch(() => ({
        results: [] as TMDBMovie[],
        total_results: 0,
        total_pages: 0,
        page: p,
      })),
    ),
  );

  const allResults = responses.flatMap((r) => r.results);
  const seen = new Set<number>();
  const unique = allResults.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  const firstRes = responses[0] || { total_results: 0, total_pages: 1 };
  const isUpcomingQuery = Boolean(params.releaseDateGte && params.releaseDateGte > TMDB_TODAY);
  const allowIndianLangs = Boolean(
    params.language || (params.country && toOriginCountryIso(params.country) === 'IN'),
  );
  const filteredResults = isUpcomingQuery
    ? await filterStrictlyUnreleasedMovies(unique, allowIndianLangs)
    : unique;

  return {
    results: filteredResults,
    total_results: firstRes.total_results,
    total_pages: Math.ceil(firstRes.total_pages / count),
  };
}

export async function discoverTV(params: DiscoverMediaParams): Promise<TMDBResponse<TMDBMovie>> {
  const antiGenres =
    params.genreId && TV_EXCLUDED_GENRE_IDS.has(params.genreId)
      ? params.withoutGenres
      : [TV_EXCLUDED_GENRES, params.withoutGenres].filter(Boolean).join(',');

  const futureYear =
    (params.year && params.year > CURRENT_YEAR) ||
    (params.decade && params.decade + 9 > CURRENT_YEAR);

  const apiParams: Record<string, string | number | undefined> = {
    page: params.page || 1,
    sort_by: params.sortBy || 'popularity.desc',
    'vote_count.gte':
      params.releaseDateGte || futureYear
        ? undefined
        : params.minVotes ?? (params.sortBy?.includes('vote_average') ? 100 : 20),
    include_adult: 'false',
    without_genres: antiGenres,
  };

  if (params.genreId) apiParams.with_genres = params.genreId;

  if (params.country) {
    const iso = toOriginCountryIso(params.country);
    if (iso) apiParams.with_origin_country = iso;
  }
  if (params.providerId) {
    apiParams.with_watch_providers = params.providerId;
    apiParams.watch_region = 'US';
  }
  if (params.language) apiParams.with_original_language = params.language;

  if (params.year) {
    apiParams.first_air_date_year = params.year;
  } else if (params.decade) {
    apiParams['first_air_date.gte'] = `${params.decade}-01-01`;
    apiParams['first_air_date.lte'] = `${params.decade + 9}-12-31`;
  }

  if (params.releaseDateGte) apiParams['first_air_date.gte'] = params.releaseDateGte;
  if (params.releaseDateLte) apiParams['first_air_date.lte'] = params.releaseDateLte;

  return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/tv', apiParams);
}

export async function discoverTVBatch(
  params: DiscoverMediaParams,
): Promise<{ results: TMDBMovie[]; total_results: number; total_pages: number }> {
  const startPage = ((params.page || 1) - 1) * (params.pagesToFetch || 3) + 1;
  const count = params.pagesToFetch || 3;
  const pageNumbers = Array.from({ length: count }, (_, i) => startPage + i);
  const responses = await Promise.all(
    pageNumbers.map((p) =>
      discoverTV({ ...params, page: p }).catch(() => ({
        results: [] as TMDBMovie[],
        total_results: 0,
        total_pages: 0,
        page: p,
      })),
    ),
  );
  const allResults = responses.flatMap((r) => r.results);
  const seen = new Set<number>();
  const unique = allResults.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
  const firstRes = responses[0] || { total_results: 0, total_pages: 1 };
  return {
    results: unique,
    total_results: firstRes.total_results,
    total_pages: Math.ceil(firstRes.total_pages / count),
  };
}

export async function getCuratedPopularBatch(
  type: 'movie' | 'tv',
  page = 1,
  targetCount = 72,
): Promise<{ results: TMDBMovie[]; total_results: number; total_pages: number }> {
  const baseBatch = (page - 1) * 2;
  const buildFn = type === 'tv' ? buildCuratedPopularSeriesPool : buildCuratedPopularMoviesPool;
  const [poolA, poolB] = await Promise.all([buildFn(baseBatch), buildFn(baseBatch + 1)]);
  const seen = new Set<number>();
  const merged: TMDBMovie[] = [];
  for (const item of [...poolA, ...poolB]) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return {
    results: merged.slice(0, targetCount),
    total_results: type === 'tv' ? 3600 : 10000,
    total_pages: 50,
  };
}

export async function getSectionMedia(
  type: 'movie' | 'tv',
  preset: 'popular_week' | 'highest_rated' | 'most_watched' | 'most_anticipated',
  page = 1,
  extraFilters: {
    genreId?: number;
    year?: number;
    decade?: number;
    providerId?: number;
    country?: string;
    language?: string;
  } = {},
): Promise<{ results: TMDBMovie[]; total_pages: number; total_results: number }> {
  const discover = type === 'tv' ? discoverTVBatch : discoverMoviesBatch;
  const minVotesPopular = type === 'tv' ? 20 : 30;

  if (preset === 'popular_week') {
    const hasExtraFilters = Boolean(
      extraFilters.genreId ||
        extraFilters.year ||
        extraFilters.decade ||
        extraFilters.providerId ||
        extraFilters.country ||
        extraFilters.language,
    );

    if (!hasExtraFilters) {
      const pageSize = 24;
      const batchIndex = Math.floor((page - 1) / 2);
      const isSecondHalf = (page - 1) % 2 === 1;
      const buildFn = type === 'tv' ? buildCuratedPopularSeriesPool : buildCuratedPopularMoviesPool;

      const primaryPool = await buildFn(batchIndex);
      let results: TMDBMovie[];

      if (!isSecondHalf) {
        results = primaryPool.slice(0, pageSize);
      } else {
        const rest = primaryPool.slice(pageSize, pageSize * 2);
        if (rest.length >= 16) {
          results = rest;
        } else {
          const nextPool = await buildFn(batchIndex + 1);
          const seen = new Set(primaryPool.slice(0, pageSize).map((m) => m.id));
          results = [...rest, ...nextPool.filter((m) => !seen.has(m.id))].slice(0, pageSize);
        }
      }

      return {
        results,
        total_pages: 40,
        total_results: type === 'tv' ? 1200 : 2400,
      };
    }

    const isHistoricalFilter =
      (extraFilters.year && extraFilters.year < CURRENT_YEAR) ||
      (extraFilters.decade && extraFilters.decade + 9 < CURRENT_YEAR);

    if (!isHistoricalFilter) {
      const recentWindowStart = daysOffsetIso(-135);
      const [recentRes, generalRes] = await Promise.all([
        discover({
          ...extraFilters,
          sortBy: 'popularity.desc',
          releaseDateGte: recentWindowStart,
          releaseDateLte: TMDB_TODAY,
          minVotes: type === 'tv' ? 10 : 15,
          page,
          pagesToFetch: 1,
        }),
        discover({
          ...extraFilters,
          sortBy: 'popularity.desc',
          releaseDateLte: TMDB_TODAY,
          minVotes: minVotesPopular,
          page,
          pagesToFetch: 1,
        }),
      ]);

      const seen = new Set<number>();
      const candidates: TMDBMovie[] = [];
      for (const m of [...(recentRes.results || []), ...(generalRes.results || [])]) {
        if (m && m.id && !seen.has(m.id)) {
          seen.add(m.id);
          candidates.push(m);
        }
      }

      const recentSet = new Set((recentRes.results || []).map((m) => m.id));
      const scored = candidates
        .filter((m) => {
          const d = itemDate(m);
          const minV = recentSet.has(m.id) ? (type === 'tv' ? 10 : 15) : minVotesPopular;
          return Boolean(d) && d <= TMDB_TODAY && (m.vote_count || 0) >= minV;
        })
        .map((m) => {
          const ageDays = daysSinceDate(itemDate(m));
          let s =
            Math.sqrt(Math.max(1, m.popularity || 1)) * 8 +
            Math.log10(Math.max(10, m.vote_count || 10)) * 22;
          if (ageDays >= 0 && ageDays <= 60) s += 180;
          else if (ageDays > 60 && ageDays <= 135) s += 115;
          else if (ageDays > 365) s -= 65;
          return { m, s };
        })
        .sort((a, b) => b.s - a.s);

      return {
        results: scored.map((x) => x.m),
        total_pages: Math.max(recentRes.total_pages || 1, generalRes.total_pages || 1),
        total_results: Math.max(recentRes.total_results || 0, generalRes.total_results || 0),
      };
    }
  }

  const presetParams = {
    popular_week: {
      sortBy: 'popularity.desc',
      releaseDateLte: TMDB_TODAY,
      minVotes: minVotesPopular,
    },
    highest_rated: {
      sortBy: 'vote_average.desc',
      releaseDateLte: TMDB_TODAY,
      minVotes: type === 'tv' ? 1500 : 10000,
      withoutGenres: type === 'movie' ? ('99,10402' as string | undefined) : undefined,
    },
    most_watched: {
      sortBy: 'vote_count.desc',
      releaseDateLte: TMDB_TODAY,
      minVotes: type === 'tv' ? 100 : 500,
    },
    most_anticipated: {
      sortBy: 'popularity.desc',
      releaseDateGte: TMDB_TOMORROW,
    },
  }[preset];

  const hasExtraFilters = Boolean(
    extraFilters.genreId ||
      extraFilters.year ||
      extraFilters.decade ||
      extraFilters.providerId ||
      extraFilters.country ||
      extraFilters.language,
  );

  if (preset === 'most_anticipated' && type === 'movie' && !hasExtraFilters) {
    const curated = await buildCuratedMostAnticipatedMoviesPool(page);
    return {
      results: curated,
      total_pages: 20,
      total_results: 400,
    };
  }

  const res = await discover({
    ...extraFilters,
    ...presetParams,
    page,
    pagesToFetch: preset === 'most_anticipated' ? 2 : 1,
  });

  if (preset === 'most_anticipated') {
    const allowIndianLangs = Boolean(
      extraFilters.language ||
        (extraFilters.country && toOriginCountryIso(extraFilters.country) === 'IN'),
    );
    const results =
      type === 'movie'
        ? await filterStrictlyUnreleasedMovies(res.results, allowIndianLangs)
        : res.results.filter(isFuture);
    return { ...res, results };
  }

  const gate: (m: TMDBMovie) => boolean =
    preset === 'highest_rated'
      ? (m) => isReleasedWithVotes(m, type === 'tv' ? 1500 : 10000)
      : (m) => isReleasedWithVotes(m, preset === 'most_watched' ? 1 : minVotesPopular);

  return { ...res, results: res.results.filter(gate) };
}

export async function getFilmsHubSections(): Promise<HubSectionsResult> {
  const inflight = getFilmsHubInFlight();
  if (inflight) return inflight;

  const promise = (async () => {
    const [popRes, ratedRes, watchedRes, anticipatedRes] = await Promise.all([
      getSectionMedia('movie', 'popular_week', 1),
      getSectionMedia('movie', 'highest_rated', 1),
      getSectionMedia('movie', 'most_watched', 1),
      getSectionMedia('movie', 'most_anticipated', 1),
    ]);

    const popular = popRes.results;
    const highestRated = ratedRes.results;
    const mostWatched = watchedRes.results;

    const seenIds = new Set([...popular, ...highestRated, ...mostWatched].map((m) => m.id));
    const mostAnticipated = anticipatedRes.results.filter((m) => !seenIds.has(m.id));

    return { popular, highestRated, mostWatched, mostAnticipated };
  })().finally(() => {
    setFilmsHubInFlight(null);
  });

  setFilmsHubInFlight(promise);
  return promise;
}

export async function getSeriesHubSections(): Promise<HubSectionsResult> {
  const inflight = getSeriesHubInFlight();
  if (inflight) return inflight;

  const promise = (async () => {
    const [popRes, ratedRes, watchedRes, anticipatedRes] = await Promise.all([
      getSectionMedia('tv', 'popular_week', 1),
      getSectionMedia('tv', 'highest_rated', 1),
      getSectionMedia('tv', 'most_watched', 1),
      getSectionMedia('tv', 'most_anticipated', 1),
    ]);

    const popular = popRes.results;
    const highestRated = ratedRes.results;
    const mostWatched = watchedRes.results;

    const seenIds = new Set([...popular, ...highestRated, ...mostWatched].map((m) => m.id));
    const mostAnticipated = anticipatedRes.results.filter((m) => !seenIds.has(m.id));

    return { popular, highestRated, mostWatched, mostAnticipated };
  })().finally(() => {
    setSeriesHubInFlight(null);
  });

  setSeriesHubInFlight(promise);
  return promise;
}
