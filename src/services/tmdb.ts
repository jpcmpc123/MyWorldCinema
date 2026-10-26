// ATENÇÃO: nunca recoloque chaves reais como fallback aqui — use apenas
// variáveis de ambiente (.env local ou secrets de CI). Chaves hardcoded
// vazam no repositório público mesmo se as envs estiverem corretas.
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY as string | undefined;
const TMDB_ACCESS_TOKEN = import.meta.env.VITE_TMDB_ACCESS_TOKEN as string | undefined;

if (!TMDB_API_KEY || !TMDB_ACCESS_TOKEN) {
  // Falha rápida e visível em dev; em produção o .env commitado fornece os valores.
  console.error('[tmdb] VITE_TMDB_API_KEY / VITE_TMDB_ACCESS_TOKEN não definidas. Crie um .env local.');
}
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// ---------------------------------------------------------------------------
// Idioma global da API (pt-BR / en-US) — controlado pelo seletor de idioma.
// Todas as chamadas usam esse idioma por padrão; textos vazios (overview,
// tagline) fazem fallback para en-US no detalhe do filme/série.
// ---------------------------------------------------------------------------
let tmdbLanguage = 'en-US';
export function setTmdbLanguage(lang: string) {
  tmdbLanguage = lang === 'pt-BR' ? 'pt-BR' : 'en-US';
}
export function getTmdbLanguage() {
  return tmdbLanguage;
}

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  popularity: number;
}


export interface TMDBSeries {
  id: number;
  name: string;
  original_name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  popularity: number;
}
export interface TMDBMovieDetails extends TMDBMovie {
  tagline: string;
  runtime: number;
  status: string;
  budget: number;
  revenue: number;
  genres: { id: number; name: string }[];
  production_companies: { id: number; name: string; logo_path: string | null; origin_country: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  spoken_languages: { english_name: string; iso_639_1: string; name: string }[];
  credits?: {
    cast: {
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
      order: number;
    }[];
    crew: {
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }[];
  };
  similar?: {
    results: TMDBMovie[];
  };
  recommendations?: {
    results: TMDBMovie[];
  };
  'watch/providers'?: {
    results: {
      [countryCode: string]: {
        link: string;
        flatrate?: { provider_id: number; provider_name: string; logo_path: string }[];
        rent?: { provider_id: number; provider_name: string; logo_path: string }[];
        buy?: { provider_id: number; provider_name: string; logo_path: string }[];
      };
    };
  };
  videos?: {
    results: {
      id: string;
      key: string;
      name: string;
      site: string;
      type: string;
    }[];
  };
  // Datas de lançamento por país (filmes) — aba "Releases"
  release_dates?: {
    results: {
      iso_3166_1: string;
      release_dates: {
        certification: string;
        iso_639_1: string;
        note: string;
        release_date: string;
        type: number; // 1=Premiere 2=TheatricalLtd 3=Theatrical 4=Digital 5=Physical 6=TV
      }[];
    }[];
  };
  // Classificação indicativa por país (séries)
  content_ratings?: {
    results: { iso_3166_1: string; rating: string }[];
  };
  external_ids?: {
    imdb_id?: string | null;
  };
  // Filmes usam `keywords`; séries usam `results`
  keywords?: {
    keywords?: { id: number; name: string }[];
    results?: { id: number; name: string }[];
  };
  alternative_titles?: {
    titles?: { iso_3166_1: string; title: string; type: string }[];
    results?: { iso_3166_1: string; title: string; type: string }[];
  };
  original_language?: string;
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
  } | null;
  collection_parts?: TMDBMovie[];
}

export interface TMDBCollectionDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: TMDBMovie[];
}

export interface TMDBImage {
  file_path: string;
  width: number;
  height: number;
  aspect_ratio: number;
  vote_average: number;
  vote_count: number;
}

export interface TMDBMovieImages {
  id: number;
  posters: TMDBImage[];
  backdrops: TMDBImage[];
}

export interface TMDBPerson {
  id: number;
  name: string;
  biography: string;
  profile_path: string | null;
  known_for_department: string;
  birthday: string | null;
  place_of_birth?: string | null;
  also_known_as?: string[];
}

export interface TMDBPersonMovieCredit {
  id: number;
  title: string;
  original_title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  popularity: number;
  character?: string;
  job?: string;
  department?: string;
  genre_ids?: number[];
  /**
   * 'tv' quando o crédito veio de `tv_credits` (série). Ausente/`movie` = filme.
   * Usado para rotear o clique para /tv/{id} na página de pessoa.
   */
  media_type?: 'movie' | 'tv';
}

export interface TMDBPersonMovieCredits {
  id: number;
  cast: TMDBPersonMovieCredit[];
  crew: TMDBPersonMovieCredit[];
}

/**
 * Pessoa + filmografia numa única chamada
 * (`/person/{id}?append_to_response=movie_credits,tv_credits`) — usada pela
 * página de perfil (abas Bio / Ator / cargos de equipe, incluindo Criador).
 */
export interface TMDBPersonDetails extends TMDBPerson {
  movie_credits?: TMDBPersonMovieCredits;
  /** Créditos em SÉRIES — trazem os criadores (job 'Creator') e o elenco de TV */
  tv_credits?: TMDBPersonMovieCredits;
  external_ids?: {
    imdb_id?: string | null;
    wikidata_id?: string | null;
  };
  wikipedia_url?: string;
}

export interface TMDBResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

// ---------------------------------------------------------------------------
// BUSCA (página /search) — o /search/movie e /search/tv NÃO devolvem diretores
// nem títulos alternativos. Estes tipos carregam o resultado já enriquecido.
// ---------------------------------------------------------------------------
export interface TMDBSearchResult {
  id: number;
  /** 'movie' | 'tv' — nunca misturamos os dois numa mesma lista. */
  media_type: 'movie' | 'tv';
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  popularity: number;
  directors: string[];
  alternativeTitles: string[];
}

export interface TMDBSearchPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  popularity?: number;
  known_for?: { id: number; title?: string; name?: string; media_type?: string }[];
}

/** Resposta mínima de /movie|tv/{id}?append_to_response=credits,alternative_titles */
interface TMDBEnrichmentPayload {
  created_by?: { id: number; name: string }[];
  credits?: { crew?: { id: number; name: string; job?: string }[] };
  alternative_titles?: { titles?: { title: string }[] };
}

/** Quantos itens da 1ª página recebem diretores/títulos alternativos (evita congestionar a rede ao digitar). */
const SEARCH_ENRICH_LIMIT = 8;

/**
 * Diretores + títulos alternativos de UM título.
 * Em séries, "Directed by" usa os criadores (created_by) + diretores de episódios.
 * Qualquer falha degrada para arrays vazios — a lista nunca quebra por isso.
 */
async function fetchSearchEnrichment(
  id: number,
  mediaType: 'movie' | 'tv'
): Promise<{ directors: string[]; alternativeTitles: string[] }> {
  const enrichKey = `${mediaType}:${id}:${tmdbLanguage}`;
  const cachedEnrich = searchEnrichCache.get(enrichKey);
  if (cachedEnrich) return cachedEnrich;

  const cachedFull = mediaDetailsCache.get(enrichKey);
  if (cachedFull && cachedFull.expires > Date.now()) {
    const d = cachedFull.data;
    const crewDirectors = (d.credits?.crew ?? [])
      .filter((c) => c.job === 'Director')
      .map((c) => c.name);
    const created = ((d as unknown as { created_by?: { name: string }[] }).created_by ?? []).map((c) => c.name);
    const directors = Array.from(
      new Set(mediaType === 'tv' ? [...created, ...crewDirectors] : crewDirectors)
    ).slice(0, 4);
    const result = { directors, alternativeTitles: [] as string[] };
    setBoundedMap(searchEnrichCache, enrichKey, result, 400);
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
      new Set(mediaType === 'tv' ? [...created, ...crewDirectors] : crewDirectors)
    );
    const alternativeTitles = Array.from(
      new Set(
        (details.alternative_titles?.titles ?? [])
          .map((t) => t.title)
          .filter((t): t is string => Boolean(t && t.trim()))
      )
    );
    const result = { directors: directors.slice(0, 4), alternativeTitles };
    setBoundedMap(searchEnrichCache, enrichKey, result, 400);
    return result;
  } catch {
    return { directors: [], alternativeTitles: [] };
  }
}

/** Normaliza filme OU série para o formato da lista de resultados. */
function normalizeSearchItem(m: TMDBMovie, mediaType: 'movie' | 'tv'): TMDBSearchResult {
  const raw = m as unknown as Record<string, unknown>;
  return {
    id: m.id,
    media_type: mediaType,
    title: m.title || (raw.name as string) || '',
    original_title: m.original_title || (raw.original_name as string) || '',
    release_date: m.release_date || (raw.first_air_date as string) || '',
    poster_path: m.poster_path,
    overview: m.overview ?? '',
    vote_average: m.vote_average ?? 0,
    popularity: m.popularity ?? 0,
    directors: [],
    alternativeTitles: [],
  };
}

