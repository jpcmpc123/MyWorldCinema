import {
  anticipatedPoolCache,
  mediaDetailsCache,
  movieHasPastReleaseCache,
  popularWeekInFlight,
  popularWeekPoolCache,
} from './cache';
import {
  daysOffsetIso,
  daysSinceDate,
  fetchFromTMDB,
  getTmdbLanguage,
  isFuture,
  itemDate,
  normalizeMediaItem,
  TMDB_TODAY,
  TMDB_TOMORROW,
  TV_EXCLUDED_GENRE_IDS,
  TV_EXCLUDED_GENRES,
} from './client';
import type { TMDBMovie, TMDBResponse } from './types';

const INDIAN_REGIONAL_LANGS = new Set([
  'hi',
  'te',
  'ta',
  'ml',
  'kn',
  'pa',
  'bn',
  'mr',
  'ur',
  'gu',
  'or',
  'as',
]);

// IDs de grandes estúdios (Marvel, Warner, DC, Universal, Paramount, Disney, Pixar, 20th Century,
// Searchlight, Columbia, Sony, A24, Lionsgate, MGM, Focus, DreamWorks, Illumination, Legendary, Blumhouse, Neon, Apple)
const MAJOR_STUDIO_COMPANY_IDS =
  '420|174|184898|128064|33|4|2|6125|3|127928|25|43|5|34|2251|41077|1632|21|210099|10146|521|6704|923|3172|90733|194232';

// Títulos-chave altamente aguardados mundialmente recebem bônus de destaque na frente da vitrine
const FLAGSHIP_ANTICIPATED_MOVIE_IDS = new Set<number>([
  1003596, // Avengers: Doomsday
  1170608, // Dune: Part Three
  806704,  // The Batman: Part II
  911916,  // Spider-Man: Beyond the Spider-Verse
  1003598, // Avengers: Secret Wars
  1300968, // The Hunger Games: Sunrise on the Reaping
  1147572, // Narnia: The Magician's Nephew
  421892,  // Shrek 5
  1421903, // Werwulf
  1327821, // Incredibles 3
  1024604, // Frozen III
  1401586, // Sonic the Hedgehog 4
  1260649, // Jumanji: Open World
  1288438, // Godzilla x Kong: Supernova
  1457866, // The Further Mis-Adventures of Cliff Booth
  1523140, // Man of Tomorrow
  1384758, // Ice Age: Boiling Point
  1497464, // Gatto (Pixar)
  1538497, // Hexed (Disney)
  1574840, // The Mummy: Book of the Dead
  1131943, // Madden
  1400336, // Focker-in-Law
  1437511, // How to Rob a Bank
  755679,  // Fast Forever
  1451567, // Coco 2
  1461519, // A Minecraft Movie Squared
  1567605, // Ebenezer
  1425859, // Remain
  1440769, // The Beekeeper 2
]);

async function hasMovieReleasedInAnyCountry(movieId: number): Promise<boolean> {
  const cached = movieHasPastReleaseCache.get(movieId);
  if (cached !== undefined) return cached;

  for (const lang of ['pt-BR', 'en-US']) {
    const det = mediaDetailsCache.get(`movie:${movieId}:${lang}`);
    if (det && det.release_dates?.results) {
      const hasPast = det.release_dates.results.some((g) =>
        (g.release_dates || []).some((r) => {
          const d = (r.release_date || '').slice(0, 10);
          return Boolean(d) && d <= TMDB_TODAY;
        }),
      );
      movieHasPastReleaseCache.set(movieId, hasPast);
      return hasPast;
    }
  }

  try {
    const rd = await fetchFromTMDB<{
      id: number;
      results?: { iso_3166_1: string; release_dates?: { release_date?: string }[] }[];
    }>(`/movie/${movieId}/release_dates`);
    const hasPast = (rd.results || []).some((g) =>
      (g.release_dates || []).some((r) => {
        const d = (r.release_date || '').slice(0, 10);
        return Boolean(d) && d <= TMDB_TODAY;
      }),
    );
    movieHasPastReleaseCache.set(movieId, hasPast);
    return hasPast;
  } catch {
    return false;
  }
}

