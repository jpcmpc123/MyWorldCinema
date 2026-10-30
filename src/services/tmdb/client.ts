import { curatedBackdropCache, curatedPosterCache, tmdbHttpCache, tmdbInflight } from './cache';
import { CANONICAL_BACKDROP_BY_ID } from './posterFilter';
import type { TMDBMovie, TMDBRawMediaPayload } from './types';

// ATENÇÃO: nunca recoloque chaves reais como fallback aqui — use apenas
// variáveis de ambiente (.env local ou secrets de CI). Chaves hardcoded
// vazam no repositório público mesmo se as envs estiverem corretas.
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY as string | undefined;
const TMDB_ACCESS_TOKEN = import.meta.env.VITE_TMDB_ACCESS_TOKEN as string | undefined;

if (!TMDB_API_KEY || !TMDB_ACCESS_TOKEN) {
  console.error('[tmdb] VITE_TMDB_API_KEY / VITE_TMDB_ACCESS_TOKEN não definidas. Crie um .env local.');
}

export const BASE_URL = 'https://api.themoviedb.org/3';
export const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// ---------------------------------------------------------------------------
// Idioma global da API (pt-BR / en-US) — controlado pelo seletor de idioma.
// Todas as chamadas usam esse idioma por padrão; textos vazios (overview,
// tagline) fazem fallback para en-US no detalhe do filme/série.
// ---------------------------------------------------------------------------
let tmdbLanguage = 'en-US';
export function setTmdbLanguage(lang: string): void {
  tmdbLanguage = lang === 'pt-BR' ? 'pt-BR' : 'en-US';
}
export function getTmdbLanguage(): string {
  return tmdbLanguage;
}

// ---------------------------------------------------------------------------
// Referências de data e mapa de países — usados pelos filtros de elegibilidade
// das vitrines (Popular / Highest rated / Most watched / Most anticipated) e
// pelo filtro de nacionalidade (with_origin_country).
// ---------------------------------------------------------------------------
export const TMDB_TODAY = new Date().toISOString().split('T')[0];
/** Ano corrente: anos/décadas acima dele são "futuros" (sem votos ainda) */
export const CURRENT_YEAR = new Date().getFullYear();
export const TMDB_TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

