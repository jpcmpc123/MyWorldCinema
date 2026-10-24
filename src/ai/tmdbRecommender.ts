import { DECADE_YEAR_MAP, ORIGIN_MAP, TMDB_GENRE_MAP } from './constants';
import { classifyLaya7D, extractReferenceMovieTitle } from './classifier';
import { stripAccents } from './rules';
import type { AiMovie, LayaDecisions, RecommendOptions, RecommendResponse } from './types';
import { preloadLayaWeights } from './weightsLoader';

interface CacheEntry {
  referenceMovie: string | null;
  decisions: LayaDecisions;
  pool: AiMovie[];
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const MAX_CACHE_ENTRIES = 60;

const recommendationCache = new Map<string, CacheEntry>();
const referenceSearchCache = new Map<string, { id: number; title: string } | null>();
const inflightRequests = new Map<string, Promise<CacheEntry>>();

function resolveDefaultTmdbAuth(explicitKey?: string): string {
  if (explicitKey) return explicitKey;

  // Browser / Vite client env
  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv?.VITE_TMDB_ACCESS_TOKEN) return metaEnv.VITE_TMDB_ACCESS_TOKEN;
    if (metaEnv?.VITE_TMDB_API_KEY) return metaEnv.VITE_TMDB_API_KEY;
  } catch {
    // ignore in non-Vite context
  }

  // Node / Server env fallback
  const nodeEnv = (globalThis as any)?.process?.env;
  if (nodeEnv) {
    return (
      nodeEnv.TMDB_API_KEY ||
      nodeEnv.VITE_TMDB_API_KEY ||
      nodeEnv.TMDB_READ_TOKEN ||
      nodeEnv.VITE_TMDB_ACCESS_TOKEN ||
      '756b66f23e97ca70dba67363ba4e3b21'
    );
  }

  return '756b66f23e97ca70dba67363ba4e3b21';
}

export function mapTmdbMovieItem(m: any): AiMovie & { poster_url?: string | null } {
  const poster_path = m.poster_path || null;
  return {
    id: m.id,
    title: m.title || m.name || 'Sem título',
    original_title: m.original_title || m.title || '',
    poster_path,
    backdrop_path: m.backdrop_path || null,
    overview: m.overview || 'Sem sinopse disponível.',
    vote_average: typeof m.vote_average === 'number' ? m.vote_average : 0,
    vote_count: typeof m.vote_count === 'number' ? m.vote_count : 0,
    popularity: typeof m.popularity === 'number' ? m.popularity : 0,
    genre_ids: Array.isArray(m.genre_ids) ? m.genre_ids : [],
    release_date: m.release_date || m.first_air_date || '',
    poster_url: poster_path ? `https://image.tmdb.org/t/p/w500${poster_path}` : null,
  };
}

async function fetchTmdbJson(url: string, authKey: string): Promise<any> {
  const headers: Record<string, string> = {
    accept: 'application/json',
  };
  let finalUrl = url;
  if (authKey.length > 50) {
    headers.Authorization = `Bearer ${authKey}`;
  } else {
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + `api_key=${authKey}`;
  }
  const res = await fetch(finalUrl, { headers });
  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
  return res.json();
}

/**
 * Monta os 4 tiers de busca em cascata do TMDB preservando sempre Origem + Gênero
 * antes de relaxar época ou classificação.
 */
