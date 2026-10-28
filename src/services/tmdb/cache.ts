import type {
  TMDBCollectionDetails,
  TMDBMovie,
  TMDBMovieDetails,
  TMDBPersonDetails,
  SimilarSourceProfile,
  HubSectionsResult,
} from './types';

export const TMDB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
export const TMDB_DETAILS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos para detalhes na sessão

/**
 * Cache genérico em memória com limite de entradas (LRU) e expiração (TTL).
 * Ao ler uma chave válida, move-a para o final da fila para manter os itens
 * mais acessados sempre quentes na memória.
 */
export class BoundedTTLCache<K, V> {
  private readonly store = new Map<K, { data: V; expires: number }>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(maxEntries: number, defaultTtlMs: number = TMDB_CACHE_TTL_MS) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: K): V | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expires <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    // Refresh LRU order
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data;
  }

  set(key: K, data: V, ttlMs: number = this.defaultTtlMs): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const now = Date.now();
      let evicted = false;
      for (const [k, v] of this.store) {
        if (v.expires <= now) {
          this.store.delete(k);
          evicted = true;
          if (this.store.size < this.maxEntries) break;
        }
      }
      if (!evicted || this.store.size >= this.maxEntries) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey !== undefined) {
          this.store.delete(oldestKey);
        }
      }
    }
    this.store.set(key, { data, expires: Date.now() + ttlMs });
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Mapa limitado (LRU) sem TTL para metadados determinísticos na sessão.
 */
export class BoundedLRUMap<K, V> {
  private readonly store = new Map<K, V>();
  private readonly maxEntries: number;

  constructor(maxEntries: number) {
    this.maxEntries = maxEntries;
  }

  get(key: K): V | undefined {
    const val = this.store.get(key);
    if (val === undefined) return undefined;
    this.store.delete(key);
    this.store.set(key, val);
    return val;
  }

  set(key: K, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, value);
  }

  clear(): void {
    this.store.clear();
  }
}

// Instâncias globais de cache e deduplicação in-flight
export const tmdbHttpCache = new BoundedTTLCache<string, unknown>(1500, TMDB_CACHE_TTL_MS);
export const tmdbInflight = new Map<string, Promise<unknown>>();

export const mediaDetailsCache = new BoundedTTLCache<string, TMDBMovieDetails>(
  200,
  TMDB_DETAILS_CACHE_TTL_MS,
);
export const personDetailsCache = new BoundedTTLCache<string, TMDBPersonDetails>(
  100,
  TMDB_DETAILS_CACHE_TTL_MS,
);
export const collectionDetailsCache = new BoundedTTLCache<string, TMDBCollectionDetails>(
  80,
  TMDB_DETAILS_CACHE_TTL_MS,
);

export const searchEnrichCache = new BoundedLRUMap<
  string,
  { directors: string[]; alternativeTitles: string[] }
>(400);

export const similarProfileCache = new BoundedLRUMap<string, SimilarSourceProfile>(80);

export const popularWeekPoolCache = new BoundedTTLCache<string, TMDBMovie[]>(30, TMDB_CACHE_TTL_MS);
export const popularWeekInFlight = new Map<string, Promise<TMDBMovie[]>>();

export const anticipatedPoolCache = new BoundedTTLCache<string, TMDBMovie[]>(20, TMDB_CACHE_TTL_MS);
export const movieHasPastReleaseCache = new BoundedLRUMap<number, boolean>(600);

let filmsHubInFlight: Promise<HubSectionsResult> | null = null;
let seriesHubInFlight: Promise<HubSectionsResult> | null = null;

export function getFilmsHubInFlight(): Promise<HubSectionsResult> | null {
  return filmsHubInFlight;
}
export function setFilmsHubInFlight(promise: Promise<HubSectionsResult> | null): void {
  filmsHubInFlight = promise;
}

export function getSeriesHubInFlight(): Promise<HubSectionsResult> | null {
  return seriesHubInFlight;
}
export function setSeriesHubInFlight(promise: Promise<HubSectionsResult> | null): void {
  seriesHubInFlight = promise;
}

export function clearAllTmdbRuntimeCaches(): void {
  popularWeekPoolCache.clear();
  popularWeekInFlight.clear();
  anticipatedPoolCache.clear();
  filmsHubInFlight = null;
  seriesHubInFlight = null;
  mediaDetailsCache.clear();
  personDetailsCache.clear();
  collectionDetailsCache.clear();
  searchEnrichCache.clear();
  similarProfileCache.clear();
}