/** Enriquece (em paralelo) apenas os primeiros SEARCH_ENRICH_LIMIT itens. */
async function enrichSearchItems(items: TMDBSearchResult[]): Promise<TMDBSearchResult[]> {
  return Promise.all(
    items.map(async (item, index) => {
      if (index >= SEARCH_ENRICH_LIMIT) return item;
      const extra = await fetchSearchEnrichment(item.id, item.media_type);
      return { ...item, ...extra };
    })
  );
}

// Cache em memória com TTL: evita refazer chamadas idênticas do TMDb ao
// navegar entre páginas (ex.: Home → Filme → voltar). Também deduplica
// chamadas simultâneas da mesma URL (React StrictMode / mounts paralelos).
const TMDB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const TMDB_DETAILS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos para detalhes na sessão
const tmdbCache = new Map<string, { data: unknown; expires: number }>();
const tmdbInflight = new Map<string, Promise<unknown>>();
const mediaDetailsCache = new Map<string, { data: TMDBMovieDetails; expires: number }>();
const personDetailsCache = new Map<string, { data: TMDBPersonDetails; expires: number }>();
const collectionDetailsCache = new Map<
  string,
  { data: TMDBCollectionDetails; expires: number }
>();
const searchEnrichCache = new Map<string, { directors: string[]; alternativeTitles: string[] }>();

function setBoundedMap<K, V>(map: Map<K, V>, key: K, value: V, maxEntries: number): void {
  if (map.size >= maxEntries && !map.has(key)) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) map.delete(oldestKey);
  }
  map.set(key, value);
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
      // Retry on rate limit (429) or transient server errors (5xx)
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

async function fetchFromTMDB<T>(
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
  // Add API Key as fallback alongside Bearer token
  url.searchParams.append('api_key', TMDB_API_KEY);

  // Idioma global por padrão (pt-BR / en-US), salvo override explícito
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

  // Cache hit?
  const cached = tmdbCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T;
  }

  // Requisição idêntica já em andamento? Reutiliza a mesma Promise.
  const inflight = tmdbInflight.get(cacheKey);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const promise = (async () => {
    const res = await fetchWithRetry(urlString, headers, 6);
    const data = await res.json();
    // Esconde itens sem pôster nas vitrines normais, mas permite manter na importação
    if (data && Array.isArray(data.results)) {
      data.results = data.results
        .filter(
          (r: { poster_path?: string | null }) =>
            options?.allowMissingPoster || !('poster_path' in r) || Boolean(r.poster_path),
        )
        .map((r: Record<string, unknown>) => {
          if (!r.title && typeof r.name === 'string') {
            r.title = r.name;
          }
          if (!r.release_date && typeof r.first_air_date === 'string') {
            r.release_date = r.first_air_date;
          }
          return r;
        });
    }
    tmdbCache.set(cacheKey, { data, expires: Date.now() + TMDB_CACHE_TTL_MS });
    // Limpeza simples: evita crescimento ilimitado do cache em sessões longas.
    if (tmdbCache.size > 1500) {
      const now = Date.now();
      for (const [key, entry] of tmdbCache) {
        if (entry.expires <= now) tmdbCache.delete(key);
      }
    }
    return data as T;
  })();

  tmdbInflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    tmdbInflight.delete(cacheKey);
  }
}

// ---------------------------------------------------------------------------
// Referências de data e mapa de países — usados pelos filtros de elegibilidade
// das vitrines (Popular / Highest rated / Most watched / Most anticipated) e
// pelo filtro de nacionalidade (with_origin_country).
// ---------------------------------------------------------------------------
export const TMDB_TODAY = new Date().toISOString().split('T')[0];
/** Ano corrente: anos/décadas acima dele são "futuros" (sem votos ainda) */
const CURRENT_YEAR = new Date().getFullYear();
export const TMDB_TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