export async function filterStrictlyUnreleasedMovies(
  movies: TMDBMovie[],
  allowIndianLangs = false,
): Promise<TMDBMovie[]> {
  const baseCandidates = movies.filter((m) => {
    if (!isFuture(m)) return false;
    if (!allowIndianLangs) {
      const lang = (m.original_language || '').toLowerCase();
      if (lang && INDIAN_REGIONAL_LANGS.has(lang)) return false;
    }
    return true;
  });
  if (baseCandidates.length === 0) return [];
  const checks = await Promise.all(
    baseCandidates.map(async (m) => ({
      movie: m,
      alreadyReleasedAbroad: await hasMovieReleasedInAnyCountry(m.id),
    })),
  );
  return checks.filter((c) => !c.alreadyReleasedAbroad).map((c) => c.movie);
}

export async function buildCuratedMostAnticipatedMoviesPool(page = 1): Promise<TMDBMovie[]> {
  const lang = getTmdbLanguage();
  const cacheKey = `movie:anticipated_pool_v2:${page}:${lang}`;
  const cached = anticipatedPoolCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const emptyRes: TMDBResponse<TMDBMovie> = {
    page: 1,
    results: [],
    total_pages: 1,
    total_results: 0,
  };

  const baseStudioPage = (page - 1) * 2 + 1;
  const [studioP1, studioP2, mainstreamP1, mainstreamP2] = await Promise.all([
    fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', {
      sort_by: 'popularity.desc',
      'primary_release_date.gte': TMDB_TOMORROW,
      with_companies: MAJOR_STUDIO_COMPANY_IDS,
      with_original_language: 'en|pt|ja|ko|fr|es',
      include_adult: 'false',
      page: baseStudioPage,
    }).catch(() => emptyRes),
    fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', {
      sort_by: 'popularity.desc',
      'primary_release_date.gte': TMDB_TOMORROW,
      with_companies: MAJOR_STUDIO_COMPANY_IDS,
      with_original_language: 'en|pt|ja|ko|fr|es',
      include_adult: 'false',
      page: baseStudioPage + 1,
    }).catch(() => emptyRes),
    fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', {
      sort_by: 'popularity.desc',
      'primary_release_date.gte': TMDB_TOMORROW,
      with_original_language: 'en|pt',
      include_adult: 'false',
      page: baseStudioPage,
    }).catch(() => emptyRes),
    fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', {
      sort_by: 'popularity.desc',
      'primary_release_date.gte': TMDB_TOMORROW,
      with_original_language: 'en|pt',
      include_adult: 'false',
      page: baseStudioPage + 1,
    }).catch(() => emptyRes),
  ]);

  const studioIds = new Set<number>(
    [...(studioP1.results || []), ...(studioP2.results || [])].map((m) => m.id),
  );

  const seen = new Set<number>();
  const merged: TMDBMovie[] = [];
  for (const list of [
    studioP1.results || [],
    studioP2.results || [],
    mainstreamP1.results || [],
    mainstreamP2.results || [],
  ]) {
    for (const raw of list) {
      const m = normalizeMediaItem(raw);
      if (m && m.id && m.poster_path && !seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }
  }

  const strictlyUnreleased = await filterStrictlyUnreleasedMovies(merged, false);

  const scored = strictlyUnreleased.map((m) => {
    let score = Math.min(80, Math.sqrt(Math.max(1, m.popularity || 1)) * 10);
    if (FLAGSHIP_ANTICIPATED_MOVIE_IDS.has(m.id)) {
      score += 220;
    }
    if (studioIds.has(m.id)) {
      score += 95;
    }
    if (m.backdrop_path) {
      score += 35;
    } else {
      score -= 60;
    }
    if ((m.overview || '').trim().length >= 60) {
      score += 15;
    }
    return { m, score };
  });

  scored.sort((a, b) => b.score - a.score || (b.m.popularity || 0) - (a.m.popularity || 0));
  const finalItems = scored.map((x) => x.m);
  anticipatedPoolCache.set(cacheKey, finalItems);
  return finalItems;
}

// ---------------------------------------------------------------------------
// Motor Inteligente "Popular da Semana" (Filmes & Séries)
// ---------------------------------------------------------------------------

