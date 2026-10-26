// Serviço de Nota Unificada (Letterboxd, IMDb, Metacritic, Rotten Tomatoes e TMDb)
// Consulta MDBList API (principal) com fallback automático para OMDb API
// e cache persistente em localStorage (notas_unificadas_v1_${tmdbId}).

const MDBLIST_API_KEY =
  (import.meta.env.VITE_MDBLIST_API_KEY as string | undefined)?.trim() ||
  'lpszy6kb88hgtx0a2aeqiwjo1';

const OMDB_API_KEY =
  (import.meta.env.VITE_OMDB_API_KEY as string | undefined)?.trim() ||
  'dbd20520';

export type RatingPlatformSource =
  | 'letterboxd'
  | 'imdb'
  | 'tomatoes'
  | 'metacritic'
  | 'tmdb';

export interface PlatformRatingItem {
  source: RatingPlatformSource;
  label: string;
  shortLabel: string;
  /** Nota normalizada de 0 a 100 usada na média ponderada */
  score: number;
  /** Valor original vindo da API (campo `value` na MDBList ou equivalente na OMDb) */
  rawValue: number | string;
  /** Valor formatado para exibição na interface (ex: "4.2", "8.5", "92%", "81", "7.9") */
  displayValue: string;
  /** Peso aplicado no cálculo da Nota Unificada */
  weight: number;
}

export interface UnifiedRatingsPayload {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  /** Média ponderada de 0 a 100 */
  unifiedScore100: number;
  /** Média ponderada convertida para a escala Letterboxd de 0 a 5 estrelas */
  unifiedStars5: number;
  /** Notas individuais de cada plataforma disponível */
  sources: PlatformRatingItem[];
  provider: 'mdblist' | 'omdb' | 'tmdb';
  updatedAt: number;
}

const SOURCE_CONFIG: Record<
  RatingPlatformSource,
  { label: string; shortLabel: string; weight: number; order: number }
> = {
  letterboxd: { label: 'Letterboxd', shortLabel: 'LB', weight: 3.0, order: 1 },
  imdb: { label: 'IMDb', shortLabel: 'IMDb', weight: 2.5, order: 2 },
  tomatoes: { label: 'Rotten Tomatoes', shortLabel: 'RT', weight: 1.5, order: 3 },
  metacritic: { label: 'Metacritic', shortLabel: 'MC', weight: 2.5, order: 4 },
  tmdb: { label: 'TMDb', shortLabel: 'TMDb', weight: 1.0, order: 5 },
};

const memoryCache = new Map<string, UnifiedRatingsPayload>();
const inFlightRequests = new Map<string, Promise<UnifiedRatingsPayload | null>>();

/**
 * Gera a chave de cache no localStorage:
 * Para filmes usa exatamente `notas_unificadas_v1_${tmdbId}` conforme especificado.
 * Para séries usa `notas_unificadas_v1_tv_${tmdbId}` para evitar colisão de ID com filmes.
 */
export function getUnifiedRatingsStorageKey(tmdbId: number, isTv = false): string {
  return isTv ? `notas_unificadas_v1_tv_${tmdbId}` : `notas_unificadas_v1_${tmdbId}`;
}

export function getCachedUnifiedRatings(
  tmdbId: number,
  isTv = false,
): UnifiedRatingsPayload | null {
  if (!tmdbId || tmdbId <= 0) return null;
  const key = getUnifiedRatingsStorageKey(tmdbId, isTv);
  const mem = memoryCache.get(key);
  if (mem) return mem;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UnifiedRatingsPayload;
    if (
      parsed &&
      typeof parsed.unifiedScore100 === 'number' &&
      typeof parsed.unifiedStars5 === 'number' &&
      Array.isArray(parsed.sources) &&
      parsed.sources.length > 0
    ) {
      parsed.sources = [...parsed.sources].sort(
        (a, b) => (SOURCE_CONFIG[a.source]?.order ?? 99) - (SOURCE_CONFIG[b.source]?.order ?? 99),
      );
      memoryCache.set(key, parsed);
      return parsed;
    }
  } catch {
    /* localStorage indisponível ou JSON inválido */
  }
  return null;
}

function saveCachedUnifiedRatings(
  tmdbId: number,
  isTv: boolean,
  payload: UnifiedRatingsPayload,
): void {
  const key = getUnifiedRatingsStorageKey(tmdbId, isTv);
  memoryCache.set(key, payload);
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* quota cheia ou modo privado */
  }
}

