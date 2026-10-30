import type { TMDBImage } from './types';

/**
 * Resolução típica de geradores de imagem por IA (Midjourney, SDXL, Flux, DALL-E 3, Ideogram).
 * Pôsteres oficiais no TMDB seguem múltiplos estritos de 500/100 (1000x1500, 2000x3000, 1400x2100, 500x750),
 * enquanto modelos de difusão geram em múltiplos de 64/128 (ex.: 1024x1536, 896x1344, 768x1152).
 */
const AI_GENERATOR_DIMENSIONS = new Set<string>([
  '1024x1536',
  '1536x2304',
  '896x1344',
  '832x1216',
  '768x1152',
  '640x960',
  '512x768',
  '1024x1792',
  '1152x1728',
  '1344x2016',
  '1536x1024',
  '1792x1024',
  '1344x896',
  '1344x768',
  '1216x832',
  '1152x768',
]);

export const CANONICAL_BACKDROP_BY_ID = new Map<number, string>();

export const BLOCKED_FAN_AI_IMAGE_PATHS = new Set<string>();

/**
 * Domínios e padrões de CDNs conhecidas de geração de imagem por IA.
 * Usado para bloquear URLs externas coladas manualmente no seletor de pôster/backdrop.
 */
const AI_SERVICE_URL_PATTERNS: RegExp[] = [
  /cdn\.midjourney\.com/i,
  /midjourney/i,
  /oaidalleapiprodscus/i,
  /dalle/i,
  /civitai\.com/i,
  /lexica\.art/i,
  /playgroundai\.com/i,
  /playground\.com/i,
  /leonardo\.ai/i,
  /tensor\.art/i,
  /seaart\.ai/i,
  /ideogram\.ai/i,
  /pollinations\.ai/i,
  /replicate\.delivery/i,
  /fal\.media/i,
  /stability\.ai/i,
  /nightcafe\.studio/i,
  /bing\.com\/images\/create/i,
  /copilot\.microsoft\.com/i,
  /promptchan/i,
  /mage\.space/i,
  /krea\.ai/i,
];

export function isAiServiceUrl(url: string): boolean {
  const trimmed = (url || '').trim();
  if (!trimmed) return false;
  return AI_SERVICE_URL_PATTERNS.some((re) => re.test(trimmed));
}

export function isAiGeneratedDimension(width: number, height: number): boolean {
  if (!width || !height) return false;
  const key = `${width}x${height}`;
  if (AI_GENERATOR_DIMENSIONS.has(key)) return true;

  const isStandardStudioSize =
    (width === 1000 && height === 1500) ||
    (width === 2000 && height === 3000) ||
    (width === 1400 && height === 2100) ||
    (width === 1200 && height === 1800) ||
    (width === 680 && height === 1000) ||
    (width === 500 && height === 750) ||
    (width === 1920 && height === 1080) ||
    (width === 3840 && height === 2160) ||
    (width === 2560 && height === 1440) ||
    (width === 1280 && height === 720);

  if (isStandardStudioSize) return false;

  if (width % 64 === 0 && height % 64 === 0 && (width % 100 !== 0 || height % 100 !== 0)) {
    return true;
  }

  return false;
}

/**
 * No TMDB, a escala Bayesiana de imagens atribui `vote_average = 3.334` para uma imagem com 1 voto positivo,
 * e `vote_average < 3.0` (ex.: 2.54, 2.28, 1.75, 0.0) para imagens negativadas pela comunidade/moderadores.
 */
export function isDownvotedTmdbImage(img: TMDBImage): boolean {
  const votes = img.vote_count || 0;
  const avg = img.vote_average || 0;
  if (votes >= 1 && avg < 3.0) {
    return true;
  }
  return false;
}

/**
 * Detecta se um pôster do TMDB tem alta probabilidade de ser gerado por IA ou montagem amadora.
 */