function daysOffsetIso(daysDelta: number): string {
  return new Date(Date.now() + daysDelta * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function daysSinceDate(dateStr: string): number {
  if (!dateStr) return 99999;
  const parsed = Date.parse(`${dateStr.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed)) return 99999;
  return (Date.now() - parsed) / (24 * 60 * 60 * 1000);
}

// Gêneros de TV banidos das vitrines e filtros: Talk (Jimmy Fallon, Seth
// Meyers…), News e Reality diários. Nunca devem aparecer nas abas de séries.
const TV_EXCLUDED_GENRES = '10767,10763,10764';
const TV_EXCLUDED_GENRE_IDS = new Set([10767, 10763, 10764]);

// Nome do país (ou código já em ISO) → ISO 3166-1 alpha-2.
// O filtro de nacionalidade NUNCA envia o nome por extenso à API.
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  'united states': 'US', 'united kingdom': 'GB', brazil: 'BR', france: 'FR',
  japan: 'JP', 'south korea': 'KR', korea: 'KR', germany: 'DE', italy: 'IT',
  spain: 'ES', india: 'IN', canada: 'CA', australia: 'AU', mexico: 'MX',
  argentina: 'AR', portugal: 'PT', china: 'CN', sweden: 'SE', denmark: 'DK',
  netherlands: 'NL', poland: 'PL',
};

/** Normaliza qualquer entrada (nome por extenso ou código) para ISO alpha-2 */
export function toOriginCountryIso(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return COUNTRY_NAME_TO_ISO[trimmed.toLowerCase()] ?? null;
}

/** Data de exibição/lançamento de um item de lista (filme ou série) */
function itemDate(m: TMDBMovie): string {
  const a = m as unknown as Record<string, unknown>;
  return m.release_date || (a.first_air_date as string) || '';
}

/** Filme elegível a vitrine: lançado (<= hoje) e com votos mínimos */
const isReleasedWithVotes = (m: TMDBMovie, minVotes: number) => {
  const d = itemDate(m);
  return Boolean(d) && d <= TMDB_TODAY && m.vote_count >= minVotes;
};

/** Estritamente inédito/futuro (estreia > hoje e sem votos registrados) */
const isFuture = (m: TMDBMovie) => {
  const d = itemDate(m);
  return Boolean(d) && d > TMDB_TODAY && (m.vote_count || 0) === 0 && (m.vote_average || 0) === 0;
};

const movieHasPastReleaseCache = new Map<number, boolean>();

async function hasMovieReleasedInAnyCountry(movieId: number): Promise<boolean> {
  const cached = movieHasPastReleaseCache.get(movieId);
  if (cached !== undefined) return cached;

  for (const lang of ['pt-BR', 'en-US']) {
    const det = mediaDetailsCache.get(`movie:${movieId}:${lang}`);
    if (det && det.expires > Date.now() && det.data.release_dates?.results) {
      const hasPast = det.data.release_dates.results.some((g) =>
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

async function filterStrictlyUnreleasedMovies(movies: TMDBMovie[]): Promise<TMDBMovie[]> {
  const baseCandidates = movies.filter(isFuture);
  if (baseCandidates.length === 0) return [];
  const checks = await Promise.all(
    baseCandidates.map(async (m) => ({
      movie: m,
      alreadyReleasedAbroad: await hasMovieReleasedInAnyCountry(m.id),
    })),
  );
  return checks.filter((c) => !c.alreadyReleasedAbroad).map((c) => c.movie);
}

// ---------------------------------------------------------------------------
// Motor Inteligente "Popular da Semana" (Filmes & Séries)
// Prioriza:
//  1. Grandes lançamentos em cartaz nos cinemas (ou episódios atuais em séries)
//  2. Filmes/séries que saíram recentemente no streaming / digital
//  3. Títulos em forte ascensão no Trending Diário e Semanal
// ---------------------------------------------------------------------------
const popularWeekPoolCache = new Map<string, { items: TMDBMovie[]; expires: number }>();
const popularWeekInFlight = new Map<string, Promise<TMDBMovie[]>>();
let filmsHubInFlight: Promise<{
  popular: TMDBMovie[];
  highestRated: TMDBMovie[];
  mostWatched: TMDBMovie[];
  mostAnticipated: TMDBMovie[];
}> | null = null;
let seriesHubInFlight: Promise<{
  popular: TMDBMovie[];
  highestRated: TMDBMovie[];
  mostWatched: TMDBMovie[];
  mostAnticipated: TMDBMovie[];
}> | null = null;

async function buildCuratedPopularMoviesPool(batchIndex = 0): Promise<TMDBMovie[]> {
  const cacheKey = `movie:pop_week_pool_v6:${batchIndex}:${tmdbLanguage}`;
  const cached = popularWeekPoolCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.items;
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

    // IMPORTANTE sobre o /discover/movie do TMDB:
    // Para que `with_release_type` funcione de verdade (separando tipo 3 = Cinema
    // de tipo 4 = Digital/Streaming), é OBRIGATÓRIO usar `region` + `release_date.gte/lte`.
    // Apenas 5 chamadas leves em paralelo (~220ms) entregam todo o pool de cinema + digital + trending.
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

    // Ao mesclar candidatos de múltiplas regiões (ex.: BR estreia quinta-feira, US sexta-feira),
    // preserva sempre a data já lançada (<= TMDB_TODAY) mais antiga para não descartar
    // estreias da semana no Brasil cujo lançamento nos EUA é 1 dia depois.
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
      // Bloqueia inéditos futuros (vão para Most Anticipated)
      if (!d || d > TMDB_TODAY) continue;

      const ageDays = daysSinceDate(d);
      const votes = cand.vote_count || 0;
      const rating = cand.vote_average || 0;
      const pop = cand.popularity || 0;

      // Piso de votos para garantir que apenas lançamentos reais e relevantes entrem
      const minVotesRequired = ageDays <= 25 ? 20 : 30;
      if (votes < minVotesRequired) continue;
      if (votes < 70 && rating > 0 && rating < 4.8) continue;

      // Evita que relançamentos comemorativos (ex.: Avengers Endgame 2019 Encore) sejam
      // tratados como estreias inéditas de cinema
      const isOldReRelease = ageDays > 180;

      const thRank = !isOldReRelease ? theatricalRankMap.get(cand.id) : undefined;
      const digRank = digitalRankMap.get(cand.id);
      const twRank = trendWeekRankMap.get(cand.id);
      const inTrending = twRank !== undefined;

      // Classificação estrita em 3 escalões mutuamente exclusivos:
      // 1. EXCLUSIVO NOS CINEMAS AGORA: Teve estreia Type 3 (Cinema) nos últimos 65 dias
      //    e AINDA NÃO saiu no Digital/Streaming (Type 4/5/6).
      const isExclusiveCinemaNow =
        thRank !== undefined && digRank === undefined && ageDays >= -1 && ageDays <= 65;

      // 2. TRANSIÇÃO CINEMA -> STREAMING RECENTE: Estreou nos cinemas recentemente e
      //    acabou de chegar ao Digital/Streaming (ou blockbuster recente com alto volume de votos no digital).
      const isCinemaToStreamingRecent =
        !isExclusiveCinemaNow &&
        ((thRank !== undefined && digRank !== undefined && ageDays <= 135) ||
          (thRank === undefined && digRank !== undefined && votes >= 500 && ageDays <= 135));

      // 3. ORIGINAL DE STREAMING: Foi direto para Digital/Flatrate sem janela ampla de cinema.
      const isDirectStreamingOriginal =
        !isExclusiveCinemaNow && !isCinemaToStreamingRecent && digRank !== undefined;

      let score = 0;

      if (isExclusiveCinemaNow && thRank !== undefined) {
        // Escalão 1 (Topo absoluto): Filmes lançados recentemente no cinema e ainda inéditos em streaming
        score += 750 - Math.min(180, thRank * 3.5);
        if (inTrending) score += 160;
        if (ageDays <= 21) score += 110;
        else if (ageDays <= 45) score += 70;
      } else if (isCinemaToStreamingRecent) {
        // Escalão 2: Grandes filmes de cinema que saíram recentemente no streaming/digital
        score += 460 - Math.min(140, (digRank ?? 20) * 2.5);
        if (inTrending) score += 110;
      } else if (isDirectStreamingOriginal) {
        // Escalão 3: Filmes originais lançados direto no streaming
        score += 220 - Math.min(90, (digRank ?? 20) * 2.0);
      }

      // Bônus de momento semanal
      if (twRank !== undefined) {
        score += Math.max(20, 140 - twRank * 2.5);
      }

      // Relevância de público e nota
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
    setBoundedMap(popularWeekPoolCache, cacheKey, { items, expires: Date.now() + TMDB_CACHE_TTL_MS }, 30);
    return items;
  })().finally(() => {
    popularWeekInFlight.delete(cacheKey);
  });

  popularWeekInFlight.set(cacheKey, task);
  return task;
}

async function buildCuratedPopularSeriesPool(batchIndex = 0): Promise<TMDBMovie[]> {
  const cacheKey = `tv:pop_week_pool_v6:${batchIndex}:${tmdbLanguage}`;
  const cached = popularWeekPoolCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.items;
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

      // 1. Séries exibindo episódios novos na semana
      if (isAiringNow && oaRank !== undefined) {
        score += Math.max(130, 275 - oaRank * 2.5);
        if (inTrending || votes >= 80 || pop >= 65) {
          score += 155;
        }
      }

      // 2. Séries recém-lançadas no streaming / novas estreias
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

      // 3. Momento no Trending Semanal
      if (twRank !== undefined) {
        score += Math.max(35, 185 - twRank * 2.5);
      }

      // 4. Escala de público e nota
      score += Math.min(100, Math.log10(Math.max(10, votes)) * 26);
      score += Math.min(65, Math.sqrt(Math.max(1, pop)) * 3.5);
      if (rating >= 6.5) {
        score += (rating - 6.0) * 15;
      }

      // 5. Penaliza séries antigas já encerradas que não estão com novos episódios no ar
      if (!isAiringNow && ageDays > 365) {
        score -= 115;
      }

      scored.push({ movie: cand, score });
    }

    scored.sort((a, b) => b.score - a.score || (b.movie.popularity || 0) - (a.movie.popularity || 0));
    const items = scored.map((s) => s.movie);
    setBoundedMap(popularWeekPoolCache, cacheKey, { items, expires: Date.now() + TMDB_CACHE_TTL_MS }, 30);
    return items;
  })().finally(() => {
    popularWeekInFlight.delete(cacheKey);
  });

  popularWeekInFlight.set(cacheKey, task);
  return task;
}

// ---------------------------------------------------------------------------
// Motor de Afinidade Temática e de Público (Filmes & Séries Semelhantes)
// Combina sequências/franquia (belongs_to_collection), recomendações reais de
// público (/recommendations), descoberta por palavras-chave + gêneros centrais
// (/discover) e filtragem estrita de estilo (live-action vs. animação/doc).
// ---------------------------------------------------------------------------

interface SimilarSourceProfile {
  id: number;
  type: 'movie' | 'tv';
  genreIds: number[];
  keywordIds: number[];
  originalLanguage: string;
  releaseYear: number;
  collectionId?: number;
  collectionParts: TMDBMovie[];
  rankedPool: TMDBMovie[];
}

const similarProfileCache = new Map<string, SimilarSourceProfile>();

function normalizeMediaItem(m: TMDBMovie): TMDBMovie {
  const a = m as unknown as Record<string, unknown>;
  return {
    ...m,
    title: (m.title || (a.name as string) || '') as string,
    original_title: (m.original_title || (a.original_name as string) || m.title || (a.name as string) || '') as string,
    release_date: (m.release_date || (a.first_air_date as string) || '') as string,
  };
}

function rankSimilarCandidates(
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
        // Se veio apenas do endpoint /similar bruto, exige alta afinidade de gênero e votos
        if (!inRecs && !inKw) {
          if (sharedCount < 2 || !hasPrimaryGenre) continue;
          if ((cand.vote_count ?? 0) < (profile.type === 'tv' ? 80 : 250)) continue;
        } else if (!hasPrimaryGenre && !hasSecondaryGenre && sharedCount < 2) {
          // Mesmo em recommendations, descarta desvios temáticos sem os gêneros principais
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

    // Bônus de consenso entre fontes independentes
    if (inRecs && inKw) score += 70;
    if (inRecs && inSim) score += 55;
    if (inKw && inSim) score += 40;

    // Precisão de gêneros
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

    // Penalidades de incompatibilidade de tom
    if (!isSourceFamily && (candGenreSet.has(10751) || candGenreSet.has(10762))) {
      score -= 65;
    }
    if (!isSourceComedy && candGenres[0] === 35) {
      score -= 35;
    }
    if (!isSourceHorror && candGenreSet.has(27)) {
      score -= 40;
    }

    // Proximidade de época / década (evita que filmes de outra era sem relação dominem)
    const candYear = d ? parseInt(d.slice(0, 4), 10) : 0;
    if (!inCollection && profile.releaseYear > 0 && candYear > 0) {
      const yearDiff = Math.abs(profile.releaseYear - candYear);
      if (yearDiff <= 15) {
        score += (15 - yearDiff) * 1.3;
      } else if (yearDiff > 32) {
        score -= Math.min(35, (yearDiff - 32) * 1.1);
      }
    }

    // Afinidade de idioma/cultura original (ex.: anime/cinema japonês, suspense coreano, nacional)
    const candLang = (cand as unknown as { original_language?: string }).original_language || '';
    if (profile.originalLanguage && candLang === profile.originalLanguage) {
      score += profile.originalLanguage !== 'en' ? 24 : 8;
    }

    // Aprovação do público
    score += (cand.vote_average || 0) * 2.4;
    score += Math.min(14, Math.log10(Math.max(10, cand.vote_count || 10)) * 3.2);

    scored.push({ movie: cand, score });
  }

  scored.sort((a, b) => b.score - a.score || (b.movie.vote_count || 0) - (a.movie.vote_count || 0));
  return scored.map((s) => s.movie);
}

async function curateSimilarForDetails(
  details: TMDBMovieDetails,
  type: 'movie' | 'tv',
  fastMode = false,
): Promise<TMDBMovie[]> {
  const cacheKey = `${type}:${details.id}:${tmdbLanguage}`;
  const genreIds = (details.genres || []).map((g) => g.id);
  const rawKeywords = details.keywords?.keywords || details.keywords?.results || [];
  const keywordIds = rawKeywords.slice(0, 6).map((k) => k.id);
  const rawDate = details.release_date || ((details as unknown as Record<string, unknown>).first_air_date as string) || '';
  const releaseYear = rawDate ? parseInt(rawDate.slice(0, 4), 10) || 0 : 0;
  const collectionObj = (details as unknown as { belongs_to_collection?: { id: number } | null }).belongs_to_collection;
  const collectionId = type === 'movie' && collectionObj?.id ? collectionObj.id : undefined;

  const baseRecs = details.recommendations?.results || [];
  const baseSim = details.similar?.results || [];
  const needsFallbackDiscover = baseRecs.length + baseSim.length < 6 && genreIds.length > 0;

  if (fastMode) {
    // No modo rápido (abertura imediata da página de detalhes), não bloqueamos a renderização
    // em várias requisições extras. Se houver coleção, damos até 320ms para ela responder junto;
    // se demorar mais, finaliza em segundo plano sem travar a abertura do filme.
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
    setBoundedMap(similarProfileCache, cacheKey, profile, 80);
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

  const recPage2 =
    extraCalls[1].status === 'fulfilled' ? extraCalls[1].value.results || [] : [];
  const kwDiscover1 =
    extraCalls[2].status === 'fulfilled' ? extraCalls[2].value.results || [] : [];
  const simPage2 =
    extraCalls[3].status === 'fulfilled' ? extraCalls[3].value.results || [] : [];
  const kwDiscover2 =
    extraCalls[4].status === 'fulfilled' ? extraCalls[4].value.results || [] : [];

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
  setBoundedMap(similarProfileCache, cacheKey, profile, 80);
  return ranked;
}

export const tmdb = {
  clearRuntimeCaches(): void {
    popularWeekPoolCache.clear();
    popularWeekInFlight.clear();
    filmsHubInFlight = null;
    seriesHubInFlight = null;
    mediaDetailsCache.clear();
    personDetailsCache.clear();
    collectionDetailsCache.clear();
    searchEnrichCache.clear();
    similarProfileCache.clear();
  },

  getCachedDetails(id: number, type: 'movie' | 'tv'): TMDBMovieDetails | null {
    const key = `${type}:${id}:${tmdbLanguage}`;
    const entry = mediaDetailsCache.get(key);
    if (entry && entry.expires > Date.now()) {
      return entry.data;
    }
    return null;
  },

  getCachedPersonDetails(id: number): TMDBPersonDetails | null {
    const key = `person:${id}:${tmdbLanguage}`;
    const entry = personDetailsCache.get(key);
    if (entry && entry.expires > Date.now()) {
      return entry.data;
    }
    return null;
  },

  getCachedCollectionDetails(id: number): TMDBCollectionDetails | null {
    const key = `collection:${id}:${tmdbLanguage}`;
    const entry = collectionDetailsCache.get(key);
    if (entry && entry.expires > Date.now()) {
      return entry.data;
    }
    return null;
  },

  getImageUrl(path: string | null, size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string {
    if (!path) return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
    if (path.startsWith('http')) return path;
    return `${IMAGE_BASE_URL}/${size}${path}`;
  },

  getBackdropUrl(path: string | null, size: 'w780' | 'w1280' | 'original' = 'original'): string {
    if (!path) return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1280&auto=format&fit=crop&q=80';
    if (path.startsWith('http')) return path;
    return `${IMAGE_BASE_URL}/${size}${path}`;
  },

  getProfileUrl(path: string | null, size: 'w185' | 'h632' | 'original' = 'w185'): string {
    if (!path) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=185&auto=format&fit=crop&q=60';
    return `${IMAGE_BASE_URL}/${size}${path}`;
  },

  async getPopular(page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/movie/popular', { page });
  },

  async getTopRated(page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/movie/top_rated', { page });
  },

  async getNowPlaying(page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/movie/now_playing', { page });
  },

  async getTrending(timeWindow: 'day' | 'week' = 'week', page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/trending/movie/${timeWindow}`, { page });
  },

  async getTrendingBatch(
    timeWindow: 'day' | 'week' = 'week',
    page = 1,
    pagesToFetch = 3,
  ): Promise<{ results: TMDBMovie[]; total_results: number; total_pages: number }> {
    const startPage = (page - 1) * pagesToFetch + 1;
    const pageNumbers = Array.from({ length: pagesToFetch }, (_, i) => startPage + i);
    const responses = await Promise.all(
      pageNumbers.map((p) =>
        this.getTrending(timeWindow, p).catch(() => ({
          results: [],
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
      total_pages: Math.max(1, Math.ceil((firstRes.total_pages || 1) / pagesToFetch)),
    };
  },

  async getMovieDetails(id: number): Promise<TMDBMovieDetails> {
    const cacheKey = `movie:${id}:${tmdbLanguage}`;
    const cached = mediaDetailsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    let movie: TMDBMovieDetails;
    try {
      movie = await fetchFromTMDB<TMDBMovieDetails>(`/movie/${id}`, {
        append_to_response:
          'credits,similar,recommendations,watch/providers,videos,release_dates,external_ids,alternative_titles',
      });
    } catch {
      movie = await fetchFromTMDB<TMDBMovieDetails>(`/movie/${id}`, {
        append_to_response: 'credits,videos,release_dates,similar',
      });
    }

    // Fallback para garantir sempre sinopse, elenco, diretor e backdrop completos
    const needsEnFallback =
      !movie.overview ||
      !movie.backdrop_path ||
      (!movie.credits?.cast?.length && !movie.credits?.crew?.length);
    if (needsEnFallback) {
      try {
        const en = await fetchFromTMDB<TMDBMovieDetails>(`/movie/${id}`, {
          language: 'en-US',
          append_to_response: 'credits,videos,release_dates',
        });
        if (!movie.overview && en.overview) movie.overview = en.overview;
        if (!movie.tagline && en.tagline) movie.tagline = en.tagline;
        if (!movie.runtime && en.runtime) movie.runtime = en.runtime;
        if (!movie.backdrop_path && en.backdrop_path) movie.backdrop_path = en.backdrop_path;
        if (!movie.poster_path && en.poster_path) movie.poster_path = en.poster_path;
        if (!movie.credits?.cast?.length && en.credits?.cast?.length) {
          movie.credits = {
            cast: en.credits.cast,
            crew: movie.credits?.crew?.length ? movie.credits.crew : (en.credits.crew || []),
          };
        } else if (!movie.credits?.crew?.length && en.credits?.crew?.length) {
          movie.credits = {
            cast: movie.credits?.cast || [],
            crew: en.credits.crew,
          };
        }
      } catch {
        /* mantém dados atuais */
      }
    }

    if (!movie.credits) {
      movie.credits = { cast: [], crew: [] };
    }

    if (!movie.backdrop_path) {
      movie.backdrop_path = movie.poster_path || null;
    }

    const similarRanked = await curateSimilarForDetails(movie, 'movie', true);
    movie.similar = { results: similarRanked };
    setBoundedMap(mediaDetailsCache, cacheKey, { data: movie, expires: Date.now() + TMDB_DETAILS_CACHE_TTL_MS }, 200);
    return movie;
  },

  async getMovieImages(id: number): Promise<TMDBMovieImages> {
    return fetchFromTMDB<TMDBMovieImages>(`/movie/${id}/images`, {
      include_image_language: 'en,null',
    });
  },

  async getCollectionDetails(collectionId: number): Promise<TMDBCollectionDetails> {
    const cacheKey = `collection:${collectionId}:${tmdbLanguage}`;
    const cached = collectionDetailsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    const col = await fetchFromTMDB<TMDBCollectionDetails>(`/collection/${collectionId}`);
    const parts = (col.parts || [])
      .map(normalizeMediaItem)
      .filter((m) => Boolean(m.poster_path) && (!itemDate(m) || itemDate(m) <= TMDB_TODAY))
      .sort((a, b) => {
        const da = itemDate(a) || '9999-12-31';
        const db = itemDate(b) || '9999-12-31';
        return da.localeCompare(db);
      });
    const result: TMDBCollectionDetails = {
      ...col,
      parts,
    };
    setBoundedMap(collectionDetailsCache, cacheKey, { data: result, expires: Date.now() + TMDB_DETAILS_CACHE_TTL_MS }, 80);
    return result;
  },

  async discoverByKeywordsOrGenres(
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
  },

  async getSimilarMedia(
    type: 'movie' | 'tv',
    id: number,
    page = 1,
  ): Promise<TMDBResponse<TMDBMovie>> {
    const cacheKey = `${type}:${id}:${tmdbLanguage}`;
    let profile = similarProfileCache.get(cacheKey);

    if (!profile) {
      const details = type === 'tv' ? await this.getTVDetails(id) : await this.getMovieDetails(id);
      profile = similarProfileCache.get(cacheKey);
      if (!profile) {
        return {
          page: 1,
          results: details.similar?.results || [],
          total_pages: 1,
          total_results: (details.similar?.results || []).length,
        };
      }
    }

    if (page === 1) {
      return {
        page: 1,
        results: profile.rankedPool,
        total_pages: 5,
        total_results: Math.max(profile.rankedPool.length, 80),
      };
    }

    // Páginas seguintes na tela "Filmes/Séries Semelhantes": busca próxima leva
    // de recommendations + discover temático (gêneros + keywords) + similar,
    // aplicando o mesmo filtro estrito de estilo e afinidade.
    const recPage = page + 1;
    const [recRes, kwRes, simRes] = await Promise.allSettled([
      fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/${type}/${id}/recommendations`, { page: recPage }),
      profile.genreIds.length > 0
        ? fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/discover/${type}`, {
            with_genres: profile.genreIds.slice(0, 2).join(','),
            ...(profile.keywordIds.length > 0
              ? { with_keywords: profile.keywordIds.slice(0, 4).join('|') }
              : {}),
            sort_by: 'vote_count.desc',
            'vote_count.gte': type === 'tv' ? 40 : 120,
            page,
          })
        : Promise.resolve({ results: [] as TMDBMovie[], page, total_pages: 1, total_results: 0 }),
      fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/${type}/${id}/similar`, { page }),
    ]);

    const rankedPage = rankSimilarCandidates(profile, {
      recommendations: recRes.status === 'fulfilled' ? recRes.value.results || [] : [],
      keywordDiscover: kwRes.status === 'fulfilled' ? kwRes.value.results || [] : [],
      similar: simRes.status === 'fulfilled' ? simRes.value.results || [] : [],
    });

    return {
      page,
      results: rankedPage,
      total_pages: 5,
      total_results: 100,
    };
  },

  async searchTV(query: string, page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/search/tv', {
      query,
      page,
      include_adult: 'false',
    });
  },

  async searchMovies(query: string, page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/search/movie', {
      query,
      page,
      include_adult: 'false',
    });
  },

  // -------------------------------------------------------------------------
  // Página de RESULTADOS DE BUSCA (/search) — dados completos estilo Letterboxd
  // -------------------------------------------------------------------------

  /** Pessoas (aba "Cast, Crew or Studios"). */
  async searchPeople(query: string, page = 1): Promise<TMDBResponse<TMDBSearchPerson>> {
    return fetchFromTMDB<TMDBResponse<TMDBSearchPerson>>('/search/person', {
      query,
      page,
      include_adult: 'false',
    });
  },

  /** Um único tipo (aba Films ou Series), enriquecido com diretores/títulos alternativos. */
  async searchEnriched(
    query: string,
    mediaType: 'movie' | 'tv',
    page = 1
  ): Promise<TMDBSearchResult[]> {
    const res = await fetchFromTMDB<TMDBResponse<TMDBMovie>>(
      mediaType === 'movie' ? '/search/movie' : '/search/tv',
      { query, page, include_adult: 'false' }
    );
    const normalized = res.results.map((m) => normalizeSearchItem(m, mediaType));
    return enrichSearchItems(normalized);
  },

  /** Aba "All": filmes (ordem de relevância) seguidos das séries — nunca misturados. */
  async searchMultiEnriched(query: string, page = 1): Promise<TMDBSearchResult[]> {
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
  },

  async getPerson(id: number): Promise<TMDBPerson> {
    return fetchFromTMDB<TMDBPerson>(`/person/${id}`);
  },

  async getPersonMovieCredits(id: number): Promise<TMDBPersonMovieCredits> {
    return fetchFromTMDB<TMDBPersonMovieCredits>(`/person/${id}/movie_credits`);
  },

  /**
   * Perfil completo da pessoa em UMA requisição (perfil + filmografia).
   * Se a biografia em pt-BR vier vazia (comum em nomes menos conhecidos),
   * refaz a chamada em en-US — a aba Bio nunca fica sem texto.
   */
  async getPersonDetails(id: number): Promise<TMDBPersonDetails> {
    const cacheKey = `person:${id}:${tmdbLanguage}`;
    const cached = personDetailsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    const person = await fetchFromTMDB<TMDBPersonDetails>(`/person/${id}`, {
      append_to_response: 'movie_credits,tv_credits,external_ids',
    });
    if (tmdbLanguage !== 'en-US' && !person.biography?.trim()) {
      try {
        const en = await fetchFromTMDB<TMDBPersonDetails>(`/person/${id}`, {
          language: 'en-US',
          append_to_response: 'movie_credits,tv_credits,external_ids',
        });
        if (!person.biography?.trim() && en.biography?.trim()) person.biography = en.biography;
        if (!person.movie_credits && en.movie_credits) person.movie_credits = en.movie_credits;
        if (!person.tv_credits && en.tv_credits) person.tv_credits = en.tv_credits;
        if (!person.external_ids && en.external_ids) person.external_ids = en.external_ids;
      } catch {
        /* fallback para Wikipedia logo abaixo */
      }
    }

    const defaultWikiLang = tmdbLanguage === 'pt-BR' ? 'pt' : 'en';
    person.wikipedia_url = `https://${defaultWikiLang}.wikipedia.org/wiki/${encodeURIComponent(
      (person.name || '').trim().replace(/\s+/g, '_'),
    )}`;

    // Se mesmo após o fallback em inglês no TMDB a biografia continuar vazia
    // (ex.: atores sem texto cadastrado no TMDB), busca o resumo oficial na Wikipedia (PT -> EN).
    if (!person.biography?.trim() && person.name) {
      const wikiLangs = tmdbLanguage === 'pt-BR' ? ['pt', 'en'] : ['en', 'pt'];
      const slug = encodeURIComponent(person.name.trim().replace(/\s+/g, '_'));
      for (const wLang of wikiLangs) {
        try {
          const res = await fetch(`https://${wLang}.wikipedia.org/api/rest_v1/page/summary/${slug}`);
          if (!res.ok) continue;
          const data = (await res.json()) as {
            type?: string;
            extract?: string;
            content_urls?: { desktop?: { page?: string } };
          };
          if (data && data.type !== 'disambiguation' && data.extract?.trim()) {
            person.biography = data.extract.trim();
            if (data.content_urls?.desktop?.page) {
              person.wikipedia_url = data.content_urls.desktop.page;
            }
            break;
          }
        } catch {
          /* tenta próximo idioma */
        }
      }
    }

    // SÉRIES: a API devolve `name`/`first_air_date` (e não title/release_date).
    // Normaliza e marca media_type: 'tv' para o clique abrir /tv/{id} e filtra
    // talk-shows, telejornais, reality shows e aparições de entrevista ("Self").
    const SELF_GUEST_RE =
      /^(self|himself|herself|ele mesmo|ela mesma|archive footage)(\b|\s*[-–—(])/i;

    const normalizeTv = (list?: TMDBPersonMovieCredit[], isCast = false) =>
      (list ?? [])
        .filter((c) => {
          if (!c.poster_path) return false;
          if (c.genre_ids?.some((g) => TV_EXCLUDED_GENRE_IDS.has(g))) return false;
          if (isCast && c.character && SELF_GUEST_RE.test(c.character.trim())) return false;
          return true;
        })
        .map((c) => {
          const raw = c as unknown as {
            name?: string;
            original_name?: string;
            first_air_date?: string;
          };
          return {
            ...c,
            title: c.title || raw.name || '',
            original_title: c.original_title || raw.original_name || raw.name || '',
            release_date: c.release_date || raw.first_air_date || '',
            media_type: 'tv' as const,
          };
        });

    const normalizeMovie = (list?: TMDBPersonMovieCredit[]) =>
      (list ?? [])
        .filter((c) => Boolean(c.poster_path))
        .map((c) => ({
          ...c,
          media_type: 'movie' as const,
        }));

    if (person.movie_credits) {
      person.movie_credits.cast = normalizeMovie(person.movie_credits.cast);
      person.movie_credits.crew = normalizeMovie(person.movie_credits.crew);
    }
    if (person.tv_credits) {
      person.tv_credits.cast = normalizeTv(person.tv_credits.cast, true);
      person.tv_credits.crew = normalizeTv(person.tv_credits.crew, false);
    }
    setBoundedMap(personDetailsCache, cacheKey, { data: person, expires: Date.now() + TMDB_DETAILS_CACHE_TTL_MS }, 100);
    return person;
  },

  /**
   * Retorna o conjunto de chaves (`movie:${id}` / `tv:${id}`) da filmografia
   * de uma pessoa que estão disponíveis no serviço de streaming `providerId`.
   */
  async getPersonProviderMediaKeys(
    personId: number,
    providerId: number,
    credits: TMDBPersonMovieCredit[],
  ): Promise<Set<string>> {
    const matched = new Set<string>();
    try {
      const [usMovies, brMovies] = await Promise.allSettled([
        fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', {
          with_people: personId,
          with_watch_providers: providerId,
          watch_region: 'US',
          page: 1,
        }),
        fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', {
          with_people: personId,
          with_watch_providers: providerId,
          watch_region: 'BR',
          page: 1,
        }),
      ]);
      if (usMovies.status === 'fulfilled') {
        usMovies.value.results?.forEach((m) => matched.add(`movie:${m.id}`));
      }
      if (brMovies.status === 'fulfilled') {
        brMovies.value.results?.forEach((m) => matched.add(`movie:${m.id}`));
      }

      // Verifica também os principais créditos (incluindo séries de TV) via watch/providers
      const topToVerify = credits
        .filter((c) => !matched.has(`${c.media_type ?? 'movie'}:${c.id}`))
        .slice(0, 24);

      await Promise.allSettled(
        topToVerify.map(async (item) => {
          const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
          const wp = await fetchFromTMDB<{
            results?: Record<
              string,
              {
                flatrate?: { provider_id: number }[];
                rent?: { provider_id: number }[];
                buy?: { provider_id: number }[];
              }
            >;
          }>(`/${mediaType}/${item.id}/watch/providers`);
          const regions = wp?.results ?? {};
          for (const reg of ['BR', 'US', 'GB']) {
            const r = regions[reg];
            if (!r) continue;
            const all = [...(r.flatrate ?? []), ...(r.rent ?? []), ...(r.buy ?? [])];
            if (all.some((p) => p.provider_id === providerId)) {
              matched.add(`${mediaType}:${item.id}`);
              break;
            }
          }
        }),
      );
    } catch {
      /* mantém o que já coletou */
    }
    return matched;
  },

  streamingServices: [
    { id: 8, name: 'Netflix' },
    { id: 9, name: 'Amazon Prime Video' },
    { id: 337, name: 'Disney+' },
    { id: 350, name: 'Apple TV+' },
    { id: 1899, name: 'Max' },
  ],

  languages: [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'French' },
    { code: 'ja', name: 'Japanese' },
    { code: 'es', name: 'Spanish' },
    { code: 'it', name: 'Italian' },
    { code: 'de', name: 'German' },
    { code: 'ko', name: 'Korean' },
    { code: 'pt', name: 'Portuguese' },
  ],

  async discoverMovies(params: {
    genreId?: number;
    year?: number;
    decade?: number;
    providerId?: number;
    language?: string;
    /** País/nacionalidade: aceita ISO alpha-2 ou nome por extenso (Brazil → BR) */
    country?: string;
    sortBy?: string;
    page?: number;
    /** Limites de data de lançamento (YYYY-MM-DD) — usado pelo filtro Released */
    releaseDateGte?: string;
    releaseDateLte?: string;
    /** Piso de votos explícito (sobrescreve o padrão por sortBy) */
    minVotes?: number;
    /** Gêneros excluídos no servidor (ex.: '99,10402' p/ docs/musicais) */
    withoutGenres?: string;
  }): Promise<TMDBResponse<TMDBMovie>> {
    // Ano/década futuros (ex.: 2028) ainda não têm votos: com o piso de votos
    // o TMDb retorna 0 resultados. Nesses casos o piso é omitido.
    const futureYear =
      (params.year && params.year > CURRENT_YEAR) ||
      (params.decade && params.decade + 9 > CURRENT_YEAR);

    const apiParams: Record<string, string | number | undefined> = {
      page: params.page || 1,
      sort_by: params.sortBy || 'popularity.desc',
      // TMDB bug: vote_count.gte + lançamentos futuros (upcoming) = 0 resultados.
      // Quando há limite de data futura, omitimos o piso de votos.
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

    // Nacionalidade: SEMPRE with_origin_country com código ISO (jamais region
    // ou watch_region — esses mudam disponibilidade de streaming, não origem)
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
    }

    if (params.year) {
      apiParams.primary_release_year = params.year;
    } else if (params.decade) {
      apiParams['primary_release_date.gte'] = `${params.decade}-01-01`;
      apiParams['primary_release_date.lte'] = `${params.decade + 9}-12-31`;
    }

    // Filtro Released (upcoming/released) — aplicado no servidor
    if (params.releaseDateGte) apiParams['primary_release_date.gte'] = params.releaseDateGte;
    if (params.releaseDateLte) apiParams['primary_release_date.lte'] = params.releaseDateLte;

    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', apiParams);
  },

  async discoverMoviesBatch(params: {
    genreId?: number;
    year?: number;
    decade?: number;
    providerId?: number;
    language?: string;
    country?: string;
    sortBy?: string;
    page?: number;
    pagesToFetch?: number;
    releaseDateGte?: string;
    releaseDateLte?: string;
    minVotes?: number;
    withoutGenres?: string;
  }): Promise<{ results: TMDBMovie[]; total_results: number; total_pages: number }> {
    const startPage = ((params.page || 1) - 1) * (params.pagesToFetch || 3) + 1;
    const count = params.pagesToFetch || 3;
    const pageNumbers = Array.from({ length: count }, (_, i) => startPage + i);

    const responses = await Promise.all(
      pageNumbers.map((p) => this.discoverMovies({ ...params, page: p }).catch(() => ({ results: [], total_results: 0, total_pages: 0, page: p })))
    );

    const allResults = responses.flatMap((r) => r.results);
    // Deduplicate by ID
    const seen = new Set<number>();
    const unique = allResults.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    const firstRes = responses[0] || { total_results: 0, total_pages: 1 };
    const isUpcomingQuery = Boolean(params.releaseDateGte && params.releaseDateGte > TMDB_TODAY);
    const filteredResults = isUpcomingQuery
      ? await filterStrictlyUnreleasedMovies(unique)
      : unique;

    return {
      results: filteredResults,
      total_results: firstRes.total_results,
      total_pages: Math.ceil(firstRes.total_pages / count),
    };
  },

  // ===================== TV / SERIES =====================

  async getPopularTV(page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/tv/popular', { page });
  },

  async getTopRatedTV(page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/tv/top_rated', { page });
  },

  async getTrendingTV(timeWindow: 'day' | 'week' = 'week', page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/trending/tv/${timeWindow}`, { page });
  },

  async discoverTV(params: {
    genreId?: number;
    year?: number;
    decade?: number;
    providerId?: number;
    language?: string;
    /** País/nacionalidade: aceita ISO alpha-2 ou nome por extenso (Brazil → BR) */
    country?: string;
    sortBy?: string;
    page?: number;
    /** Limites da primeira exibição (YYYY-MM-DD) — usado pelo filtro Released */
    releaseDateGte?: string;
    releaseDateLte?: string;
    /** Piso de votos explícito (sobrescreve o padrão por sortBy) */
    minVotes?: number;
    /** Gêneros excluídos no servidor — SEM reagendar talk/news/reality */
    withoutGenres?: string;
  }): Promise<TMDBResponse<TMDBMovie>> {
    // Banimento global anti Talk Show/News/Reality: só é suspenso se o usuário
    // escolher explicitamente um desses gêneros no filtro de gênero.
    const antiGenres =
      params.genreId && TV_EXCLUDED_GENRE_IDS.has(params.genreId)
        ? params.withoutGenres
        : [TV_EXCLUDED_GENRES, params.withoutGenres].filter(Boolean).join(',');

    // Ano/década futuros: sem votos ainda → omite o piso (senão retorna 0).
    const futureYear =
      (params.year && params.year > CURRENT_YEAR) ||
      (params.decade && params.decade + 9 > CURRENT_YEAR);

    const apiParams: Record<string, string | number | undefined> = {
      page: params.page || 1,
      sort_by: params.sortBy || 'popularity.desc',
      // TMDB bug: vote_count.gte + estreias futuras (upcoming) = 0 resultados.
      'vote_count.gte':
        params.releaseDateGte || futureYear
          ? undefined
          : params.minVotes ?? (params.sortBy?.includes('vote_average') ? 100 : 20),
      include_adult: 'false',
      without_genres: antiGenres,
    };

    if (params.genreId) apiParams.with_genres = params.genreId;

    // Nacionalidade: SEMPRE with_origin_country com código ISO
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

    // Filtro Released (upcoming/released) — aplicado no servidor
    if (params.releaseDateGte) apiParams['first_air_date.gte'] = params.releaseDateGte;
    if (params.releaseDateLte) apiParams['first_air_date.lte'] = params.releaseDateLte;

    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/tv', apiParams);
  },

  async discoverTVBatch(params: {
    genreId?: number;
    year?: number;
    decade?: number;
    providerId?: number;
    language?: string;
    country?: string;
    sortBy?: string;
    page?: number;
    pagesToFetch?: number;
    releaseDateGte?: string;
    releaseDateLte?: string;
    minVotes?: number;
    withoutGenres?: string;
  }): Promise<{ results: TMDBMovie[]; total_results: number; total_pages: number }> {
    const startPage = ((params.page || 1) - 1) * (params.pagesToFetch || 3) + 1;
    const count = params.pagesToFetch || 3;
    const pageNumbers = Array.from({ length: count }, (_, i) => startPage + i);
    const responses = await Promise.all(
      pageNumbers.map((p) => this.discoverTV({ ...params, page: p }).catch(() => ({ results: [], total_results: 0, total_pages: 0, page: p })))
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
  },

  async getCuratedPopularBatch(
    type: 'movie' | 'tv',
    page = 1,
    targetCount = 72,
  ): Promise<{ results: TMDBMovie[]; total_results: number; total_pages: number }> {
    const baseBatch = (page - 1) * 2;
    const buildFn = type === 'tv' ? buildCuratedPopularSeriesPool : buildCuratedPopularMoviesPool;
    const [poolA, poolB] = await Promise.all([
      buildFn(baseBatch),
      buildFn(baseBatch + 1),
    ]);
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
  },

  // ---------------------------------------------------------------------
  // FONTE ÚNICA DE DADOS DAS VITRINES — usada pelos carrosséis da Home E
  // pela página /browse/results (ordem 100% idêntica + paginação contínua).
  // ---------------------------------------------------------------------
  async getSectionMedia(
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
    const discover = type === 'tv' ? this.discoverTVBatch : this.discoverMoviesBatch;
    const minVotesPopular = type === 'tv' ? 20 : 30;

    // "Popular this week" = Motor Multi-Sinal (Cinema em Cartaz + Estreias no Streaming + Trending)
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

      // Quando há filtros extras (ex.: Gênero ou Serviço de Streaming) mas sem ano/década fixos no passado,
      // combinamos lançamentos recentes (últimos 135 dias) com os mais populares do filtro para manter
      // estreias recentes de cinema/streaming na frente.
      const isHistoricalFilter =
        (extraFilters.year && extraFilters.year < CURRENT_YEAR) ||
        (extraFilters.decade && extraFilters.decade + 9 < CURRENT_YEAR);

      if (!isHistoricalFilter) {
        const recentWindowStart = daysOffsetIso(-135);
        const [recentRes, generalRes] = await Promise.all([
          discover.call(this, {
            ...extraFilters,
            sortBy: 'popularity.desc',
            releaseDateGte: recentWindowStart,
            releaseDateLte: TMDB_TODAY,
            minVotes: type === 'tv' ? 10 : 15,
            page,
            pagesToFetch: 1,
          }),
          discover.call(this, {
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
            let s = Math.sqrt(Math.max(1, m.popularity || 1)) * 8 + Math.log10(Math.max(10, m.vote_count || 10)) * 22;
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
        // filmes: sem documentário/musical de nota inflada;
        // séries já banem talk/news/reality por padrão
        withoutGenres: type === 'movie' ? ('99,10402' as string | undefined) : undefined,
      },
      most_watched: {
        sortBy: 'vote_count.desc',
        releaseDateLte: TMDB_TODAY,
        minVotes: type === 'tv' ? 100 : 500,
      },
      most_anticipated: {
        sortBy: 'popularity.desc',
        // somente estreias futuras (a partir de amanhã) — servidor
        releaseDateGte: TMDB_TOMORROW,
      },
    }[preset];

    const res = await discover.call(this, {
      ...extraFilters,
      ...presetParams,
      page,
      pagesToFetch: preset === 'most_anticipated' ? 2 : 1,
    });

    if (preset === 'most_anticipated') {
      const results =
        type === 'movie'
          ? await filterStrictlyUnreleasedMovies(res.results)
          : res.results.filter(isFuture);
      return { ...res, results };
    }

    // Pós-filtro JS obrigatório por preset
    const gate: (m: TMDBMovie) => boolean =
      preset === 'highest_rated'
        ? (m) => isReleasedWithVotes(m, type === 'tv' ? 1500 : 10000)
        : (m) => isReleasedWithVotes(m, preset === 'most_watched' ? 1 : minVotesPopular);

    return { ...res, results: res.results.filter(gate) };
  },

  // ---------------------------------------------------------------------
  // Seções curadas das abas Films/Series (padrão app Letterboxd).
  // Regras OBRIGATÓRIAS (validadas no servidor E novamente em JS):
  //  - Popular/Highest rated/Most watched: APENAS títulos já lançados
  //    (data <= TODAY) com o piso de votos da seção.
  //  - Most anticipated: APENAS inéditos (estreia > TODAY), dupla checagem
  //    em JS e NUNCA compartilhando itens com Popular/Most watched.
  //
  // As 4 seções passam por getSectionMedia para que /browse/results exiba
  // exatamente a mesma ordem da Home ao abrir a partir de uma vitrine.
  // ---------------------------------------------------------------------

  /** Aba Films: Popular / Highest rated / Most watched / Most anticipated */
  async getFilmsHubSections(): Promise<{
    popular: TMDBMovie[];
    highestRated: TMDBMovie[];
    mostWatched: TMDBMovie[];
    mostAnticipated: TMDBMovie[];
  }> {
    if (filmsHubInFlight) return filmsHubInFlight;
    filmsHubInFlight = (async () => {
      const [popRes, ratedRes, watchedRes, anticipatedRes] = await Promise.all([
        this.getSectionMedia('movie', 'popular_week', 1),
        this.getSectionMedia('movie', 'highest_rated', 1),
        this.getSectionMedia('movie', 'most_watched', 1),
        this.getSectionMedia('movie', 'most_anticipated', 1),
      ]);

      const popular = popRes.results;
      const highestRated = ratedRes.results;
      const mostWatched = watchedRes.results;

      // Desduplicação: Most anticipated nunca compartilha itens das outras vitrines
      const seenIds = new Set([...popular, ...highestRated, ...mostWatched].map((m) => m.id));
      const mostAnticipated = anticipatedRes.results.filter((m) => !seenIds.has(m.id));

      return { popular, highestRated, mostWatched, mostAnticipated };
    })().finally(() => {
      filmsHubInFlight = null;
    });
    return filmsHubInFlight;
  },

  /** Aba Series: mesmas regras usando first_air_date + anti talk-show/news/reality */
  async getSeriesHubSections(): Promise<{
    popular: TMDBMovie[];
    highestRated: TMDBMovie[];
    mostWatched: TMDBMovie[];
    mostAnticipated: TMDBMovie[];
  }> {
    if (seriesHubInFlight) return seriesHubInFlight;
    seriesHubInFlight = (async () => {
      const [popRes, ratedRes, watchedRes, anticipatedRes] = await Promise.all([
        this.getSectionMedia('tv', 'popular_week', 1),
        this.getSectionMedia('tv', 'highest_rated', 1),
        this.getSectionMedia('tv', 'most_watched', 1),
        this.getSectionMedia('tv', 'most_anticipated', 1),
      ]);

      const popular = popRes.results;
      const highestRated = ratedRes.results;
      const mostWatched = watchedRes.results;

      const seenIds = new Set([...popular, ...highestRated, ...mostWatched].map((m) => m.id));
      const mostAnticipated = anticipatedRes.results.filter((m) => !seenIds.has(m.id));

      return { popular, highestRated, mostWatched, mostAnticipated };
    })().finally(() => {
      seriesHubInFlight = null;
    });
    return seriesHubInFlight;
  },

  // Detalhes de serie normalizados para o formato de filme (title/name etc.)
  async getTVDetails(id: number): Promise<TMDBMovieDetails> {
    const cacheKey = `tv:${id}:${tmdbLanguage}`;
    const cached = mediaDetailsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    let show: TMDBMovieDetails;
    try {
      show = await fetchFromTMDB<TMDBMovieDetails>(`/tv/${id}`, {
        append_to_response:
          'credits,aggregate_credits,similar,recommendations,watch/providers,videos,content_ratings,external_ids,alternative_titles',
      });
    } catch {
      show = await fetchFromTMDB<TMDBMovieDetails>(`/tv/${id}`, {
        append_to_response: 'credits,aggregate_credits,videos,content_ratings,similar',
      });
    }

    // Fallback para garantir sempre sinopse, créditos e backdrop completos
    const needsEnFallback =
      !show.overview ||
      !show.backdrop_path ||
      (!show.credits?.cast?.length && !show.credits?.crew?.length);
    if (needsEnFallback) {
      try {
        const en = await fetchFromTMDB<TMDBMovieDetails>(`/tv/${id}`, {
          language: 'en-US',
          append_to_response: 'credits,aggregate_credits',
        });
        if (!show.overview && en.overview) show.overview = en.overview;
        if (!show.tagline && en.tagline) show.tagline = en.tagline;
        if (!show.backdrop_path && en.backdrop_path) show.backdrop_path = en.backdrop_path;
        if (!show.poster_path && en.poster_path) show.poster_path = en.poster_path;
        if (!show.credits?.cast?.length && en.credits?.cast?.length) {
          show.credits = {
            cast: en.credits.cast,
            crew: show.credits?.crew?.length ? show.credits.crew : (en.credits.crew || []),
          };
        }
      } catch {
        /* mantém vazio */
      }
    }
    const showAny = show as unknown as Record<string, unknown>;
    if (!show.backdrop_path) {
      show.backdrop_path = show.poster_path || null;
    }
    show.title = (showAny.name as string) || '';
    show.original_title = (showAny.original_name as string) || show.title;
    show.release_date = (showAny.first_air_date as string) || show.release_date || '';
    const ert = showAny.episode_run_time as number[] | undefined;
    const lastEp = showAny.last_episode_to_air as { runtime?: number } | undefined;
    const nextEp = showAny.next_episode_to_air as { runtime?: number } | undefined;
    show.runtime = (Array.isArray(ert) && ert.length ? ert[0] : 0) || lastEp?.runtime || nextEp?.runtime || (showAny.runtime as number) || 0;

    if (!show.credits) {
      show.credits = { cast: [], crew: [] };
    }

    // Mescla aggregate_credits (onde o TMDB guarda diretores de episódios/série e elenco acumulado em animes/minisséries)
    const aggCredits = showAny.aggregate_credits as {
      cast?: {
        id: number;
        name: string;
        profile_path: string | null;
        order: number;
        roles?: { character: string; episode_count: number }[];
      }[];
      crew?: {
        id: number;
        name: string;
        department: string;
        profile_path: string | null;
        jobs?: { job: string; episode_count: number }[];
      }[];
    } | undefined;

    if (aggCredits?.cast?.length) {
      const existingById = new Map(show.credits.cast.map((c) => [c.id, c]));
      for (let idx = 0; idx < aggCredits.cast.length; idx++) {
        const ac = aggCredits.cast[idx];
        const roleNames = Array.from(
          new Set(
            (ac.roles ?? [])
              .map((r) => r.character?.trim())
              .filter((ch): ch is string => Boolean(ch)),
          ),
        );
        const characterStr = roleNames.join(' / ');
        const existing = existingById.get(ac.id);
        if (existing) {
          if (!existing.character && characterStr) {
            existing.character = characterStr;
          }
          if (!existing.profile_path && ac.profile_path) {
            existing.profile_path = ac.profile_path;
          }
        } else {
          const entry = {
            id: ac.id,
            name: ac.name,
            character: characterStr,
            profile_path: ac.profile_path ?? null,
            order: ac.order ?? show.credits.cast.length + idx,
          };
          show.credits.cast.push(entry);
          existingById.set(ac.id, entry);
        }
      }
    }

    if (aggCredits?.crew?.length) {
      for (const ac of aggCredits.crew) {
        for (const j of ac.jobs ?? []) {
          const normalizedJob = j.job === 'Series Director' ? 'Director' : j.job;
          const alreadyExists = show.credits.crew.some(
            (m) => m.id === ac.id && (m.job === normalizedJob || m.job === j.job)
          );
          if (!alreadyExists) {
            show.credits.crew.push({
              id: ac.id,
              name: ac.name,
              job: normalizedJob,
              department: ac.department || 'Directing',
              profile_path: ac.profile_path ?? null,
            });
          }
        }
      }
    }

    const createdBy = (showAny.created_by as { id: number; name: string; profile_path?: string | null }[] | undefined) || [];
    if (createdBy.length > 0) {
      for (const c of createdBy) {
        // O criador costuma JÁ estar no crew com outro cargo (ex.: "Executive
        // Producer"). Deduplicar só por id deixava a série sem nenhum crédito
        // "Creator" — e o cabeçalho (que procura Director/Creator) ficava sem
        // nome. Aqui a entrada existente é PROMOVIDA a Creator.
        const existente = show.credits.crew.find((m) => m.id === c.id);
        if (existente) existente.job = 'Creator';
        else
          show.credits.crew.unshift({
            id: c.id,
            name: c.name,
            job: 'Creator',
            department: 'Production',
            profile_path: c.profile_path ?? null,
          });
      }
    } else if (!show.credits.crew.some((m) => m.job === 'Creator')) {
      // Séries/animes/minisséries sem `created_by` preenchido no TMDB (ex.: Uzumaki,
      // Dragon Ball): promove o autor da obra original ou diretor principal da série.
      const ORIGINAL_CREATOR_JOBS = [
        'Original Creator',
        'Original Series Creator',
        'Original Story',
        'Original Concept',
        'Graphic Novel',
        'Comic Book',
        'Manga',
        'Novel',
        'Author',
      ];
      const fallbackCreator =
        show.credits.crew.find((m) => ORIGINAL_CREATOR_JOBS.includes(m.job)) ||
        show.credits.crew.find((m) => m.job === 'Series Director' || m.job === 'Director') ||
        show.credits.crew.find((m) => ['Series Composition', 'Writer', 'Screenplay', 'Script'].includes(m.job)) ||
        show.credits.crew.find((m) => m.job === 'Executive Producer' || m.job === 'Producer');
      if (fallbackCreator && fallbackCreator.job !== 'Director') {
        show.credits.crew.unshift({
          ...fallbackCreator,
          job: 'Creator',
        });
      }
    }
    const normList = (r: TMDBMovie[]) =>
      r?.map((m) => {
        const a = m as unknown as Record<string, unknown>;
        return {
          ...m,
          title: (m.title || (a.name as string) || '') as string,
          release_date: (m.release_date || (a.first_air_date as string) || '') as string,
        };
      });
    if (show.similar) show.similar.results = normList(show.similar.results);
    if (show.recommendations) show.recommendations.results = normList(show.recommendations.results);
    const similarRanked = await curateSimilarForDetails(show, 'tv', true);
    show.similar = { results: similarRanked };
    setBoundedMap(mediaDetailsCache, cacheKey, { data: show, expires: Date.now() + TMDB_DETAILS_CACHE_TTL_MS }, 200);
    return show;
  },

  /**
   * Busca exata por TMDB ID para o importador estilo Letterboxd.
   */
  async getMovieForImportById(tmdbId: number): Promise<TMDBSearchResult | null> {
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
  },

  /**
   * Busca exata por IMDb ID (ex.: tt0086567) via endpoint /find do TMDB.
   */
  async findByImdbId(
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
  },

  /**
   * Busca candidatos de filmes para o importador ("best-guess match") por título + ano opcional,
   * enriquecendo os primeiros candidatos com diretores e títulos alternativos.
   */
  async searchMoviesForImport(
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

      // Verifica se já encontrou algum título exato na busca com ano
      const normQ = q.toLowerCase().replace(/[^a-z0-9]/g, '');
      const hasExactTitleHit = combined.some((m) => {
        const t1 = (m.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const t2 = (m.original_title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return t1 === normQ || t2 === normQ;
      });

      // Se buscou com ano e não achou título exato (comum quando o ano do Letterboxd
      // é o ano de festival e difere em ±1 ano da estreia comercial no TMDB), busca sem ano
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
  },

  tvGenres: [
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
  ],
  genres: [
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
  ],
};
