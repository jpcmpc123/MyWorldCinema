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
  hollywood: 'Hollywood',
  asian: 'Ásia',
};

export const ORIGIN_LABELS_EN: Record<string, string> = {
  japanese: 'Japanese / Anime',
  korean: 'Korean',
  national: 'Brazilian',
  european: 'European',
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
  'Dorama coreano de romance emocionante lançamento recente',
  'Adorei Interestelar, quero algo parecido no espaço',
  'Comédia brasileira recente para rir bastante',
  'Suspense psicológico tenso dos anos 90 com reviravolta',
  'Anime japonês emocionante aconchegante estilo Ghibli',
  'Ação frenética moderna estilo John Wick',
];

export const SUGGESTIONS_EN: readonly string[] = [
  'Emotional recent Korean romance drama',
  'I loved Interstellar, recommend something similar in space',
  'Fun Brazilian comedy to laugh out loud',
  'Intense 90s psychological thriller with mind-bending twist',
  'Heartfelt cozy Japanese anime like Studio Ghibli',
  'Fast-paced modern action like John Wick',
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
  if (d.genre) {
    parts.push((isPt ? GENRE_LABELS_PT : GENRE_LABELS_EN)[d.genre] || d.genre);
  }
  if (d.mood) {
    parts.push((isPt ? MOOD_LABELS_PT : MOOD_LABELS_EN)[d.mood] || d.mood);
  }
  if (d.decade) {
    parts.push((isPt ? DECADE_LABELS_PT : DECADE_LABELS_EN)[d.decade] || d.decade);
  }
  if (d.origin) {
    parts.push((isPt ? ORIGIN_LABELS_PT : ORIGIN_LABELS_EN)[d.origin] || d.origin);
  }
  if (d.content_rating) {
    parts.push(
      d.content_rating === 'L'
        ? isPt
          ? 'Livre'
          : 'All ages'
        : `${d.content_rating}+`,
    );
  }
  if (d.pacing) {
    parts.push((isPt ? PACING_LABELS_PT : PACING_LABELS_EN)[d.pacing] || d.pacing);
  }
  if (d.viewing_context) {
    parts.push(
      (isPt ? CONTEXT_LABELS_PT : CONTEXT_LABELS_EN)[d.viewing_context] ||
        d.viewing_context,
    );
  }
  return parts.join(' · ');
}