export async function buildCuratedPopularMoviesPool(batchIndex = 0): Promise<TMDBMovie[]> {
  const lang = getTmdbLanguage();
  const cacheKey = `movie:pop_week_pool_v6:${batchIndex}:${lang}`;
  const cached = popularWeekPoolCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inflight = popularWeekInFlight.get(cacheKey);
  if (inflight) return inflight;

  const task = (async () => {
    const discPage = batchIndex + 1;
    const date60DaysAgo = daysOffsetIso(-60);
    const date120DaysAgo = daysOffsetIso(-120);

    const emptyRes: TMDBResponse<TMDBMovie> = {
      page: 1,
      results: [],
      total_pages: 1,
      total_results: 0,
    };

    const [
      theatricalBR,
      theatricalUS,
      digitalUS,
      digitalBR,
      trendWeekRes,
    ] = await Promise.all([
      fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', {
        with_release_type: '3',
        region: 'BR',
        'release_date.gte': date60DaysAgo,
        'release_date.lte': TMDB_TODAY,
        sort_by: 'popularity.desc',
        'vote_count.gte': 10,
        include_adult: 'false',
        page: discPage,
      }).catch(() => emptyRes),
      fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', {
        with_release_type: '3',
        region: 'US',
        'release_date.gte': date60DaysAgo,
        'release_date.lte': TMDB_TODAY,
        sort_by: 'popularity.desc',
        'vote_count.gte': 10,
        include_adult: 'false',
        page: discPage,
      }).catch(() => emptyRes),
      fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', {
        with_release_type: '4|5|6',
        region: 'US',
        'release_date.gte': date120DaysAgo,
        'release_date.lte': TMDB_TODAY,
        sort_by: 'popularity.desc',
        include_adult: 'false',
        page: discPage,
      }).catch(() => emptyRes),
      fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', {
        with_release_type: '4|5|6',
        region: 'BR',
        'release_date.gte': date120DaysAgo,
        'release_date.lte': TMDB_TODAY,
        sort_by: 'popularity.desc',
        include_adult: 'false',
        page: discPage,
      }).catch(() => emptyRes),
      fetchFromTMDB<TMDBResponse<TMDBMovie>>('/trending/movie/week', { page: discPage }).catch(() => emptyRes),
    ]);

    const theatricalList = [
      ...(theatricalBR.results || []),
      ...(theatricalUS.results || []),
    ].map(normalizeMediaItem);

    const digitalAndStreamingList = [
      ...(digitalUS.results || []),
      ...(digitalBR.results || []),
    ].map(normalizeMediaItem);

    const trendWeekList = (trendWeekRes.results || []).map(normalizeMediaItem);

    const theatricalRankMap = new Map<number, number>();
    theatricalList.forEach((m, idx) => {
      if (!theatricalRankMap.has(m.id)) theatricalRankMap.set(m.id, idx);
    });

    const digitalRankMap = new Map<number, number>();
    digitalAndStreamingList.forEach((m, idx) => {
      if (!digitalRankMap.has(m.id)) digitalRankMap.set(m.id, idx);
    });

    const trendWeekRankMap = new Map<number, number>();
    trendWeekList.forEach((m, idx) => {
      if (!trendWeekRankMap.has(m.id)) trendWeekRankMap.set(m.id, idx);
    });

    const candidatesMap = new Map<number, TMDBMovie>();
    for (const list of [theatricalList, digitalAndStreamingList, trendWeekList]) {
      for (const item of list) {
        if (!item || !item.id) continue;
        const existing = candidatesMap.get(item.id);
        if (!existing) {
          candidatesMap.set(item.id, { ...item });
        } else {
          const newDate = itemDate(item);
          const oldDate = itemDate(existing);
          if (
            newDate &&
            newDate <= TMDB_TODAY &&
            (!oldDate || oldDate > TMDB_TODAY || newDate < oldDate)
          ) {
            existing.release_date = newDate;
          }
        }
      }
    }

    const scored: { movie: TMDBMovie; score: number }[] = [];

    for (const cand of candidatesMap.values()) {
      if (!cand.poster_path) continue;
      const d = itemDate(cand);
      if (!d || d > TMDB_TODAY) continue;

      const ageDays = daysSinceDate(d);
      const votes = cand.vote_count || 0;
      const rating = cand.vote_average || 0;
      const pop = cand.popularity || 0;

      const minVotesRequired = ageDays <= 25 ? 20 : 30;
      if (votes < minVotesRequired) continue;
      if (votes < 70 && rating > 0 && rating < 4.8) continue;

      const isOldReRelease = ageDays > 180;

      const thRank = !isOldReRelease ? theatricalRankMap.get(cand.id) : undefined;
      const digRank = digitalRankMap.get(cand.id);
      const twRank = trendWeekRankMap.get(cand.id);
      const inTrending = twRank !== undefined;

      const isExclusiveCinemaNow =
        thRank !== undefined && digRank === undefined && ageDays >= -1 && ageDays <= 65;

      const isCinemaToStreamingRecent =
        !isExclusiveCinemaNow &&
        ((thRank !== undefined && digRank !== undefined && ageDays <= 135) ||
          (thRank === undefined && digRank !== undefined && votes >= 500 && ageDays <= 135));

      const isDirectStreamingOriginal =
        !isExclusiveCinemaNow && !isCinemaToStreamingRecent && digRank !== undefined;

      let score = 0;

      if (isExclusiveCinemaNow && thRank !== undefined) {
        score += 750 - Math.min(180, thRank * 3.5);
        if (inTrending) score += 160;
        if (ageDays <= 21) score += 110;
        else if (ageDays <= 45) score += 70;
      } else if (isCinemaToStreamingRecent) {
        score += 460 - Math.min(140, (digRank ?? 20) * 2.5);
        if (inTrending) score += 110;
      } else if (isDirectStreamingOriginal) {
        score += 220 - Math.min(90, (digRank ?? 20) * 2.0);
      }

      if (twRank !== undefined) {
        score += Math.max(20, 140 - twRank * 2.5);
      }

      score += Math.min(90, Math.log10(Math.max(10, votes)) * 25);
      score += Math.min(60, Math.sqrt(Math.max(1, pop)) * 3.2);
      if (rating >= 6.2) {
        score += (rating - 5.8) * 14;
      } else if (rating > 0 && rating < 5.2) {
        score -= 35;
      }

      if (ageDays > 365) {
        score -= 200;
      } else if (ageDays > 165) {
        score -= 80;
      }

      scored.push({ movie: cand, score });
    }

    scored.sort((a, b) => b.score - a.score || (b.movie.popularity || 0) - (a.movie.popularity || 0));
    const items = scored.map((s) => s.movie);
    popularWeekPoolCache.set(cacheKey, items);
    return items;
  })().finally(() => {
    popularWeekInFlight.delete(cacheKey);
  });

  popularWeekInFlight.set(cacheKey, task);
  return task;
}

