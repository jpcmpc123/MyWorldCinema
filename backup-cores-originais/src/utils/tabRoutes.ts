/**
 * Rotas que exibem a barra de abas principal no mobile
 * (FILMES / SÉRIES / CRÍTICAS / LISTAS).
 *
 * Fonte única da verdade: usada pelo Header (que desenha a faixa de abas) e
 * pelo App (que escolhe a animação de entrada do conteúdo da aba), para que os
 * dois nunca saiam de sincronia.
 */
const MAIN_TAB_ROUTE = /^\/(films|series|tv|lists?|reviews)?\/?$/;

export function isMainTabRoute(pathname: string): boolean {
  return MAIN_TAB_ROUTE.test(pathname);
}

/**
 * Ordem canônica das abas na ESTEIRA horizontal (ViewPager) do app mobile.
 * O índice é a posição do painel no trilho: translateX(-índice * 100%).
 * Precisa estar na MESMA ordem da faixa de abas do Header
 * (FILMES → SÉRIES → CRÍTICAS → LISTAS), senão o conteúdo desliza para o lado
 * errado em relação ao dedo/clique.
 */
export const TAB_PANEL_PATHS = ['/', '/series', '/reviews', '/lists'] as const;

/** Índice da aba na esteira (-1 = a rota atual não é uma aba do ViewPager). */
export function tabPanelIndex(pathname: string): number {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalized === '/films') return 0;
  if (normalized === '/tv') return 1;
  if (normalized === '/list') return 3;
  return TAB_PANEL_PATHS.indexOf(normalized as (typeof TAB_PANEL_PATHS)[number]);
}

/**
 * Rotas da área de PERFIL DO USUÁRIO no mobile:
 *   PERFIL (/:username ou /profile)
 *   DIÁRIO (/:username/diary ou /diary)
 *   LISTAS (/:username/lists)
 *   WATCHLIST (/:username/watchlist ou /watchlist)
 */
export type ProfileTabKey = 'profile' | 'diary' | 'lists' | 'watchlist';

export const PROFILE_TAB_KEYS: readonly ProfileTabKey[] = [
  'profile',
  'diary',
  'lists',
  'watchlist',
] as const;

const RESERVED_SINGLE_SEGMENTS = new Set([
  'films',
  'series',
  'tv',
  'lists',
  'list',
  'reviews',
  'activity',
  'search',
  'browse',
  'actor',
  'film',
  'settings',
  'signin',
  'signup',
]);

const RESERVED_TWO_SEGMENT_PARENTS = new Set([
  'film',
  'tv',
  'actor',
  'list',
  'browse',
  'films',
  'series',
]);

export interface ProfileTabRouteInfo {
  username: string;
  tab: ProfileTabKey;
  index: number;
  paths: readonly [string, string, string, string];
}

export function getProfileTabPaths(username: string): readonly [string, string, string, string] {
  const encoded = encodeURIComponent(username);
  return [
    `/${encoded}`,
    `/${encoded}/diary`,
    `/${encoded}/lists`,
    `/${encoded}/watchlist`,
  ] as const;
}

export function parseProfileTabRoute(
  pathname: string,
  fallbackUsername = 'user',
): ProfileTabRouteInfo | null {
  if (isMainTabRoute(pathname)) return null;
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length === 1) {
    const seg = segs[0];
    if (RESERVED_SINGLE_SEGMENTS.has(seg)) return null;
    if (seg === 'profile' || seg === 'diary' || seg === 'watchlist') {
      const tab: ProfileTabKey = seg;
      const paths = getProfileTabPaths(fallbackUsername);
      return {
        username: fallbackUsername,
        tab,
        index: PROFILE_TAB_KEYS.indexOf(tab),
        paths,
      };
    }
    const username = decodeURIComponent(seg);
    const paths = getProfileTabPaths(username);
    return {
      username,
      tab: 'profile',
      index: 0,
      paths,
    };
  }

  if (segs.length === 2) {
    const [first, second] = segs;
    if (RESERVED_TWO_SEGMENT_PARENTS.has(first)) return null;
    if (second === 'diary' || second === 'lists' || second === 'watchlist') {
      const username =
        first === 'profile' || first === 'diary' || first === 'watchlist'
          ? fallbackUsername
          : decodeURIComponent(first);
      const tab: ProfileTabKey = second;
      const paths = getProfileTabPaths(username);
      return {
        username,
        tab,
        index: PROFILE_TAB_KEYS.indexOf(tab),
        paths,
      };
    }
  }

  return null;
}

