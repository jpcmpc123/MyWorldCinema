import { tmdb, type TMDBMovie } from './tmdb';

export interface HubSectionsData {
  popular: TMDBMovie[];
  highestRated: TMDBMovie[];
  mostWatched: TMDBMovie[];
  mostAnticipated: TMDBMovie[];
  timestamp: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

// 1. Cache em Memória RAM (acesso síncrono e instantâneo a 0ms)
let memoryFilmsHub: HubSectionsData | null = null;
let memorySeriesHub: HubSectionsData | null = null;

const FILMS_KEY = 'mw_cache_films_hub_v6';
const SERIES_KEY = 'mw_cache_series_hub_v6';

if (typeof window !== 'undefined') {
  try {
    for (const k of [
      'mw_cache_films_hub_v2',
      'mw_cache_series_hub_v2',
      'mw_cache_films_hub_v5',
      'mw_cache_series_hub_v5',
    ]) {
      window.sessionStorage.removeItem(k);
      window.localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

function readStorage(key: string): HubSectionsData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HubSectionsData;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(key: string, data: HubSectionsData): void {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(data);
  try {
    window.sessionStorage.setItem(key, serialized);
  } catch {
    /* sessionStorage cheio ou desabilitado */
  }
  try {
    window.localStorage.setItem(key, serialized);
  } catch {
    /* localStorage cheio ou desabilitado */
  }
}

export const tabDataCache = {
  getFilmsHub(): HubSectionsData | null {
    if (memoryFilmsHub && Date.now() - memoryFilmsHub.timestamp < CACHE_TTL_MS) {
      return memoryFilmsHub;
    }
    const fromStorage = readStorage(FILMS_KEY);
    if (fromStorage) {
      memoryFilmsHub = fromStorage;
      return fromStorage;
    }
    return null;
  },

  setFilmsHub(data: Omit<HubSectionsData, 'timestamp'>): void {
    const entry: HubSectionsData = {
      ...data,
      timestamp: Date.now(),
    };
    memoryFilmsHub = entry;
    writeStorage(FILMS_KEY, entry);
  },

  getSeriesHub(): HubSectionsData | null {
    if (memorySeriesHub && Date.now() - memorySeriesHub.timestamp < CACHE_TTL_MS) {
      return memorySeriesHub;
    }
    const fromStorage = readStorage(SERIES_KEY);
    if (fromStorage) {
      memorySeriesHub = fromStorage;
      return fromStorage;
    }
    return null;
  },

  setSeriesHub(data: Omit<HubSectionsData, 'timestamp'>): void {
    const entry: HubSectionsData = {
      ...data,
      timestamp: Date.now(),
    };
    memorySeriesHub = entry;
    writeStorage(SERIES_KEY, entry);
  },

  /**
   * Pré-carrega assincronamente as vitrines das abas principais
   * priorizando Filmes primeiro para não disputar conexões na abertura.
   */
  async preloadAll(): Promise<void> {
    if (!tabDataCache.getFilmsHub()) {
      try {
        const hub = await tmdb.getFilmsHubSections();
        tabDataCache.setFilmsHub(hub);
      } catch (err) {
        console.warn('[tabDataCache] Falha ao pré-carregar filmes:', err);
      }
    }
    if (!tabDataCache.getSeriesHub()) {
      try {
        const hub = await tmdb.getSeriesHubSections();
        tabDataCache.setSeriesHub(hub);
      } catch (err) {
        console.warn('[tabDataCache] Falha ao pré-carregar séries:', err);
      }
    }
  },
};