export function isSuspectedAiPoster(
  img: TMDBImage,
  hasVerifiedCommunityPosters: boolean,
): boolean {
  if (!img?.file_path || BLOCKED_FAN_AI_IMAGE_PATHS.has(img.file_path)) {
    return true;
  }

  const votes = img.vote_count || 0;
  const avg = img.vote_average || 0;
  const w = img.width || 0;
  const h = img.height || 0;
  const ratio = img.aspect_ratio || (h > 0 ? w / h : 0);

  if (isDownvotedTmdbImage(img)) {
    return true;
  }

  if (isAiGeneratedDimension(w, h) && votes <= 4) {
    return true;
  }

  if (ratio > 0 && (ratio < 0.63 || ratio > 0.71)) {
    return true;
  }

  if (hasVerifiedCommunityPosters) {
    if (votes === 0) {
      return true;
    }
    if (!img.iso_639_1 && votes <= 2 && avg < 5.2) {
      return true;
    }
  }

  return false;
}

/**
 * Pontua um candidato a pôster combinando Bayesian Rating (votos + média),
 * fidelidade ao pôster teatral oficial (idioma original / inglês com créditos)
 * e resolução oficial de estúdio (2000x3000 / 1000x1500).
 */
export function scorePosterCandidate(
  img: TMDBImage,
  options?: {
    originalLanguage?: string;
    uiLanguage?: string;
  },
): number {
  if (BLOCKED_FAN_AI_IMAGE_PATHS.has(img.file_path)) return -999;

  const votes = Math.max(0, img.vote_count || 0);
  const avg = img.vote_average || 0;
  const w = img.width || 0;
  const h = img.height || 0;
  const ratio = img.aspect_ratio || (h > 0 ? w / h : 2 / 3);
  const lang = img.iso_639_1 ?? null;
  const origLang = (options?.originalLanguage || 'en').toLowerCase();

  const m = 3;
  const C = 5.0;
  const effectiveR = votes > 0 && avg > 0 ? avg : C;
  const bayesian = (votes / (votes + m)) * effectiveR + (m / (votes + m)) * C;
  const voteConsensusBoost = Math.log10(votes + 1) * 2.2;

  let langBonus = 0;
  if (lang === origLang || lang === 'en') {
    langBonus = votes > 0 ? 2.0 : 1.0;
  } else if (lang === 'pt') {
    if (votes >= 5 && avg >= 5.5) {
      langBonus = 1.4;
    } else {
      langBonus = -2.0;
    }
  } else if (lang === null) {
    langBonus = -2.25;
  }

  let resBonus = 0;
  if ((w === 2000 && h === 3000) || (w === 1000 && h === 1500)) {
    resBonus += 0.55;
  } else if (w >= 1000 && h >= 1500) {
    resBonus += 0.25;
  } else if (w < 680 || h < 1000) {
    resBonus -= 0.8;
  }

  if (Math.abs(ratio - 2 / 3) <= 0.006) {
    resBonus += 0.25;
  }

  if (isAiGeneratedDimension(w, h)) {
    resBonus -= 3.5;
  }

  return bayesian + voteConsensusBoost + langBonus + resBonus;
}

/**
 * Filtra pôsteres suspeitos de IA/baixa qualidade e ordena do melhor para o pior.
 */
export function filterAndRankPosters(
  posters: TMDBImage[] | undefined | null,
  options?: {
    originalLanguage?: string;
    uiLanguage?: string;
  },
): TMDBImage[] {
  if (!Array.isArray(posters) || posters.length === 0) return [];

  const hasVerifiedCommunityPosters = posters.some(
    (p) =>
      !BLOCKED_FAN_AI_IMAGE_PATHS.has(p.file_path) &&
      (p.vote_count || 0) >= 2 &&
      (p.vote_average || 0) >= 5.0 &&
      !isAiGeneratedDimension(p.width, p.height),
  );

  let filtered = posters.filter(
    (p) =>
      Boolean(p?.file_path) &&
      (p.width || 0) >= 500 &&
      (p.height || 0) >= 750 &&
      !isSuspectedAiPoster(p, hasVerifiedCommunityPosters),
  );

  if (filtered.length === 0) {
    filtered = posters.filter(
      (p) =>
        Boolean(p?.file_path) &&
        !BLOCKED_FAN_AI_IMAGE_PATHS.has(p.file_path) &&
        !isAiGeneratedDimension(p.width, p.height) &&
        !isDownvotedTmdbImage(p),
    );
  }

  if (filtered.length === 0) {
    filtered = posters.filter((p) => Boolean(p?.file_path));
  }

  return [...filtered].sort(
    (a, b) => scorePosterCandidate(b, options) - scorePosterCandidate(a, options),
  );
}