export async function buildCuratedPopularSeriesPool(batchIndex = 0): Promise<TMDBMovie[]> {
  const lang = getTmdbLanguage();
  const cacheKey = `tv:pop_week_pool_v6:${batchIndex}:${lang}`;
  const cached = popularWeekPoolCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inflight = popularWeekInFlight.get(cacheKey);
  if (inflight) return inflight;

  const task = (async () => {
    const discPage = batchIndex + 1;
    const date21DaysAgo = daysOffsetIso(-21);
    const date120DaysAgo = daysOffsetIso(-120);

    const emptyRes: TMDBResponse<TMDBMovie> = {
      page: 1,
      results: [],
      total_pages: 1,
      total_results: 0,
    };

    const [
      onAirRes,
      recentEpisodesDiscRes,
      recentStreamingDiscRes,
      trendWeekRes,
    ] = await Promise.all([
      fetchFromTMDB<TMDBResponse<TMDBMovie>>('/tv/on_the_air', { page: discPage }).catch(() => emptyRes),
      fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/tv', {
        'air_date.gte': date21DaysAgo,
        'air_date.lte': TMDB_TOMORROW,
        'first_air_date.lte': TMDB_TODAY,
        without_genres: TV_EXCLUDED_GENRES,
        sort_by: 'popularity.desc',
        'vote_count.gte': 15,
        include_adult: 'false',
        page: discPage,
      }).catch(() => emptyRes),
      fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/tv', {
        with_watch_monetization_types: 'flatrate',
        watch_region: 'US',
        'first_air_date.gte': date120DaysAgo,
        'first_air_date.lte': TMDB_TODAY,
        without_genres: TV_EXCLUDED_GENRES,
        sort_by: 'popularity.desc',
        'vote_count.gte': 12,
        include_adult: 'false',
        page: discPage,
      }).catch(() => emptyRes),
      fetchFromTMDB<TMDBResponse<TMDBMovie>>('/trending/tv/week', { page: discPage }).catch(() => emptyRes),
    ]);

    const onAirList = [
      ...(onAirRes.results || []),
      ...(recentEpisodesDiscRes.results || []),
    ].map(normalizeMediaItem);

    const recentStreamingList = (recentStreamingDiscRes.results || []).map(normalizeMediaItem);
    const trendWeekList = (trendWeekRes.results || []).map(normalizeMediaItem);

    const onAirRankMap = new Map<number, number>();
    onAirList.forEach((m, idx) => {
      if (!onAirRankMap.has(m.id)) onAirRankMap.set(m.id, idx);
    });

    const streamingRankMap = new Map<number, number>();
    recentStreamingList.forEach((m, idx) => {
      if (!streamingRankMap.has(m.id)) streamingRankMap.set(m.id, idx);
    });

    const trendWeekRankMap = new Map<number, number>();
    trendWeekList.forEach((m, idx) => {
      if (!trendWeekRankMap.has(m.id)) trendWeekRankMap.set(m.id, idx);
    });

    const candidatesMap = new Map<number, TMDBMovie>();
    for (const list of [onAirList, recentStreamingList, trendWeekList]) {
      for (const item of list) {
        if (item && item.id && !candidatesMap.has(item.id)) {
          candidatesMap.set(item.id, item);
        }
      }
    }

    const scored: { movie: TMDBMovie; score: number }[] = [];

    for (const cand of candidatesMap.values()) {
      if (!cand.poster_path) continue;
      if (cand.genre_ids?.some((g) => TV_EXCLUDED_GENRE_IDS.has(g))) continue;

      const d = itemDate(cand);
      if (!d || d > TMDB_TODAY) continue;

      const ageDays = daysSinceDate(d);
      const votes = cand.vote_count || 0;
      const rating = cand.vote_average || 0;
      const pop = cand.popularity || 0;

      const minVotesRequired = ageDays <= 35 ? 8 : 20;
      if (votes < minVotesRequired) continue;
      if (votes < 40 && rating > 0 && rating < 4.8) continue;

      const oaRank = onAirRankMap.get(cand.id);
      const stRank = streamingRankMap.get(cand.id);
      const twRank = trendWeekRankMap.get(cand.id);

      const isAiringNow = oaRank !== undefined;
      const isRecentStreaming = stRank !== undefined || (ageDays >= 0 && ageDays <= 120);
      const inTrending = twRank !== undefined;

      let score = 0;

      if (isAiringNow && oaRank !== undefined) {
        score += Math.max(130, 275 - oaRank * 2.5);
        if (inTrending || votes >= 80 || pop >= 65) {
          score += 155;
        }
      }

      if (isRecentStreaming) {
        if (stRank !== undefined) {
          score += Math.max(85, 210 - stRank * 2.4);
        } else {
          score += 120;
        }
        if (ageDays <= 45) {
          score += 95;
        } else if (ageDays <= 90) {
          score += 55;
        }
      }

      if (twRank !== undefined) {
        score += Math.max(35, 185 - twRank * 2.5);
      }

      score += Math.min(100, Math.log10(Math.max(10, votes)) * 26);
      score += Math.min(65, Math.sqrt(Math.max(1, pop)) * 3.5);
      if (rating >= 6.5) {
        score += (rating - 6.0) * 15;
      }

      if (!isAiringNow && ageDays > 365) {
        score -= 115;
      }

      scored.push({ movie: cand, score });
    }

    scored.sort((a, b) => b.score - a.score || (b.movie.popularity || 0) - (a.movie.popularity || 0));
    const items = scored.map((s) => s.movie);
    popularWeekPoolCache.set(cacheKey, items);
    return items;
  })().finally(() => {
    popularWeekInFlight.delete(cacheKey);
  });

  popularWeekInFlight.set(cacheKey, task);
  return task;
}
