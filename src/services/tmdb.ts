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

/** Quantos itens da 1ª página recebem diretores/títulos alternativos. */
const SEARCH_ENRICH_LIMIT = 15;

/**
 * Diretores + títulos alternativos de UM título.
 * Em séries, "Directed by" usa os criadores (created_by) + diretores de episódios.
 * Qualquer falha degrada para arrays vazios — a lista nunca quebra por isso.
 */
async function fetchSearchEnrichment(
  id: number,
  mediaType: 'movie' | 'tv'
): Promise<{ directors: string[]; alternativeTitles: string[] }> {
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
    return { directors: directors.slice(0, 4), alternativeTitles };
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
const tmdbCache = new Map<string, { data: unknown; expires: number }>();
const tmdbInflight = new Map<string, Promise<unknown>>();

async function fetchFromTMDB<T>(endpoint: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
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

  const urlString = url.toString();

  // Cache hit?
  const cached = tmdbCache.get(urlString);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T;
  }

  // Requisição idêntica já em andamento? Reutiliza a mesma Promise.
  const inflight = tmdbInflight.get(urlString);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const promise = (async () => {
    const res = await fetch(urlString, { headers });
    if (!res.ok) {
      throw new Error(`TMDB error ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    // Esconde itens sem pôster (no site todo): em listas de filmes, descarta
    // resultados com poster_path nulo. Itens sem a chave (ex.: pessoas em
    // buscas multi) ou com pôster preenchido passam normalmente.
    if (data && Array.isArray(data.results)) {
      data.results = data.results
        .filter((r: { poster_path?: string | null }) => !('poster_path' in r) || Boolean(r.poster_path))
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
    tmdbCache.set(urlString, { data, expires: Date.now() + TMDB_CACHE_TTL_MS });
    // Limpeza simples: evita crescimento ilimitado do cache em sessões longas.
    if (tmdbCache.size > 300) {
      const now = Date.now();
      for (const [key, entry] of tmdbCache) {
        if (entry.expires <= now) tmdbCache.delete(key);
      }
    }
    return data as T;
  })();

  tmdbInflight.set(urlString, promise);
  try {
    return await promise;
  } finally {
    tmdbInflight.delete(urlString);
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

/** Estritamente inédito/futuro (estreia > hoje) */
const isFuture = (m: TMDBMovie) => {
  const d = itemDate(m);
  return Boolean(d) && d > TMDB_TODAY;
};

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
): Promise<TMDBMovie[]> {
  const cacheKey = `${type}:${details.id}:${tmdbLanguage}`;
  const genreIds = (details.genres || []).map((g) => g.id);
  const rawKeywords = details.keywords?.keywords || details.keywords?.results || [];
  const keywordIds = rawKeywords.slice(0, 6).map((k) => k.id);
  const rawDate = details.release_date || ((details as unknown as Record<string, unknown>).first_air_date as string) || '';
  const releaseYear = rawDate ? parseInt(rawDate.slice(0, 4), 10) || 0 : 0;
  const collectionObj = (details as unknown as { belongs_to_collection?: { id: number } | null }).belongs_to_collection;
  const collectionId = type === 'movie' && collectionObj?.id ? collectionObj.id : undefined;

  const extraCalls = await Promise.allSettled([
    collectionId
      ? fetchFromTMDB<{ parts?: TMDBMovie[] }>(`/collection/${collectionId}`)
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
  // Ordena os filmes da coleção por data de lançamento (cronológico) e exige pôster
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

  // Como os capítulos da mesma coleção aparecem na seção dedicada "RELATED FILMS",
  // removemos os IDs da coleção da seção "SIMILAR FILMS" para não duplicar logo abaixo.
  const collectionIdSet = new Set(collectionParts.map((m) => m.id));
  const rankedAll = rankSimilarCandidates(profile, {
    recommendations: [...(details.recommendations?.results || []), ...recPage2],
    keywordDiscover: [...kwDiscover1, ...kwDiscover2],
    similar: [...(details.similar?.results || []), ...simPage2],
  });
  const ranked = rankedAll.filter((m) => !collectionIdSet.has(m.id)).slice(0, 80);

  profile.rankedPool = ranked;
  similarProfileCache.set(cacheKey, profile);
  return ranked;
}

export const tmdb = {
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

  async getTrending(timeWindow: 'day' | 'week' = 'week'): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/trending/movie/${timeWindow}`);
  },

  async getMovieDetails(id: number): Promise<TMDBMovieDetails> {
    const movie = await fetchFromTMDB<TMDBMovieDetails>(`/movie/${id}`, {
      append_to_response: 'credits,similar,recommendations,watch/providers,videos,release_dates,external_ids,keywords,alternative_titles',
    });
    // Fallback pt-BR → en-US quando sinopse/tagline vêm vazias (filmes inéditos)
    if (tmdbLanguage !== 'en-US' && (!movie.overview || !movie.tagline)) {
      try {
        const en = await fetchFromTMDB<TMDBMovieDetails>(`/movie/${id}`, {
          language: 'en-US',
          append_to_response: 'credits',
        });
        if (!movie.overview) movie.overview = en.overview;
        if (!movie.tagline) movie.tagline = en.tagline;
      } catch {
        /* mantém vazio */
      }
    }
    const similarRanked = await curateSimilarForDetails(movie, 'movie');
    movie.similar = { results: similarRanked };
    return movie;
  },

  async getMovieImages(id: number): Promise<TMDBMovieImages> {
    return fetchFromTMDB<TMDBMovieImages>(`/movie/${id}/images`, {
      include_image_language: 'en,null',
    });
  },

  async getCollectionDetails(collectionId: number): Promise<TMDBCollectionDetails> {
    const col = await fetchFromTMDB<TMDBCollectionDetails>(`/collection/${collectionId}`);
    const parts = (col.parts || [])
      .map(normalizeMediaItem)
      .filter((m) => Boolean(m.poster_path) && (!itemDate(m) || itemDate(m) <= TMDB_TODAY))
      .sort((a, b) => {
        const da = itemDate(a) || '9999-12-31';
        const db = itemDate(b) || '9999-12-31';
        return da.localeCompare(db);
      });
    return {
      ...col,
      parts,
    };
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
    const person = await fetchFromTMDB<TMDBPersonDetails>(`/person/${id}`, {
      append_to_response: 'movie_credits,tv_credits',
    });
    if (tmdbLanguage !== 'en-US' && !person.biography) {
      try {
        const en = await fetchFromTMDB<TMDBPersonDetails>(`/person/${id}`, {
          language: 'en-US',
          append_to_response: 'movie_credits,tv_credits',
        });
        if (!person.biography) person.biography = en.biography;
        if (!person.movie_credits && en.movie_credits) person.movie_credits = en.movie_credits;
        if (!person.tv_credits && en.tv_credits) person.tv_credits = en.tv_credits;
      } catch {
        /* mantém vazio — a Bio mostra aviso de indisponível */
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
    return person;
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

    return {
      results: unique,
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

  async getTrendingTV(timeWindow: 'day' | 'week' = 'week'): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/trending/tv/${timeWindow}`);
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
    // "Popular this week" = trending semanal oficial do TMDB (popularidade da semana)
    if (preset === 'popular_week') {
      const trending = type === 'tv'
        ? await this.getTrendingTV('week')
        : await this.getTrending('week');
      // Sem piso de votos: a ordem do trending (popularidade da semana) é mantida.
      // Só removemos títulos com estreia futura.
      const ordered = trending.results.filter((m) => {
        const d = itemDate(m);
        return !d || d <= TMDB_TODAY;
      });

      // Filmes: os que estão em cartaz nos cinemas vêm primeiro (mantendo a ordem
      // do trending). Séries não têm lista "em cartaz" no TMDB, seguem o trending.
      if (type !== 'tv') {
        const nowPlaying = await this.getNowPlaying(1);
        const inTheaters = new Set(nowPlaying.results.map((m) => m.id));
        // Critério 1: em cartaz primeiro. Critério 2: maior popularidade.
        ordered.sort(
          (a, b) =>
            Number(inTheaters.has(b.id)) - Number(inTheaters.has(a.id)) ||
            (b.popularity ?? 0) - (a.popularity ?? 0),
        );
      }

      const results = ordered;
      return { results, total_pages: trending.total_pages, total_results: results.length };
    }

    const discover = type === 'tv' ? this.discoverTVBatch : this.discoverMoviesBatch;
    const minVotesPopular = type === 'tv' ? 30 : 50;

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
      pagesToFetch: preset === 'highest_rated' && page === 1 ? 2 : 1,
    });

    // Pós-filtro JS obrigatório por preset
    const gate: (m: TMDBMovie) => boolean =
      preset === 'most_anticipated'
        ? isFuture
        : preset === 'highest_rated'
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
  },

  /** Aba Series: mesmas regras usando first_air_date + anti talk-show/news/reality */
  async getSeriesHubSections(): Promise<{
    popular: TMDBMovie[];
    highestRated: TMDBMovie[];
    mostWatched: TMDBMovie[];
    mostAnticipated: TMDBMovie[];
  }> {
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
  },

  // Detalhes de serie normalizados para o formato de filme (title/name etc.)
  async getTVDetails(id: number): Promise<TMDBMovieDetails> {
    const show = await fetchFromTMDB<TMDBMovieDetails>(`/tv/${id}`, {
      append_to_response: 'credits,aggregate_credits,similar,recommendations,watch/providers,videos,content_ratings,external_ids,keywords,alternative_titles',
    });
    // Fallback pt-BR → en-US quando sinopse/tagline vêm vazias
    if (tmdbLanguage !== 'en-US' && (!show.overview || !show.tagline)) {
      try {
        const en = await fetchFromTMDB<TMDBMovieDetails>(`/tv/${id}`, {
          language: 'en-US',
          append_to_response: 'credits',
        });
        if (!show.overview) show.overview = en.overview;
        if (!show.tagline) show.tagline = en.tagline;
      } catch {
        /* mantém vazio */
      }
    }
    const showAny = show as unknown as Record<string, unknown>;
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
    const similarRanked = await curateSimilarForDetails(show, 'tv');
    show.similar = { results: similarRanked };
    return show;
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
