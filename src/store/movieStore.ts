/**
 * Armazenamento por filme (assistido / curtido / nota / pôster personalizado).
 *
 * Problema que resolve: o AppContext muda de identidade a cada ação do usuário,
 * e todo PosterCard que chamava useApp() re-renderizava, mesmo sem ter mudado.
 *
 * Aqui cada cartão assina SÓ o próprio filme (useSyncExternalStore). Ao mudar o
 * estado, o provider recalcula o snapshot de cada filme assinado e notifica apenas
 * os que realmente mudaram. Um like re-renderiza um cartão, não a grade inteira.
 */

export interface MovieState {
  watchedIds: number[];
  likedIds: number[];
  watchlistIds: number[];
  ratings: Record<number, number>;
  overrides: Record<number, { poster?: string; backdrop?: string }>;
}

export interface MovieSnapshot {
  watched: boolean;
  liked: boolean;
  inWatchlist: boolean;
  rating: number | undefined;
  overridePoster: string | null;
}

const EMPTY_SNAPSHOT: MovieSnapshot = {
  watched: false,
  liked: false,
  inWatchlist: false,
  rating: undefined,
  overridePoster: null,
};

export interface MovieStore {
  /** Guarda o estado mais recente (chamado na renderização do provider). */
  setState(next: MovieState): void;
  /** Recalcula os filmes assinados e notifica só os que mudaram (layout effect). */
  flush(): void;
  /** Snapshot estável do filme: a mesma referência enquanto nada mudar. */
  get(id: number): MovieSnapshot;
  /** Consultas O(1) diretas nos Sets sincronizados em memória. */
  hasWatched(id: number): boolean;
  hasLiked(id: number): boolean;
  hasInWatchlist(id: number): boolean;
  subscribe(id: number, listener: () => void): () => void;
}

function sameSnapshot(a: MovieSnapshot, b: MovieSnapshot): boolean {
  return (
    a.watched === b.watched &&
    a.liked === b.liked &&
    a.inWatchlist === b.inWatchlist &&
    a.rating === b.rating &&
    a.overridePoster === b.overridePoster
  );
}

export function createMovieStore(): MovieStore {
  let state: MovieState | null = null;
  let watchedSet = new Set<number>();
  let likedSet = new Set<number>();
  let watchlistSet = new Set<number>();
  const listeners = new Map<number, Set<() => void>>();
  const snapshots = new Map<number, MovieSnapshot>();

  const compute = (id: number): MovieSnapshot => {
    if (!state) return EMPTY_SNAPSHOT;
    return {
      watched: watchedSet.has(id),
      liked: likedSet.has(id),
      inWatchlist: watchlistSet.has(id),
      rating: state.ratings[id],
      overridePoster: state.overrides[id]?.poster || null,
    };
  };

  return {
    setState(next) {
      if (!state || state.watchedIds !== next.watchedIds) {
        watchedSet = new Set(next.watchedIds);
      }
      if (!state || state.likedIds !== next.likedIds) {
        likedSet = new Set(next.likedIds);
      }
      if (!state || state.watchlistIds !== next.watchlistIds) {
        watchlistSet = new Set(next.watchlistIds);
      }
      state = next;
    },

    flush() {
      // Limpa snapshots órfãos (sem inscritos) se o cache passar de 600 filmes
      if (snapshots.size > 600) {
        for (const id of snapshots.keys()) {
          if (!listeners.has(id)) {
            snapshots.delete(id);
            if (snapshots.size <= 400) break;
          }
        }
      }
      // Atualiza TODO snapshot em cache, não só os assinados: um cartão que monta
      // depois lê o cache e não pode receber um valor antigo.
      const ids = new Set<number>([...snapshots.keys(), ...listeners.keys()]);
      ids.forEach((id) => {
        const fresh = compute(id);
        const previous = snapshots.get(id);
        if (previous && sameSnapshot(previous, fresh)) return;
        snapshots.set(id, fresh);
        listeners.get(id)?.forEach((notify) => notify());
      });
    },

    get(id) {
      let snap = snapshots.get(id);
      if (!snap) {
        snap = compute(id);
        snapshots.set(id, snap);
      }
      return snap;
    },

    hasWatched(id) {
      return watchedSet.has(id);
    },

    hasLiked(id) {
      return likedSet.has(id);
    },

    hasInWatchlist(id) {
      return watchlistSet.has(id);
    },

    subscribe(id, listener) {
      let subs = listeners.get(id);
      if (!subs) {
        subs = new Set();
        listeners.set(id, subs);
      }
      subs.add(listener);
      return () => {
        const current = listeners.get(id);
        if (!current) return;
        current.delete(listener);
        // O snapshot em cache NÃO é apagado aqui: apagá-lo faria a próxima leitura
        // devolver um objeto novo e provocar re-render em ciclo.
        if (current.size === 0) listeners.delete(id);
      };
    },
  };
}