export function buildDiscoverTiers(decisions: LayaDecisions): Array<Record<string, string>> {
  const genreId = TMDB_GENRE_MAP[decisions.genre];
  const decadeRange = DECADE_YEAR_MAP[decisions.decade] || DECADE_YEAR_MAP.modern;
  const originParams = ORIGIN_MAP[decisions.origin] || {};
  const isNational = decisions.origin === 'national';
  const isAsian = ['korean', 'japanese', 'asian'].includes(decisions.origin);

  const excludeAnimation: Record<string, string> =
    !['animation', 'family'].includes(decisions.genre) &&
    decisions.origin !== 'japanese' &&
    decisions.content_rating !== 'L'
      ? { without_genres: '16' }
      : {};

  return [
    // Tier 1: Todos os filtros (origem + gênero + década + classificação)
    {
      ...originParams,
      ...excludeAnimation,
      ...(genreId ? { with_genres: String(genreId) } : {}),
      'primary_release_date.gte': decadeRange[0],
      'primary_release_date.lte': decadeRange[1],
      ...(decisions.content_rating && !isAsian
        ? {
            certification_country: 'BR',
            'certification.lte': decisions.content_rating,
          }
        : {}),
      'vote_count.gte': isNational ? '8' : isAsian ? '40' : '50',
      sort_by: isAsian ? 'vote_count.desc' : 'popularity.desc',
    },
    // Tier 2: Mantém origem + gênero + década, relaxa certificação
    {
      ...originParams,
      ...excludeAnimation,
      ...(genreId ? { with_genres: String(genreId) } : {}),
      'primary_release_date.gte': decadeRange[0],
      'primary_release_date.lte': decadeRange[1],
      'vote_count.gte': isNational ? '3' : isAsian ? '25' : '30',
      sort_by: isAsian ? 'vote_count.desc' : 'popularity.desc',
    },
    // Tier 3: Mantém origem + gênero em qualquer época até hoje
    {
      ...originParams,
      ...excludeAnimation,
      ...(genreId ? { with_genres: String(genreId) } : {}),
      'primary_release_date.lte': '2026-12-31',
      'vote_count.gte': isNational ? '2' : '15',
      sort_by: 'popularity.desc',
    },
    // Tier 4: Fallback global apenas pelo gênero + década
    {
      ...excludeAnimation,
      ...(genreId ? { with_genres: String(genreId) } : {}),
      'primary_release_date.gte': decadeRange[0],
      'primary_release_date.lte': decadeRange[1],
      'vote_count.gte': '40',
      sort_by: 'popularity.desc',
    },
  ];
}

function sortCandidatesByQuality(candidates: any[]): any[] {
  return candidates.sort((a: any, b: any) => {
    const aLatin = /[A-Za-zÀ-ÿ]/.test(a.title || '') ? 1 : 0;
    const bLatin = /[A-Za-zÀ-ÿ]/.test(b.title || '') ? 1 : 0;
    if (aLatin !== bLatin) return bLatin - aLatin;
    const aOv = a.overview && a.overview.length > 10 ? 1 : 0;
    const bOv = b.overview && b.overview.length > 10 ? 1 : 0;
    return bOv - aOv;
  });
}