function formatPlatformDisplayValue(
  source: RatingPlatformSource,
  value: number | string | null | undefined,
  score: number,
): string {
  if (value !== null && value !== undefined && String(value).trim() !== '') {
    const strVal = String(value).trim();
    const numVal = Number(strVal.replace('%', ''));

    if (!Number.isNaN(numVal) && numVal > 0) {
      switch (source) {
        case 'letterboxd': {
          // Na MDBList, letterboxd value vem na escala 0-5 (ex: 4.1 ou 3.85)
          const normalized5 = numVal > 5 ? numVal / 20 : numVal;
          return normalized5.toFixed(1);
        }
        case 'imdb': {
          // Na MDBList, imdb value vem na escala 0-10 (ex: 8.4)
          const normalized10 = numVal > 10 ? numVal / 10 : numVal;
          return normalized10.toFixed(1);
        }
        case 'tomatoes': {
          return `${Math.round(numVal)}%`;
        }
        case 'metacritic': {
          return `${Math.round(numVal)}`;
        }
        case 'tmdb': {
          // Na MDBList, tmdb value costuma vir como porcentagem (ex: 79) ou 0-10 (ex: 7.9)
          if (numVal <= 10) {
            return numVal.toFixed(1);
          }
          return `${Math.round(numVal)}%`;
        }
      }
    }
    return strVal;
  }

  // Fallback caso `value` venha omitido mas `score` (0-100) exista
  switch (source) {
    case 'letterboxd':
      return (score / 20).toFixed(1);
    case 'imdb':
      return (score / 10).toFixed(1);
    case 'tomatoes':
      return `${Math.round(score)}%`;
    case 'metacritic':
      return `${Math.round(score)}`;
    case 'tmdb':
      return `${Math.round(score)}%`;
  }
}

function normalizeScore100(
  source: RatingPlatformSource,
  rawScore: unknown,
  rawValue: unknown,
): number {
  const numScore = typeof rawScore === 'number' ? rawScore : Number(rawScore);
  if (!Number.isNaN(numScore) && numScore > 0) {
    return Math.max(0, Math.min(100, numScore));
  }

  const cleanVal =
    typeof rawValue === 'string' ? Number(rawValue.replace('%', '').trim()) : Number(rawValue);
  if (!Number.isNaN(cleanVal) && cleanVal > 0) {
    switch (source) {
      case 'letterboxd':
        return Math.max(0, Math.min(100, cleanVal <= 5 ? cleanVal * 20 : cleanVal));
      case 'imdb':
        return Math.max(0, Math.min(100, cleanVal <= 10 ? cleanVal * 10 : cleanVal));
      case 'tomatoes':
      case 'metacritic':
        return Math.max(0, Math.min(100, cleanVal));
      case 'tmdb':
        return Math.max(0, Math.min(100, cleanVal <= 10 ? cleanVal * 10 : cleanVal));
    }
  }
  return 0;
}

function buildPayloadFromSources(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  items: PlatformRatingItem[],
  provider: 'mdblist' | 'omdb' | 'tmdb',
): UnifiedRatingsPayload | null {
  const validItems = items
    .filter((item) => item.score > 0 && item.weight > 0)
    .sort((a, b) => SOURCE_CONFIG[a.source].order - SOURCE_CONFIG[b.source].order);

  if (validItems.length === 0) return null;

  let weightedSum = 0;
  let totalWeight = 0;
  for (const item of validItems) {
    weightedSum += item.score * item.weight;
    totalWeight += item.weight;
  }

  if (totalWeight <= 0) return null;

  const unifiedScore100 = Math.round((weightedSum / totalWeight) * 10) / 10;
  const unifiedStars5 = Math.round((unifiedScore100 / 20) * 100) / 100;

  return {
    tmdbId,
    mediaType,
    unifiedScore100,
    unifiedStars5,
    sources: validItems,
    provider,
    updatedAt: Date.now(),
  };
}

interface MDBListRatingEntry {
  source?: string;
  value?: number | string | null;
  score?: number | null;
  votes?: number | null;
}

interface MDBListResponse {
  id?: number;
  imdbid?: string;
  ratings?: MDBListRatingEntry[];
}

