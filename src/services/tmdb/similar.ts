import { similarProfileCache } from './cache';
import {
  fetchFromTMDB,
  getTmdbLanguage,
  itemDate,
  normalizeMediaItem,
  TMDB_TODAY,
  TV_EXCLUDED_GENRE_IDS,
} from './client';
import type {
  SimilarSourceProfile,
  TMDBMovie,
  TMDBMovieDetails,
  TMDBRawMediaPayload,
  TMDBResponse,
} from './types';

// ---------------------------------------------------------------------------
// Motor de Afinidade Temática e de Público (Filmes & Séries Semelhantes)
// Combina sequências/franquia (belongs_to_collection), recomendações reais de
// público (/recommendations), descoberta por palavras-chave + gêneros centrais
// (/discover) e filtragem estrita de estilo (live-action vs. animação/doc).
// ---------------------------------------------------------------------------

export function rankSimilarCandidates(
  profile: SimilarSourceProfile,
  buckets: {
    collection?: TMDBMovie[];
    recommendations?: TMDBMovie[];
    keywordDiscover?: TMDBMovie[];
    similar?: TMDBMovie[];
  },
): TMDBMovie[] {
  const collectionList = (buckets.collection || []).map(normalizeMediaItem);
  const recList = (buckets.recommendations || []).map(normalizeMediaItem);
  const kwList = (buckets.keywordDiscover || []).map(normalizeMediaItem);
  const simList = (buckets.similar || []).map(normalizeMediaItem);

  const collectionIds = new Set(collectionList.map((m) => m.id));
  const recRankMap = new Map<number, number>();
  recList.forEach((m, idx) => {
    if (!recRankMap.has(m.id)) recRankMap.set(m.id, idx);
  });

  const kwRankMap = new Map<number, number>();
  kwList.forEach((m, idx) => {
    if (!kwRankMap.has(m.id)) kwRankMap.set(m.id, idx);
  });

  const simRankMap = new Map<number, number>();
  simList.forEach((m, idx) => {
    if (!simRankMap.has(m.id)) simRankMap.set(m.id, idx);
  });

  const candidatesMap = new Map<number, TMDBMovie>();
  for (const list of [collectionList, recList, kwList, simList]) {
    for (const item of list) {
      if (item && item.id && item.id !== profile.id && !candidatesMap.has(item.id)) {
        candidatesMap.set(item.id, item);
      }
    }
  }

  const sourceGenreSet = new Set(profile.genreIds);
  const primaryGenre = profile.genreIds[0];
  const secondaryGenre = profile.genreIds[1];
  const thirdGenre = profile.genreIds[2];

  const isSourceAnim = sourceGenreSet.has(16);
  const isSourceDoc = sourceGenreSet.has(99);
  const isSourceFamily = sourceGenreSet.has(10751) || sourceGenreSet.has(10762);
  const isSourceComedy = sourceGenreSet.has(35);
  const isSourceHorror = sourceGenreSet.has(27);
  const isSourceTvExcluded = profile.genreIds.some((g) => TV_EXCLUDED_GENRE_IDS.has(g));

  const scored: { movie: TMDBMovie; score: number }[] = [];

  for (const cand of candidatesMap.values()) {
    if (!cand.poster_path) continue;

    const inCollection = collectionIds.has(cand.id);
    const recRank = recRankMap.get(cand.id);
    const kwRank = kwRankMap.get(cand.id);
    const simRank = simRankMap.get(cand.id);

    const inRecs = recRank !== undefined;
    const inKw = kwRank !== undefined;
    const inSim = simRank !== undefined;

    const d = itemDate(cand);
    if (!inCollection && (!d || d > TMDB_TODAY)) continue;

    const candGenres = cand.genre_ids || [];
    const candGenreSet = new Set(candGenres);

    // 1. Trava estrita de formato: Animação vs Live-Action e Documentário vs Ficção
    const isCandAnim = candGenreSet.has(16);
    if (!inCollection && isSourceAnim !== isCandAnim) continue;

    const isCandDoc = candGenreSet.has(99);
    if (!inCollection && isSourceDoc !== isCandDoc) continue;

    if (profile.type === 'tv' && !isSourceTvExcluded) {
      if (candGenres.some((g) => TV_EXCLUDED_GENRE_IDS.has(g))) continue;
    }

    // 2. Afinidade mínima de gêneros
    const sharedCount = candGenres.filter((g) => sourceGenreSet.has(g)).length;
    if (!inCollection && profile.genreIds.length > 0 && candGenres.length > 0) {
      if (sharedCount === 0) continue;

      const hasPrimaryGenre = primaryGenre !== undefined && candGenreSet.has(primaryGenre);
      const hasSecondaryGenre = secondaryGenre !== undefined && candGenreSet.has(secondaryGenre);

      if (profile.genreIds.length >= 2) {
        if (!inRecs && !inKw) {
          if (sharedCount < 2 || !hasPrimaryGenre) continue;
          if ((cand.vote_count ?? 0) < (profile.type === 'tv' ? 80 : 250)) continue;
        } else if (!hasPrimaryGenre && !hasSecondaryGenre && sharedCount < 2) {
          if ((recRank ?? 99) > 5) continue;
        }
      }
    }

    // 3. Filtro de relevância e qualidade mínima
    const minVotes = inCollection ? 1 : inRecs && (recRank ?? 99) < 10 ? 20 : profile.type === 'tv' ? 25 : 50;
    if ((cand.vote_count ?? 0) < minVotes) continue;
    if (!inCollection && (cand.vote_average ?? 0) > 0 && (cand.vote_average ?? 0) < 5.2) continue;

    // 4. Cálculo de pontuação de afinidade temática e de público
    let score = 0;

    if (inCollection) {
      score += 1000;
    }

    if (inRecs && recRank !== undefined) {
      score += Math.max(45, 165 - recRank * 3.2);
    }

    if (inKw && kwRank !== undefined) {
      score += Math.max(25, 85 - kwRank * 1.8);
    }

    if (inSim && simRank !== undefined) {
      score += Math.max(5, 30 - simRank * 1.0);
    }

    if (inRecs && inKw) score += 70;
    if (inRecs && inSim) score += 55;
    if (inKw && inSim) score += 40;

    if (primaryGenre !== undefined && candGenres[0] === primaryGenre) {
      score += 38;
    } else if (primaryGenre !== undefined && candGenreSet.has(primaryGenre)) {
      score += 22;
    }

    if (secondaryGenre !== undefined && candGenreSet.has(secondaryGenre)) {
      score += 24;
    }

    if (thirdGenre !== undefined && candGenreSet.has(thirdGenre)) {
      score += 15;
    }

    if (profile.genreIds.length > 0 && candGenres.length > 0) {
      const unionSize = new Set([...profile.genreIds, ...candGenres]).size;
      const jaccard = sharedCount / Math.max(1, unionSize);
      score += jaccard * 50;
    }

    if (!isSourceFamily && (candGenreSet.has(10751) || candGenreSet.has(10762))) {
      score -= 65;
    }
    if (!isSourceComedy && candGenres[0] === 35) {
      score -= 35;
    }
    if (!isSourceHorror && candGenreSet.has(27)) {
      score -= 40;
    }

    const candYear = d ? parseInt(d.slice(0, 4), 10) : 0;
    if (!inCollection && profile.releaseYear > 0 && candYear > 0) {
      const yearDiff = Math.abs(profile.releaseYear - candYear);
      if (yearDiff <= 15) {
        score += (15 - yearDiff) * 1.3;
      } else if (yearDiff > 32) {
        score -= Math.min(35, (yearDiff - 32) * 1.1);
      }
    }

    const candLang = cand.original_language || '';
    if (profile.originalLanguage && candLang === profile.originalLanguage) {
      score += profile.originalLanguage !== 'en' ? 24 : 8;
    }

    score += (cand.vote_average || 0) * 2.4;
    score += Math.min(14, Math.log10(Math.max(10, cand.vote_count || 10)) * 3.2);

    scored.push({ movie: cand, score });
  }

  scored.sort((a, b) => b.score - a.score || (b.movie.vote_count || 0) - (a.movie.vote_count || 0));
  return scored.map((s) => s.movie);
}

