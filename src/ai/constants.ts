import type { LayaDecisions } from './types';

export const TMDB_GENRE_MAP: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  scifi: 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

export const DECADE_YEAR_MAP: Record<string, [string, string]> = {
  classic: ['1920-01-01', '1979-12-31'],
  '80s': ['1980-01-01', '1989-12-31'],
  '90s': ['1990-01-01', '1999-12-31'],
  '2000s': ['2000-01-01', '2009-12-31'],
  modern: ['2010-01-01', '2026-12-31'],
};

export const ORIGIN_MAP: Record<string, Record<string, string>> = {
  japanese: { with_original_language: 'ja' },
  korean: { with_original_language: 'ko' },
  national: { with_origin_country: 'BR', with_original_language: 'pt' },
  french: { with_origin_country: 'FR', with_original_language: 'fr' },
  spanish: { with_origin_country: 'ES', with_original_language: 'es' },
  italian: { with_origin_country: 'IT', with_original_language: 'it' },
  british: { with_origin_country: 'GB', with_original_language: 'en' },
  german: { with_origin_country: 'DE', with_original_language: 'de' },
  european: { with_origin_country: 'FR|IT|ES|GB|DE' },
  hollywood: { with_original_language: 'en' },
  asian: { with_original_language: 'zh|cn|th|hi|id' },
};

export const GENRE_LABELS_PT: Record<string, string> = {
  action: 'Ação',
  adventure: 'Aventura',
  animation: 'Animação',
  comedy: 'Comédia',
  crime: 'Crime',
  documentary: 'Documentário',
  drama: 'Drama',
  family: 'Família',
  fantasy: 'Fantasia',
  history: 'História',
  horror: 'Terror',
  music: 'Música',
  mystery: 'Mistério',
  romance: 'Romance',
  scifi: 'Ficção Científica',
  thriller: 'Suspense',
  war: 'Guerra',
  western: 'Faroeste',
};

export const GENRE_LABELS_EN: Record<string, string> = {
  action: 'Action',
  adventure: 'Adventure',
  animation: 'Animation',
  comedy: 'Comedy',
  crime: 'Crime',
  documentary: 'Documentary',
  drama: 'Drama',
  family: 'Family',
  fantasy: 'Fantasy',
  history: 'History',
  horror: 'Horror',
  music: 'Music',
  mystery: 'Mystery',
  romance: 'Romance',
  scifi: 'Sci-Fi',
  thriller: 'Thriller',
  war: 'War',
  western: 'Western',
};

export const MOOD_LABELS_PT: Record<string, string> = {
  lighthearted: 'Leve',
  intense: 'Intenso',
  emotional: 'Emocionante',
  dark: 'Sombrio',
  mysterious: 'Misterioso',
  mindbending: 'Mente explodindo',
  cozy: 'Aconchegante',
};

export const MOOD_LABELS_EN: Record<string, string> = {
  lighthearted: 'Lighthearted',
  intense: 'Intense',
  emotional: 'Emotional',
  dark: 'Dark',
  mysterious: 'Mysterious',
  mindbending: 'Mind-bending',
  cozy: 'Cozy',
};

export const DECADE_LABELS_PT: Record<string, string> = {
  classic: 'Clássico',
  '80s': 'Anos 80',
  '90s': 'Anos 90',
  '2000s': 'Anos 2000',
  modern: 'Recente',
};

export const DECADE_LABELS_EN: Record<string, string> = {
  classic: 'Classic',
  '80s': '1980s',
  '90s': '1990s',
  '2000s': '2000s',
  modern: 'Modern',
};

export const ORIGIN_LABELS_PT: Record<string, string> = {
  japanese: 'Japão / Anime',
  korean: 'Coreia do Sul',
  national: 'Brasil',
  european: 'Europa',
  french: 'Francês / França',
  spanish: 'Espanha',
  italian: 'Itália',
  british: 'Reino Unido',
  german: 'Alemanha',
  hollywood: 'Hollywood',
  asian: 'Ásia',
};

export const ORIGIN_LABELS_EN: Record<string, string> = {
  japanese: 'Japanese / Anime',
  korean: 'Korean',
  national: 'Brazilian',
  european: 'European',
  french: 'French / France',
  spanish: 'Spanish',
  italian: 'Italian',
  british: 'British',
  german: 'German',
  hollywood: 'Hollywood',
  asian: 'Asian',
};

export const PACING_LABELS_PT: Record<string, string> = {
  fast: 'Ritmo rápido',
  slow: 'Contemplativo',
};

export const PACING_LABELS_EN: Record<string, string> = {
  fast: 'Fast-paced',
  slow: 'Slow-paced',
};

export const CONTEXT_LABELS_PT: Record<string, string> = {
  solo: 'Para assistir só',
  couple: 'A dois',
  family: 'Em família',
  friends: 'Com amigos',
};

export const CONTEXT_LABELS_EN: Record<string, string> = {
  solo: 'Solo viewing',
  couple: 'Couple',
  family: 'Family',
  friends: 'With friends',
};

export const SUGGESTIONS_PT: readonly string[] = [
  'Dois policiais do FBI se vestem de patricinhas loiras',
  'Pai fala com a filha pelo relógio no buraco negro',
  'Eu quero filme de anime francês',
  'Comédia nacional dos anos 80',
  'Terror psicológico sombrio recente',
  'Dorama coreano de romance emocionante lançamento recente',
];

export const SUGGESTIONS_EN: readonly string[] = [
  'Two FBI agents disguise themselves as rich blonde girls',
  'Father communicates with his daughter through a watch in a black hole',
  'I want a French animated film',
  'Brazilian comedy from the 80s',
  'Dark recent psychological horror',
  'Emotional recent Korean romance drama',
];

export function formatDecisionLine(
  d?: LayaDecisions,
  refMovie?: string | null,
  isPt = true,
): string {
  if (!d) return '';
  const parts: string[] = [];
  if (refMovie) {
    parts.push(isPt ? `Estilo ${refMovie}` : `Like ${refMovie}`);
  }
  if (d.genre || d.genre_label) {
    const label = isPt
      ? d.genre_label || GENRE_LABELS_PT[d.genre] || d.genre
      : GENRE_LABELS_EN[d.genre] || d.genre_label || d.genre;
    if (label && label !== 'none') parts.push(label);
  }
  if (d.mood && d.mood !== 'none') {
    parts.push((isPt ? MOOD_LABELS_PT : MOOD_LABELS_EN)[d.mood] || d.mood);
  }
  if (d.decade && d.decade !== 'none') {
    parts.push((isPt ? DECADE_LABELS_PT : DECADE_LABELS_EN)[d.decade] || d.decade);
  }
  if (d.origin || d.origin_label) {
    const label = isPt
      ? d.origin_label || ORIGIN_LABELS_PT[d.origin] || d.origin
      : ORIGIN_LABELS_EN[d.origin] || d.origin_label || d.origin;
    if (label && label !== 'none') parts.push(label);
  }
  if (d.content_rating && d.content_rating !== 'none') {
    parts.push(
      d.content_rating === 'L'
        ? isPt
          ? 'Livre'
          : 'All ages'
        : `${d.content_rating}+`,
    );
  }
  if (d.pacing && d.pacing !== 'none') {
    parts.push((isPt ? PACING_LABELS_PT : PACING_LABELS_EN)[d.pacing] || d.pacing);
  }
  const ctx = d.context || d.viewing_context;
  if (ctx && ctx !== 'none') {
    parts.push((isPt ? CONTEXT_LABELS_PT : CONTEXT_LABELS_EN)[ctx] || ctx);
  }
  return parts.join(' · ');
}