export function daysOffsetIso(daysDelta: number): string {
  return new Date(Date.now() + daysDelta * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

export function daysSinceDate(dateStr: string): number {
  if (!dateStr) return 99999;
  const parsed = Date.parse(`${dateStr.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed)) return 99999;
  return (Date.now() - parsed) / (24 * 60 * 60 * 1000);
}

// Gêneros de TV banidos das vitrines e filtros: Talk (Jimmy Fallon, Seth
// Meyers…), News e Reality diários. Nunca devem aparecer nas abas de séries.
export const TV_EXCLUDED_GENRES = '10767,10763,10764';
export const TV_EXCLUDED_GENRE_IDS = new Set([10767, 10763, 10764]);

// Nome do país (ou código já em ISO) → ISO 3166-1 alpha-2.
// O filtro de nacionalidade NUNCA envia o nome por extenso à API.
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  'united states': 'US',
  'united kingdom': 'GB',
  brazil: 'BR',
  france: 'FR',
  japan: 'JP',
  'south korea': 'KR',
  korea: 'KR',
  germany: 'DE',
  italy: 'IT',
  spain: 'ES',
  india: 'IN',
  canada: 'CA',
  australia: 'AU',
  mexico: 'MX',
  argentina: 'AR',
  portugal: 'PT',
  china: 'CN',
  sweden: 'SE',
  denmark: 'DK',
  netherlands: 'NL',
  poland: 'PL',
};

/** Normaliza qualquer entrada (nome por extenso ou código) para ISO alpha-2 */
export function toOriginCountryIso(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return COUNTRY_NAME_TO_ISO[trimmed.toLowerCase()] ?? null;
}

/** Data de exibição/lançamento de um item de lista (filme ou série) */
export function itemDate(m: TMDBRawMediaPayload): string {
  return m.release_date || m.first_air_date || '';
}

/** Filme elegível a vitrine: lançado (<= hoje) e com votos mínimos */
export function isReleasedWithVotes(m: TMDBMovie, minVotes: number): boolean {
  const d = itemDate(m);
  return Boolean(d) && d <= TMDB_TODAY && m.vote_count >= minVotes;
}

/** Estritamente inédito/futuro (estreia > hoje e sem votos registrados) */
export function isFuture(m: TMDBMovie): boolean {
  const d = itemDate(m);
  return Boolean(d) && d > TMDB_TODAY && (m.vote_count || 0) === 0 && (m.vote_average || 0) === 0;
}

export function normalizeMediaItem(m: TMDBMovie & Partial<TMDBRawMediaPayload>): TMDBMovie {
  const curatedPoster = m.id ? curatedPosterCache.get(m.id) : undefined;
  const finalPoster = curatedPoster || m.poster_path || null;
  if (m.id && finalPoster && !curatedPoster) {
    curatedPosterCache.set(m.id, finalPoster);
  }

  return {
    ...m,
    poster_path: finalPoster,
    title: m.title || m.name || '',
    original_title: m.original_title || m.original_name || m.title || m.name || '',
    release_date: m.release_date || m.first_air_date || '',
  };
}

function isMediaListEndpoint(endpoint: string): boolean {
  return (
    endpoint.startsWith('/discover/') ||
    endpoint.startsWith('/trending/') ||
    endpoint === '/movie/popular' ||
    endpoint === '/movie/top_rated' ||
    endpoint === '/movie/now_playing' ||
    endpoint === '/tv/popular' ||
    endpoint === '/tv/top_rated' ||
    endpoint.startsWith('/search/movie') ||
    endpoint.startsWith('/search/tv') ||
    endpoint.startsWith('/search/multi') ||
    endpoint.endsWith('/recommendations') ||
    endpoint.endsWith('/similar')
  );
}

async function fetchWithRetry(
  urlString: string,
  headers: Record<string, string>,
  maxAttempts = 6,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(urlString, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return res;
      if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
        const retryAfterSec = Number(res.headers.get('Retry-After'));
        const delayMs =
          res.status === 429
            ? Number.isFinite(retryAfterSec) && retryAfterSec > 0
              ? retryAfterSec * 1000
              : 900 * attempt
            : 350 * attempt;
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw new Error(`TMDB error ${res.status}: ${res.statusText}`);
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to fetch from TMDB');
}

export async function fetchFromTMDB<T>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
  options?: { allowMissingPoster?: boolean },
): Promise<T> {
  if (!TMDB_API_KEY || !TMDB_ACCESS_TOKEN) {
    throw new Error('TMDB não configurado: defina VITE_TMDB_API_KEY e VITE_TMDB_ACCESS_TOKEN no .env');
  }
  const headers = {
    Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', TMDB_API_KEY);

  const effectiveLang = params.language !== undefined ? String(params.language) : tmdbLanguage;
  if (params.language === undefined) {
    url.searchParams.append('language', tmdbLanguage);
  }

  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.append(key, String(val));
    }
  });

  const cacheKey = options?.allowMissingPoster ? `${url.toString()}#allowNoPoster` : url.toString();
  const urlString = url.toString();

  const cached = tmdbHttpCache.get(cacheKey);
  if (cached !== null) {
    return cached as T;
  }

  const inflight = tmdbInflight.get(cacheKey);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const shouldSyncOfficialPosters =
    effectiveLang === 'pt-BR' && params.language === undefined && isMediaListEndpoint(endpoint);

  const promise = (async () => {
    const enPostersPromise = shouldSyncOfficialPosters
      ? (async () => {
          try {
            const enUrl = new URL(urlString);
            enUrl.searchParams.set('language', 'en-US');
            const enKey = `${enUrl.toString()}#enPosters`;
            const cachedEn = tmdbHttpCache.get(enKey) as Map<number, string> | null;
            if (cachedEn) return cachedEn;
            const enRes = await fetchWithRetry(enUrl.toString(), headers, 2);
            const enJson = await enRes.json();
            const map = new Map<number, string>();
            if (enJson && Array.isArray(enJson.results)) {
              for (const item of enJson.results) {
                if (
                  item &&
                  typeof item.id === 'number' &&
                  typeof item.poster_path === 'string' &&
                  item.poster_path
                ) {
                  map.set(item.id, item.poster_path);
                }
              }
            }
            tmdbHttpCache.set(enKey, map);
            return map;
          } catch {
            return null;
          }
        })()
      : Promise.resolve(null);

    const [res, enPosterMap] = await Promise.all([
      fetchWithRetry(urlString, headers, 6),
      enPostersPromise,
    ]);
    const data = await res.json();
    if (data && Array.isArray(data.results)) {
      data.results = data.results
        .map((r: Record<string, unknown>) => {
          const itemId = typeof r.id === 'number' ? r.id : 0;
          if (itemId) {
            const curatedPoster = curatedPosterCache.get(itemId);
            const officialEn = enPosterMap?.get(itemId);
            if (curatedPoster) {
              r.poster_path = curatedPoster;
            } else if (officialEn) {
              r.poster_path = officialEn;
              curatedPosterCache.set(itemId, officialEn);
            } else if (typeof r.poster_path === 'string' && r.poster_path) {
              curatedPosterCache.set(itemId, r.poster_path);
            }
          }
          if (!r.title && typeof r.name === 'string') {
            r.title = r.name;
          }
          if (!r.release_date && typeof r.first_air_date === 'string') {
            r.release_date = r.first_air_date;
          }
          return r;
        })
        .filter(
          (r: { poster_path?: string | null }) =>
            options?.allowMissingPoster || !('poster_path' in r) || Boolean(r.poster_path),
        );
    }
    tmdbHttpCache.set(cacheKey, data);
    return data as T;
  })();

  tmdbInflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    tmdbInflight.delete(cacheKey);
  }
}

export const STREAMING_SERVICES = [
  { id: 8, name: 'Netflix' },
  { id: 9, name: 'Amazon Prime Video' },
  { id: 337, name: 'Disney+' },
  { id: 350, name: 'Apple TV+' },
  { id: 1899, name: 'Max' },
];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'ja', name: 'Japanese' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'de', name: 'German' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
];

export const TV_GENRES = [
  { id: 10759, name: 'Action & Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 10762, name: 'Kids' },
  { id: 9648, name: 'Mystery' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10766, name: 'Soap' },
  { id: 10767, name: 'Talk' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
];

export const MOVIE_GENRES = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];