async function resolvePoolForQuery(
  rawQuery: string,
  options: RecommendOptions,
): Promise<CacheEntry> {
  const lang = options.language === 'en-US' ? 'en-US' : 'pt-BR';
  const authKey = resolveDefaultTmdbAuth(options.apiKeyOrToken);
  const weightsModel =
    options.weightsModel !== undefined ? options.weightsModel : await preloadLayaWeights();

  const decisions = classifyLaya7D(rawQuery, weightsModel);
  const refTitle = extractReferenceMovieTitle(rawQuery);
  let referenceMovieName: string | null = null;
  const pool: AiMovie[] = [];
  const existingIds = new Set<number>();

  // 1. Se o usuário citou um filme de referência, busca recomendações similares no TMDB
  if (refTitle) {
    const refCacheKey = `${lang}:${stripAccents(refTitle)}`;
    try {
      let topHit = referenceSearchCache.get(refCacheKey);
      if (topHit === undefined) {
        const searchData = await fetchTmdbJson(
          `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(refTitle)}&language=${lang}`,
          authKey,
        );
        const found = (searchData?.results || []).find(
          (m: any) => m.id && (m.vote_count ?? 0) >= 80,
        );
        topHit = found?.id ? { id: found.id, title: found.title || refTitle } : null;
        referenceSearchCache.set(refCacheKey, topHit);
      }

      if (topHit?.id) {
        referenceMovieName = topHit.title;
        const simData = await fetchTmdbJson(
          `https://api.themoviedb.org/3/movie/${topHit.id}/recommendations?language=${lang}&page=1`,
          authKey,
        );
        const simResults = (simData?.results || []).filter((m: any) => m.poster_path);
        for (const item of simResults.slice(0, 12)) {
          if (!existingIds.has(item.id)) {
            pool.push(mapTmdbMovieItem(item));
            existingIds.add(item.id);
          }
        }
      }
    } catch {
      // Continua para a cascata discover
    }
  }

  // 2. Cascata progressiva de 4 tiers no TMDB Discover (coleta até 12 candidatos para permitir variações rápidas)
  if (pool.length < 8) {
    const tiers = buildDiscoverTiers(decisions);

    for (const tierParams of tiers) {
      if (pool.length >= 12) break;
      const params = new URLSearchParams({
        language: lang,
        include_adult: 'false',
        page: '1',
        ...tierParams,
      });

      try {
        const discData = await fetchTmdbJson(
          `https://api.themoviedb.org/3/discover/movie?${params.toString()}`,
          authKey,
        );
        const candidates = sortCandidatesByQuality(
          (discData?.results || []).filter((m: any) => m.poster_path),
        );
        for (const item of candidates) {
          if (!existingIds.has(item.id)) {
            pool.push(mapTmdbMovieItem(item));
            existingIds.add(item.id);
            if (pool.length >= 12) break;
          }
        }
      } catch {
        // Tenta próximo tier
      }
    }
  }

  return {
    referenceMovie: referenceMovieName,
    decisions,
    pool,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
}

function selectTopFour(pool: AiMovie[], excludeIds?: Iterable<number>): AiMovie[] {
  if (!excludeIds) return pool.slice(0, 4);
  const excluded = new Set(excludeIds);
  if (excluded.size === 0) return pool.slice(0, 4);

  const fresh = pool.filter((m) => !excluded.has(m.id));
  if (fresh.length >= 4) return fresh.slice(0, 4);

  // Completa com itens do pool caso restem menos de 4 inéditos
  const combined = [...fresh];
  for (const m of pool) {
    if (combined.length >= 4) break;
    if (!combined.some((c) => c.id === m.id)) {
      combined.push(m);
    }
  }
  return combined.slice(0, 4);
}

/**
 * Executa todo o pipeline de recomendação Laya 7D + TMDB com cache LRU em memória
 * e deduplicação de requisições concorrentes.
 * Roda nativamente no navegador (Web / APK Android) e no servidor Node.
 */
export async function recommendMovies(
  rawQuery: string,
  options: RecommendOptions = {},
): Promise<RecommendResponse> {
  const q = rawQuery.trim();
  const lang = options.language === 'en-US' ? 'en-US' : 'pt-BR';
  const cacheKey = `${lang}:${stripAccents(q)}`;

  if (!options.bypassCache) {
    const cached = recommendationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() && cached.pool.length > 0) {
      return {
        query: q,
        reference_movie: cached.referenceMovie,
        decisions: cached.decisions,
        movies: selectTopFour(cached.pool, options.excludeIds),
        cached: true,
      };
    }
  }

  let pending = inflightRequests.get(cacheKey);
  if (!pending) {
    pending = resolvePoolForQuery(q, options).finally(() => {
      inflightRequests.delete(cacheKey);
    });
    inflightRequests.set(cacheKey, pending);
  }

  const entry = await pending;

  if (entry.pool.length > 0) {
    if (recommendationCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = recommendationCache.keys().next().value;
      if (oldestKey) recommendationCache.delete(oldestKey);
    }
    recommendationCache.set(cacheKey, entry);
  }

  return {
    query: q,
    reference_movie: entry.referenceMovie,
    decisions: entry.decisions,
    movies: selectTopFour(entry.pool, options.excludeIds),
    cached: false,
  };
}

export function clearRecommendationCache(): void {
  recommendationCache.clear();
}