/**
 * Filtra e ordena Backdrops (16:9), removendo colagens de fãs/IA/negativados
 * e priorizando consenso da comunidade (maior volume de votos) + resolução Full HD/4K.
 */
export function filterAndRankBackdrops(
  backdrops: TMDBImage[] | undefined | null,
): TMDBImage[] {
  if (!Array.isArray(backdrops) || backdrops.length === 0) return [];

  const hasVotedFullHd = backdrops.some(
    (b) =>
      Boolean(b?.file_path) &&
      !BLOCKED_FAN_AI_IMAGE_PATHS.has(b.file_path) &&
      !isDownvotedTmdbImage(b) &&
      (b.vote_count || 0) >= 1 &&
      (b.width || 0) >= 1920 &&
      (b.height || 0) >= 1080 &&
      !isAiGeneratedDimension(b.width, b.height),
  );

  let filtered = backdrops.filter((b) => {
    if (!b?.file_path) return false;
    if (BLOCKED_FAN_AI_IMAGE_PATHS.has(b.file_path)) return false;

    const votes = b.vote_count || 0;
    const avg = b.vote_average || 0;
    const w = b.width || 0;
    const h = b.height || 0;
    const ratio = b.aspect_ratio || (h > 0 ? w / h : 16 / 9);

    if (isDownvotedTmdbImage(b)) return false;
    if (isAiGeneratedDimension(w, h) && votes <= 4) return false;
    if (b.iso_639_1 === 'pt' && (votes < 5 || avg < 5.5)) return false;
    if (hasVotedFullHd && (w < 1920 || h < 1080)) return false;
    if (w < 1280 || h < 720) return false;
    if (ratio < 1.7 || ratio > 1.85) return false;
    return true;
  });

  if (filtered.length === 0) {
    filtered = backdrops.filter(
      (b) =>
        Boolean(b?.file_path) &&
        !BLOCKED_FAN_AI_IMAGE_PATHS.has(b.file_path) &&
        !isDownvotedTmdbImage(b) &&
        !isAiGeneratedDimension(b.width, b.height),
    );
  }
  if (filtered.length === 0) {
    filtered = backdrops.filter((b) => Boolean(b?.file_path));
  }

  const maxVotes = filtered.reduce((max, b) => Math.max(max, b.vote_count || 0), 0);

  const scoreBackdrop = (b: TMDBImage): number => {
    if (BLOCKED_FAN_AI_IMAGE_PATHS.has(b.file_path)) return -999;

    const votes = Math.max(0, b.vote_count || 0);
    const avg = b.vote_average || 0;
    const w = b.width || 0;
    const h = b.height || 0;
    const m = 3;
    const C = 5.0;
    const effectiveR = votes > 0 && avg > 0 ? avg : C;
    const bayesian = (votes / (votes + m)) * effectiveR + (m / (votes + m)) * C;

    const voteBoost = Math.log10(votes + 1) * 3.4;
    const communityLeaderBonus = maxVotes >= 10 && votes === maxVotes && avg >= 3.8 ? 2.4 : 0;

    let resBonus = 0;
    if (w >= 3840 && h >= 2160) {
      resBonus = 1.65;
    } else if (w >= 2560 && h >= 1440) {
      resBonus = 1.55;
    } else if (w >= 1920 && h >= 1080) {
      resBonus = 1.5;
    } else {
      resBonus = -1.5;
    }

    let langBonus = 0;
    if (b.iso_639_1 === null) {
      langBonus = 0.45;
    } else if (b.iso_639_1 === 'en') {
      langBonus = 0.25;
    } else {
      langBonus = -2.0;
    }

    return bayesian + voteBoost + communityLeaderBonus + resBonus + langBonus;
  };

  return [...filtered].sort((a, b) => scoreBackdrop(b) - scoreBackdrop(a));
}

