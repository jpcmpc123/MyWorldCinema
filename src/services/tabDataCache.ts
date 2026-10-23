import { tmdb, getTmdbLanguage, type TMDBMovie } from './tmdb';
import { markPosterUrlLoaded } from '../components/PosterCard';

export interface HubSectionsData {
  popular: TMDBMovie[];
  highestRated: TMDBMovie[];
  mostWatched: TMDBMovie[];
  mostAnticipated: TMDBMovie[];
  timestamp: number;
  lang?: string;
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

function prewarmHubPosters(data: Omit<HubSectionsData, 'timestamp'>, limitPerSection = 6): void {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return;
  const isMobile = window.innerWidth < 640;
  const size = isMobile ? 'w185' : 'w342';
  const lists = [data.popular, data.highestRated, data.mostWatched, data.mostAnticipated];
  const seen = new Set<string>();

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list.slice(0, limitPerSection)) {
      if (!item?.poster_path) continue;
      const url = tmdb.getImageUrl(item.poster_path, size);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        img.onload = null;
        img.onerror = null;
        markPosterUrlLoaded(url);
      };
      img.onerror = () => {
        img.onload = null;
        img.onerror = null;
      };
      img.src = url;
      if (img.complete && img.naturalWidth > 0) {
        img.onload = null;
        img.onerror = null;
        markPosterUrlLoaded(url);
      }
    }
  }
}

function readStorage(key: string): HubSectionsData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HubSectionsData;
    const currentLang = getTmdbLanguage();
    if (
      Date.now() - parsed.timestamp > CACHE_TTL_MS ||
      (parsed.lang && parsed.lang !== currentLang)
    ) {
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
  const persist = () => {
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
  };
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(persist, { timeout: 1500 });
  } else {
    window.setTimeout(persist, 100);
  }
}

export const tabDataCache = {
  getFilmsHub(): HubSectionsData | null {
    const currentLang = getTmdbLanguage();
    if (
      memoryFilmsHub &&
      Date.now() - memoryFilmsHub.timestamp < CACHE_TTL_MS &&
      (!memoryFilmsHub.lang || memoryFilmsHub.lang === currentLang)
    ) {
      return memoryFilmsHub;
    }
    const fromStorage = readStorage(FILMS_KEY);
    if (fromStorage) {
      memoryFilmsHub = fromStorage;
      prewarmHubPosters(fromStorage, 6);
      return fromStorage;
    }
    return null;
  },

  setFilmsHub(data: Omit<HubSectionsData, 'timestamp'>): void {
    const entry: HubSectionsData = {
      ...data,
      timestamp: Date.now(),
      lang: getTmdbLanguage(),
    };
    memoryFilmsHub = entry;
    writeStorage(FILMS_KEY, entry);
    prewarmHubPosters(entry, 8);
  },

  getSeriesHub(): HubSectionsData | null {
    const currentLang = getTmdbLanguage();
    if (
      memorySeriesHub &&
      Date.now() - memorySeriesHub.timestamp < CACHE_TTL_MS &&
      (!memorySeriesHub.lang || memorySeriesHub.lang === currentLang)
    ) {
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
      lang: getTmdbLanguage(),
    };
    memorySeriesHub = entry;
    writeStorage(SERIES_KEY, entry);
    prewarmHubPosters(entry, 6);
  },

  invalidateAll(): void {
    memoryFilmsHub = null;
    memorySeriesHub = null;
    tmdb.clearRuntimeCaches();
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(FILMS_KEY);
        window.sessionStorage.removeItem(SERIES_KEY);
        window.localStorage.removeItem(FILMS_KEY);
        window.localStorage.removeItem(SERIES_KEY);
      } catch {
        /* ignore */
      }
    }
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


