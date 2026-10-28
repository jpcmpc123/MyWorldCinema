// Helper para gravar no localStorage fora do caminho crítico de animação/toque
const pendingWrites = new Map<string, unknown>();
let storageIdleHandle: number | null = null;

export function scheduleStorageWrite(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  pendingWrites.set(key, value);
  if (storageIdleHandle !== null) return;
  const flush = () => {
    storageIdleHandle = null;
    pendingWrites.forEach((val, k) => {
      try {
        localStorage.setItem(k, JSON.stringify(val));
      } catch {
        // Ignora quota exceeded em modo privado/cheio
      }
    });
    pendingWrites.clear();
  };
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === 'function') {
    storageIdleHandle = win.requestIdleCallback(flush, { timeout: 1000 });
  } else {
    storageIdleHandle = window.setTimeout(flush, 120);
  }
}

export function readLocalJson<T>(
  key: string,
  fallback: T,
  validate?: (val: unknown) => val is T,
): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed: unknown = JSON.parse(saved);
    if (validate && !validate(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

const USER_STORAGE_KEYS = [
  'lb_movie_overrides',
  'lb_user',
  'lb_logs',
  'lb_watched',
  'lb_likes',
  'lb_ratings',
  'lb_top4',
  'lb_lists',
  'lb_reviews',
  'lb_watchlist',
] as const;

export function clearAllGuestStorageKeys(): void {
  if (typeof window === 'undefined') return;
  for (const key of USER_STORAGE_KEYS) {
    pendingWrites.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