interface OMDbResponse {
  Response?: string;
  imdbRating?: string;
  Metascore?: string;
  Ratings?: { Source?: string; Value?: string }[];
}

export async function fetchUnifiedRatings(options: {
  tmdbId: number;
  isTv?: boolean;
  imdbId?: string | null;
  tmdbVoteAverage?: number;
}): Promise<UnifiedRatingsPayload | null> {
  const { tmdbId, isTv = false, imdbId, tmdbVoteAverage } = options;
  if (!tmdbId || tmdbId <= 0) return null;

  const cached = getCachedUnifiedRatings(tmdbId, isTv);
  if (cached) return cached;

  const cacheKey = getUnifiedRatingsStorageKey(tmdbId, isTv);
  const existingInFlight = inFlightRequests.get(cacheKey);
  if (existingInFlight) return existingInFlight;

  const mediaType: 'movie' | 'tv' = isTv ? 'tv' : 'movie';

  const task = (async (): Promise<UnifiedRatingsPayload | null> => {
    let resolvedImdbId = imdbId?.trim() || '';
    const mdbItemsMap = new Map<RatingPlatformSource, PlatformRatingItem>();

    // 1. Tenta MDBList API (Principal)
    try {
      const endpointType = isTv ? 'show' : 'movie';
      const mdbUrl = `https://api.mdblist.com/tmdb/${endpointType}/${tmdbId}?apikey=${encodeURIComponent(
        MDBLIST_API_KEY,
      )}`;
      const res = await fetch(mdbUrl);
      if (res.ok) {
        const data = (await res.json()) as MDBListResponse;
        if (!resolvedImdbId && data?.imdbid && /^tt\d+/i.test(data.imdbid)) {
          resolvedImdbId = data.imdbid.trim();
        }

        if (Array.isArray(data?.ratings)) {
          for (const entry of data.ratings) {
            const rawSource = (entry?.source || '').toLowerCase().trim() as RatingPlatformSource;
            if (!(rawSource in SOURCE_CONFIG)) continue;

            const cfg = SOURCE_CONFIG[rawSource];
            const score = normalizeScore100(rawSource, entry.score, entry.value);
            if (score <= 0) continue;

            const rawValue = entry.value ?? score;
            const displayValue = formatPlatformDisplayValue(rawSource, entry.value, score);

            mdbItemsMap.set(rawSource, {
              source: rawSource,
              label: cfg.label,
              shortLabel: cfg.shortLabel,
              score,
              rawValue,
              displayValue,
              weight: cfg.weight,
            });
          }
        }
      }
    } catch {
      /* Falha de rede ou CORS na MDBList -> segue para fallback OMDb */
    }

    // Se o TMDb local já tem nota válida e a MDBList não trouxe `tmdb`, complementa a fonte `tmdb`
    if (!mdbItemsMap.has('tmdb') && tmdbVoteAverage && tmdbVoteAverage > 0) {
      const tmdbScore = Math.max(0, Math.min(100, Math.round(tmdbVoteAverage * 10)));
      const cfg = SOURCE_CONFIG.tmdb;
      mdbItemsMap.set('tmdb', {
        source: 'tmdb',
        label: cfg.label,
        shortLabel: cfg.shortLabel,
        score: tmdbScore,
        rawValue: Number(tmdbVoteAverage.toFixed(1)),
        displayValue: `${tmdbScore}%`,
        weight: cfg.weight,
      });
    }

    // Verifica se a MDBList retornou ao menos uma fonte externa (além do próprio TMDb)
    const hasExternalFromMdbList = Array.from(mdbItemsMap.keys()).some((k) => k !== 'tmdb');
    if (hasExternalFromMdbList) {
      const payload = buildPayloadFromSources(
        tmdbId,
        mediaType,
        Array.from(mdbItemsMap.values()),
        'mdblist',
      );
      if (payload) {
        saveCachedUnifiedRatings(tmdbId, isTv, payload);
        return payload;
      }
    }

    // 2. Fallback OMDb API (se MDBList falhou ou veio vazia de notas externas)
    if (resolvedImdbId && /^tt\d+/i.test(resolvedImdbId)) {
      try {
        const omdbUrl = `https://www.omdbapi.com/?i=${encodeURIComponent(
          resolvedImdbId,
        )}&apikey=${encodeURIComponent(OMDB_API_KEY)}`;
        const res = await fetch(omdbUrl);
        if (res.ok) {
          const omdb = (await res.json()) as OMDbResponse;
          if (omdb && omdb.Response !== 'False') {
            const omdbItemsMap = new Map<RatingPlatformSource, PlatformRatingItem>(mdbItemsMap);

            // IMDb (imdbRating * 10)
            if (omdb.imdbRating && omdb.imdbRating !== 'N/A') {
              const imdbVal = parseFloat(omdb.imdbRating);
              if (!Number.isNaN(imdbVal) && imdbVal > 0) {
                const score = Math.max(0, Math.min(100, Math.round(imdbVal * 10)));
                const cfg = SOURCE_CONFIG.imdb;
                omdbItemsMap.set('imdb', {
                  source: 'imdb',
                  label: cfg.label,
                  shortLabel: cfg.shortLabel,
                  score,
                  rawValue: imdbVal,
                  displayValue: imdbVal.toFixed(1),
                  weight: cfg.weight,
                });
              }
            }

            // Metacritic (Metascore)
            if (omdb.Metascore && omdb.Metascore !== 'N/A') {
              const metaVal = parseInt(omdb.Metascore, 10);
              if (!Number.isNaN(metaVal) && metaVal > 0) {
                const score = Math.max(0, Math.min(100, metaVal));
                const cfg = SOURCE_CONFIG.metacritic;
                omdbItemsMap.set('metacritic', {
                  source: 'metacritic',
                  label: cfg.label,
                  shortLabel: cfg.shortLabel,
                  score,
                  rawValue: metaVal,
                  displayValue: String(metaVal),
                  weight: cfg.weight,
                });
              }
            }

            // Rotten Tomatoes (Ratings array)
            if (Array.isArray(omdb.Ratings)) {
              for (const r of omdb.Ratings) {
                const srcName = (r.Source || '').toLowerCase();
                const valStr = (r.Value || '').trim();
                if (srcName.includes('rotten tomatoes') && valStr) {
                  const rtVal = parseInt(valStr.replace('%', ''), 10);
                  if (!Number.isNaN(rtVal) && rtVal > 0) {
                    const score = Math.max(0, Math.min(100, rtVal));
                    const cfg = SOURCE_CONFIG.tomatoes;
                    omdbItemsMap.set('tomatoes', {
                      source: 'tomatoes',
                      label: cfg.label,
                      shortLabel: cfg.shortLabel,
                      score,
                      rawValue: `${rtVal}%`,
                      displayValue: `${rtVal}%`,
                      weight: cfg.weight,
                    });
                  }
                } else if (
                  srcName.includes('metacritic') &&
                  !omdbItemsMap.has('metacritic') &&
                  valStr
                ) {
                  const metaVal = parseInt(valStr.split('/')[0], 10);
                  if (!Number.isNaN(metaVal) && metaVal > 0) {
                    const score = Math.max(0, Math.min(100, metaVal));
                    const cfg = SOURCE_CONFIG.metacritic;
                    omdbItemsMap.set('metacritic', {
                      source: 'metacritic',
                      label: cfg.label,
                      shortLabel: cfg.shortLabel,
                      score,
                      rawValue: metaVal,
                      displayValue: String(metaVal),
                      weight: cfg.weight,
                    });
                  }
                }
              }
            }

            const hasExternalFromOmdb = Array.from(omdbItemsMap.keys()).some((k) => k !== 'tmdb');
            if (hasExternalFromOmdb) {
              const payload = buildPayloadFromSources(
                tmdbId,
                mediaType,
                Array.from(omdbItemsMap.values()),
                'omdb',
              );
              if (payload) {
                saveCachedUnifiedRatings(tmdbId, isTv, payload);
                return payload;
              }
            }
          }
        }
      } catch {
        /* Falha na OMDb -> usa contingência TMDb se disponível */
      }
    }

    // 3. Contingência caso apenas TMDb esteja disponível
    if (mdbItemsMap.size > 0) {
      return buildPayloadFromSources(
        tmdbId,
        mediaType,
        Array.from(mdbItemsMap.values()),
        'tmdb',
      );
    }

    return null;
  })().finally(() => {
    inFlightRequests.delete(cacheKey);
  });

  inFlightRequests.set(cacheKey, task);
  return task;
}