/**
 * Escolhe o poster_path de capa mantendo 100% de consistência entre todas as abas e a página de detalhes:
 * - Sempre preserva o poster_path oficial (en-US) se ele existir e não estiver na lista de bloqueio estrito,
 *   garantindo que o pôster exibido no card da aba nunca mude ao abrir a página de detalhes.
 */
export function pickBestPosterPath(
  posters: TMDBImage[] | undefined | null,
  fallbackPosterPath: string | null | undefined,
  options?: {
    originalLanguage?: string;
    uiLanguage?: string;
  },
): string | null {
  if (fallbackPosterPath && !BLOCKED_FAN_AI_IMAGE_PATHS.has(fallbackPosterPath)) {
    return fallbackPosterPath;
  }

  const ranked = filterAndRankPosters(posters, options);
  if (ranked.length > 0) {
    return ranked[0].file_path;
  }
  return fallbackPosterPath || null;
}

/**
 * Escolhe o melhor backdrop_path garantindo nitidez Full HD / 4K e bloqueando colagens de fãs/IA:
 * - Se o filme possuir um override canônico (ex.: Clayface, Hexed), usa ele diretamente.
 * - Preserva o backdrop oficial en-US do TMDB, substituindo apenas se estiver bloqueado, ausente,
 *   ou se houver na galeria um backdrop oficial com muito mais votos positivos da comunidade (>= 12 votos).
 * - Nunca substitui um backdrop válido por uploads com 0 votos.
 */
export function pickBestBackdropPath(
  backdrops: TMDBImage[] | undefined | null,
  fallbackBackdropPath: string | null | undefined,
  mediaId?: number,
): string | null {
  if (mediaId && CANONICAL_BACKDROP_BY_ID.has(mediaId)) {
    return CANONICAL_BACKDROP_BY_ID.get(mediaId) || null;
  }

  if (!Array.isArray(backdrops) || backdrops.length === 0) {
    if (fallbackBackdropPath && BLOCKED_FAN_AI_IMAGE_PATHS.has(fallbackBackdropPath)) {
      return null;
    }
    return fallbackBackdropPath || null;
  }

  const ranked = filterAndRankBackdrops(backdrops);
  const bestCandidate = ranked[0];

  if (fallbackBackdropPath && !BLOCKED_FAN_AI_IMAGE_PATHS.has(fallbackBackdropPath)) {
    const current = backdrops.find((b) => b.file_path === fallbackBackdropPath);
    if (!current) {
      return fallbackBackdropPath;
    }

    // Se existir um backdrop na galeria com muito mais votos da comunidade (ex.: 20 votos vs 7) e nota positiva,
    // prioriza o consenso da comunidade
    if (
      bestCandidate &&
      bestCandidate.file_path !== fallbackBackdropPath &&
      (bestCandidate.vote_count || 0) >= 12 &&
      (bestCandidate.vote_count || 0) >= (current.vote_count || 0) * 1.8 &&
      (bestCandidate.vote_average || 0) >= 3.8
    ) {
      return bestCandidate.file_path;
    }

    // Se o backdrop atual foi negativado (< 3.0) E o candidato substituto tem votos positivos (>= 1 voto e >= 3.3),
    // substitui pelo candidato votado; nunca troca por upload sem votos (vote_count === 0)
    if (
      isDownvotedTmdbImage(current) &&
      bestCandidate &&
      (bestCandidate.vote_count || 0) >= 1 &&
      (bestCandidate.vote_average || 0) >= 3.0
    ) {
      return bestCandidate.file_path;
    }

    return fallbackBackdropPath;
  }

  if (bestCandidate) {
    return bestCandidate.file_path;
  }
  return fallbackBackdropPath || null;
}
