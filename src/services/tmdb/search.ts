import { mediaDetailsCache, searchEnrichCache } from './cache';
import { fetchFromTMDB, getTmdbLanguage } from './client';
import type {
  TMDBEnrichmentPayload,
  TMDBMovie,
  TMDBRawMediaPayload,
  TMDBResponse,
  TMDBSearchPerson,
  TMDBSearchResult,
} from './types';

/** Quantos itens da 1ª página recebem diretores/títulos alternativos (evita congestionar a rede ao digitar). */
const SEARCH_ENRICH_LIMIT = 8;

/**
 * Diretores + títulos alternativos de UM título.
 * Em séries, "Directed by" usa os criadores (created_by) + diretores de episódios.
 * Qualquer falha degrada para arrays vazios — a lista nunca quebra por isso.
 */
export async function fetchSearchEnrichment(
  id: number,
  mediaType: 'movie' | 'tv',
): Promise<{ directors: string[]; alternativeTitles: string[] }> {
  const lang = getTmdbLanguage();
  const enrichKey = `${mediaType}:${id}:${lang}`;
  const cachedEnrich = searchEnrichCache.get(enrichKey);
  if (cachedEnrich) return cachedEnrich;

  const cachedFull = mediaDetailsCache.get(enrichKey);
  if (cachedFull) {
    const rawFull = cachedFull as TMDBRawMediaPayload & typeof cachedFull;
    const crewDirectors = (cachedFull.credits?.crew ?? [])
      .filter((c) => c.job === 'Director')
      .map((c) => c.name);
    const created = (rawFull.created_by ?? []).map((c) => c.name);
    const directors = Array.from(
      new Set(mediaType === 'tv' ? [...created, ...crewDirectors] : crewDirectors),
    ).slice(0, 4);
    const result = { directors, alternativeTitles: [] as string[] };
    searchEnrichCache.set(enrichKey, result);
    return result;
  }

  try {
    const details = await fetchFromTMDB<TMDBEnrichmentPayload>(`/${mediaType}/${id}`, {
      append_to_response: 'credits,alternative_titles',
    });
    const crewDirectors = (details.credits?.crew ?? [])
      .filter((c) => c.job === 'Director')
      .map((c) => c.name);
    const created = (details.created_by ?? []).map((c) => c.name);
    const directors = Array.from(
      new Set(mediaType === 'tv' ? [...created, ...crewDirectors] : crewDirectors),
    );
    const rawTitles =
      details.alternative_titles?.titles ?? details.alternative_titles?.results ?? [];
    const alternativeTitles = Array.from(
      new Set(rawTitles.map((t) => t.title).filter((t): t is string => Boolean(t && t.trim()))),
    );
    const result = { directors: directors.slice(0, 4), alternativeTitles };
    searchEnrichCache.set(enrichKey, result);
    return result;
  } catch {
    return { directors: [], alternativeTitles: [] };
  }
}

/** Normaliza filme OU série para o formato da lista de resultados. */
export function normalizeSearchItem(
  m: TMDBMovie & Partial<TMDBRawMediaPayload>,
  mediaType: 'movie' | 'tv',
): TMDBSearchResult {
  return {
    id: m.id,
    media_type: mediaType,
    title: m.title || m.name || '',
    original_title: m.original_title || m.original_name || '',
    release_date: m.release_date || m.first_air_date || '',
    poster_path: m.poster_path,
    overview: m.overview ?? '',
    vote_average: m.vote_average ?? 0,
    popularity: m.popularity ?? 0,
    directors: [],
    alternativeTitles: [],
  };
}

/** Enriquece (em paralelo) apenas os primeiros SEARCH_ENRICH_LIMIT itens. */
export async function enrichSearchItems(items: TMDBSearchResult[]): Promise<TMDBSearchResult[]> {
  return Promise.all(
    items.map(async (item, index) => {
      if (index >= SEARCH_ENRICH_LIMIT) return item;
      const extra = await fetchSearchEnrichment(item.id, item.media_type);
      return { ...item, ...extra };
    }),
  );
}

export async function searchTV(query: string, page = 1): Promise<TMDBResponse<TMDBMovie>> {
  return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/search/tv', {
    query,
    page,
    include_adult: 'false',
  });
}

export async function searchMovies(query: string, page = 1): Promise<TMDBResponse<TMDBMovie>> {
  return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/search/movie', {
    query,
    page,
    include_adult: 'false',
  });
}

export async function searchPeople(query: string, page = 1): Promise<TMDBResponse<TMDBSearchPerson>> {
  return fetchFromTMDB<TMDBResponse<TMDBSearchPerson>>('/search/person', {
    query,
    page,
    include_adult: 'false',
  });
}

export async function searchEnriched(
  query: string,
  mediaType: 'movie' | 'tv',
  page = 1,
): Promise<TMDBSearchResult[]> {
  const res = await fetchFromTMDB<TMDBResponse<TMDBMovie>>(
    mediaType === 'movie' ? '/search/movie' : '/search/tv',
    { query, page, include_adult: 'false' },
  );
  const normalized = res.results.map((m) => normalizeSearchItem(m, mediaType));
  return enrichSearchItems(normalized);
}

