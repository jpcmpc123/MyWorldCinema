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

const FILMS_KEY = 'mw_cache_films_hub_v2';
const SERIES_KEY = 'mw_cache_series_hub_v2';

function readSession(key: string): HubSectionsData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HubSectionsData;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(key: string, data: HubSectionsData): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* sessionStorage cheio ou desabilitado */
  }
}

export const tabDataCache = {
  getFilmsHub(): HubSectionsData | null {
    if (memoryFilmsHub && Date.now() - memoryFilmsHub.timestamp < CACHE_TTL_MS) {
      return memoryFilmsHub;
    }
    const fromSession = readSession(FILMS_KEY);
    if (fromSession) {
      memoryFilmsHub = fromSession;
      return fromSession;
    }
    return null;
  },

  setFilmsHub(data: Omit<HubSectionsData, 'timestamp'>): void {
    const entry: HubSectionsData = {
      ...data,
      timestamp: Date.now(),
    };
    memoryFilmsHub = entry;
    writeSession(FILMS_KEY, entry);
  },

  getSeriesHub(): HubSectionsData | null {
    if (memorySeriesHub && Date.now() - memorySeriesHub.timestamp < CACHE_TTL_MS) {
      return memorySeriesHub;
    }
    const fromSession = readSession(SERIES_KEY);
    if (fromSession) {
      memorySeriesHub = fromSession;
      return fromSession;
    }
    return null;
  },

  setSeriesHub(data: Omit<HubSectionsData, 'timestamp'>): void {
    const entry: HubSectionsData = {
      ...data,
      timestamp: Date.now(),
    };
    memorySeriesHub = entry;
    writeSession(SERIES_KEY, entry);
  },

  /**
   * Pré-carrega assincronamente as vitrines das abas principais
   * sem bloquear a renderização nem causar travamentos.
   */
  async preloadAll(): Promise<void> {
    const needFilms = !tabDataCache.getFilmsHub();
    const needSeries = !tabDataCache.getSeriesHub();

    const tasks: Promise<unknown>[] = [];
    if (needFilms) {
      tasks.push(
        tmdb.getFilmsHubSections().then((hub) => {
          tabDataCache.setFilmsHub(hub);
        }).catch((err) => {
          console.warn('[tabDataCache] Falha ao pré-carregar filmes:', err);
        })
      );
    }
    if (needSeries) {
      tasks.push(
        tmdb.getSeriesHubSections().then((hub) => {
          tabDataCache.setSeriesHub(hub);
        }).catch((err) => {
          console.warn('[tabDataCache] Falha ao pré-carregar séries:', err);
        })
      );
    }
    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  },
};
