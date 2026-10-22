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
  const listeners = new Map<number, Set<() => void>>();
  const snapshots = new Map<number, MovieSnapshot>();

  const compute = (id: number): MovieSnapshot => {
    if (!state) return EMPTY_SNAPSHOT;
    return {
      watched: state.watchedIds.includes(id),
      liked: state.likedIds.includes(id),
      inWatchlist: state.watchlistIds.includes(id),
      rating: state.ratings[id],
      overridePoster: state.overrides[id]?.poster || null,
    };
  };

  return {
    setState(next) {
      state = next;
    },

    flush() {
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