export async function curateSimilarForDetails(
  details: TMDBMovieDetails & Partial<TMDBRawMediaPayload>,
  type: 'movie' | 'tv',
  fastMode = false,
): Promise<TMDBMovie[]> {
  const lang = getTmdbLanguage();
  const cacheKey = `${type}:${details.id}:${lang}`;
  const genreIds = (details.genres || []).map((g) => g.id);
  const rawKeywords = details.keywords?.keywords || details.keywords?.results || [];
  const keywordIds = rawKeywords.slice(0, 6).map((k) => k.id);
  const rawDate = details.release_date || details.first_air_date || '';
  const releaseYear = rawDate ? parseInt(rawDate.slice(0, 4), 10) || 0 : 0;
  const collectionId =
    type === 'movie' && details.belongs_to_collection?.id
      ? details.belongs_to_collection.id
      : undefined;

  const baseRecs = details.recommendations?.results || [];
  const baseSim = details.similar?.results || [];
  const needsFallbackDiscover = baseRecs.length + baseSim.length < 6 && genreIds.length > 0;

  if (fastMode) {
    let collectionParts: TMDBMovie[] = [];
    if (collectionId) {
      const applyCollectionData = (colData: { name?: string; parts?: TMDBMovie[] }) => {
        const rawParts = (colData.parts || []).map(normalizeMediaItem);
        const parts = rawParts
          .filter((m) => Boolean(m.poster_path) && (!itemDate(m) || itemDate(m) <= TMDB_TODAY))
          .sort((a, b) => {
            const da = itemDate(a) || '9999-12-31';
            const db = itemDate(b) || '9999-12-31';
            return da.localeCompare(db);
          });
        if (details.belongs_to_collection && colData.name) {
          details.belongs_to_collection.name = colData.name;
        }
        details.collection_parts = parts;
        return parts;
      };

      const colPromise = fetchFromTMDB<{ name?: string; parts?: TMDBMovie[] }>(
        `/collection/${collectionId}`,
      )
        .then((colData) => applyCollectionData(colData))
        .catch(() => [] as TMDBMovie[]);

      collectionParts = await Promise.race([
        colPromise,
        new Promise<TMDBMovie[]>((resolve) => setTimeout(() => resolve([]), 4000)),
      ]);
    }

    let fallbackDiscoverItems: TMDBMovie[] = [];
    if (needsFallbackDiscover) {
      try {
        const disc = await Promise.race([
          fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/discover/${type}`, {
            with_genres: genreIds.slice(0, 2).join(','),
            sort_by: 'vote_count.desc',
            'vote_count.gte': type === 'tv' ? 40 : 120,
            page: 1,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);
        if (disc?.results) fallbackDiscoverItems = disc.results;
      } catch {
        /* ignore */
      }
    }

    const profile: SimilarSourceProfile = {
      id: details.id,
      type,
      genreIds,
      keywordIds,
      originalLanguage: details.original_language || '',
      releaseYear,
      collectionId,
      collectionParts,
      rankedPool: [],
    };

    const collectionIdSet = new Set(collectionParts.map((m) => m.id));
    const rankedAll = rankSimilarCandidates(profile, {
      recommendations: baseRecs,
      keywordDiscover: fallbackDiscoverItems,
      similar: baseSim,
    });
    const ranked = rankedAll.filter((m) => !collectionIdSet.has(m.id)).slice(0, 80);
    profile.rankedPool = ranked;
    similarProfileCache.set(cacheKey, profile);
    return ranked;
  }

  const extraCalls = await Promise.allSettled([
    collectionId
      ? fetchFromTMDB<{ name?: string; parts?: TMDBMovie[] }>(`/collection/${collectionId}`)
      : Promise.resolve({ parts: [] as TMDBMovie[] }),
    fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/${type}/${details.id}/recommendations`, { page: 2 }),
    keywordIds.length > 0 && genreIds.length > 0
      ? fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/discover/${type}`, {
          with_genres: genreIds.slice(0, 2).join(','),
          with_keywords: keywordIds.slice(0, 4).join('|'),
          sort_by: 'vote_count.desc',
          'vote_count.gte': type === 'tv' ? 40 : 120,
          page: 1,
        })
      : Promise.resolve({ results: [] as TMDBMovie[], page: 1, total_pages: 1, total_results: 0 }),
    fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/${type}/${details.id}/similar`, { page: 2 }),
    genreIds.length > 0
      ? fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/discover/${type}`, {
          with_genres: genreIds.slice(0, 2).join(','),
          ...(keywordIds.length > 0 ? { with_keywords: keywordIds.slice(0, 5).join('|') } : {}),
          sort_by: 'popularity.desc',
          'vote_count.gte': type === 'tv' ? 35 : 90,
          page: 2,
        })
      : Promise.resolve({ results: [] as TMDBMovie[], page: 1, total_pages: 1, total_results: 0 }),
  ]);

  const collectionData =
    extraCalls[0].status === 'fulfilled'
      ? (extraCalls[0].value as { name?: string; parts?: TMDBMovie[] })
      : { parts: [] as TMDBMovie[] };
  const rawCollectionParts = (collectionData.parts || []).map(normalizeMediaItem);
  const collectionParts = rawCollectionParts
    .filter((m) => Boolean(m.poster_path) && (!itemDate(m) || itemDate(m) <= TMDB_TODAY))
    .sort((a, b) => {
      const da = itemDate(a) || '9999-12-31';
      const db = itemDate(b) || '9999-12-31';
      return da.localeCompare(db);
    });

  if (collectionId && details.belongs_to_collection && collectionData.name) {
    details.belongs_to_collection.name = collectionData.name;
  }
  details.collection_parts = collectionParts;

  const recPage2 = extraCalls[1].status === 'fulfilled' ? extraCalls[1].value.results || [] : [];
  const kwDiscover1 = extraCalls[2].status === 'fulfilled' ? extraCalls[2].value.results || [] : [];
  const simPage2 = extraCalls[3].status === 'fulfilled' ? extraCalls[3].value.results || [] : [];
  const kwDiscover2 = extraCalls[4].status === 'fulfilled' ? extraCalls[4].value.results || [] : [];

  const profile: SimilarSourceProfile = {
    id: details.id,
    type,
    genreIds,
    keywordIds,
    originalLanguage: details.original_language || '',
    releaseYear,
    collectionId,
    collectionParts,
    rankedPool: [],
  };

  const collectionIdSet = new Set(collectionParts.map((m) => m.id));
  const rankedAll = rankSimilarCandidates(profile, {
    recommendations: [...baseRecs, ...recPage2],
    keywordDiscover: [...kwDiscover1, ...kwDiscover2],
    similar: [...baseSim, ...simPage2],
  });
  const ranked = rankedAll.filter((m) => !collectionIdSet.has(m.id)).slice(0, 80);

  profile.rankedPool = ranked;
  similarProfileCache.set(cacheKey, profile);
  return ranked;
}