export async function searchMultiEnriched(query: string, page = 1): Promise<TMDBSearchResult[]> {
  const [moviesRes, tvRes] = await Promise.all([
    fetchFromTMDB<TMDBResponse<TMDBMovie>>('/search/movie', {
      query,
      page,
      include_adult: 'false',
    }).catch(() => null),
    fetchFromTMDB<TMDBResponse<TMDBMovie>>('/search/tv', {
      query,
      page,
      include_adult: 'false',
    }).catch(() => null),
  ]);
  const movies = (moviesRes?.results ?? []).map((m) => normalizeSearchItem(m, 'movie'));
  const series = (tvRes?.results ?? []).map((m) => normalizeSearchItem(m, 'tv'));
  return enrichSearchItems([...movies, ...series]);
}

/**
 * Busca exata por TMDB ID para o importador estilo Letterboxd.
 */
export async function getMovieForImportById(tmdbId: number): Promise<TMDBSearchResult | null> {
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return null;
  try {
    const details = await fetchFromTMDB<
      TMDBMovie & {
        credits?: { crew?: { id: number; name: string; job?: string }[] };
        alternative_titles?: { titles?: { title: string }[] };
      }
    >(`/movie/${tmdbId}`, {
      append_to_response: 'credits,alternative_titles',
    });
    if (!details || !details.id) return null;
    const directors = Array.from(
      new Set(
        (details.credits?.crew ?? [])
          .filter((c) => c.job === 'Director')
          .map((c) => c.name),
      ),
    ).slice(0, 4);
    const alternativeTitles = Array.from(
      new Set(
        (details.alternative_titles?.titles ?? [])
          .map((t) => t.title)
          .filter((t): t is string => Boolean(t && t.trim())),
      ),
    );
    return {
      ...normalizeSearchItem(details, 'movie'),
      directors,
      alternativeTitles,
    };
  } catch {
    return null;
  }
}

/**
 * Busca exata por IMDb ID (ex.: tt0086567) via endpoint /find do TMDB.
 */
export async function findByImdbId(
  imdbId: string,
): Promise<{ match: TMDBSearchResult | null; isTvMatch?: boolean }> {
  const clean = imdbId.trim();
  if (!/^tt\d+$/i.test(clean)) return { match: null };
  try {
    const res = await fetchFromTMDB<{
      movie_results?: TMDBMovie[];
      tv_results?: TMDBMovie[];
    }>(`/find/${encodeURIComponent(clean)}`, {
      external_source: 'imdb_id',
    });
    const movieHit = res.movie_results?.[0];
    if (movieHit && movieHit.id) {
      const base = normalizeSearchItem(movieHit, 'movie');
      const extra = await fetchSearchEnrichment(movieHit.id, 'movie');
      return { match: { ...base, ...extra }, isTvMatch: false };
    }
    const tvHit = res.tv_results?.[0];
    if (tvHit && tvHit.id) {
      const base = normalizeSearchItem(tvHit, 'tv');
      const extra = await fetchSearchEnrichment(tvHit.id, 'tv');
      return { match: { ...base, ...extra }, isTvMatch: true };
    }
    return { match: null };
  } catch {
    return { match: null };
  }
}

/**
 * Busca candidatos de filmes para o importador ("best-guess match") por título + ano opcional,
 * enriquecendo os primeiros candidatos com diretores e títulos alternativos.
 */
export async function searchMoviesForImport(
  title: string,
  year?: number,
  needDirectorEnrichment = false,
): Promise<TMDBSearchResult[]> {
  const q = title.trim();
  if (!q) return [];
  try {
    const hasValidYear = Boolean(year && year > 1880);
    const firstRes = await fetchFromTMDB<TMDBResponse<TMDBMovie>>(
      '/search/movie',
      {
        query: q,
        primary_release_year: hasValidYear ? year : undefined,
        include_adult: 'false',
        page: 1,
      },
      { allowMissingPoster: true },
    ).catch(() => null);

    const seen = new Set<number>();
    const combined: TMDBMovie[] = [];
    for (const item of firstRes?.results ?? []) {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id);
        combined.push(item);
      }
    }

    const normQ = q.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hasExactTitleHit = combined.some((m) => {
      const t1 = (m.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const t2 = (m.original_title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return t1 === normQ || t2 === normQ;
    });

    if (hasValidYear && (!hasExactTitleHit || combined.length === 0)) {
      const fallbackRes = await fetchFromTMDB<TMDBResponse<TMDBMovie>>(
        '/search/movie',
        {
          query: q,
          include_adult: 'false',
          page: 1,
        },
        { allowMissingPoster: true },
      ).catch(() => null);
      for (const item of fallbackRes?.results ?? []) {
        if (item && item.id && !seen.has(item.id)) {
          seen.add(item.id);
          combined.push(item);
        }
      }
    }

    const normalized = combined.slice(0, 6).map((m) => normalizeSearchItem(m, 'movie'));
    if (!needDirectorEnrichment) {
      return normalized;
    }

    return Promise.all(
      normalized.map(async (item, idx) => {
        if (idx >= 4) return item;
        const extra = await fetchSearchEnrichment(item.id, 'movie');
        return { ...item, ...extra };
      }),
    );
  } catch {
    return [];
  }
}
