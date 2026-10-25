export interface AiMovie {
  id: number;
  title: string;
  original_title?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  vote_count?: number;
  genre_ids?: number[];
  popularity?: number;
  poster_url?: string | null;
  backdrop_url?: string | null;
}

export type LayaGenre =
  | 'action'
  | 'adventure'
  | 'animation'
  | 'comedy'
  | 'crime'
  | 'documentary'
  | 'drama'
  | 'family'
  | 'fantasy'
  | 'history'
  | 'horror'
  | 'music'
  | 'mystery'
  | 'romance'
  | 'scifi'
  | 'thriller'
  | 'war'
  | 'western';

export type LayaMood =
  | 'lighthearted'
  | 'intense'
  | 'emotional'
  | 'dark'
  | 'mysterious'
  | 'mindbending'
  | 'cozy'
  | 'inspirational';

export type LayaGuessTitle = string;

export type LayaContentRating = 'L' | '10' | '12' | '14' | '16' | '18';

export type LayaDecade = 'classic' | '80s' | '90s' | '2000s' | 'modern';

export type LayaOrigin =
  | 'japanese'
  | 'korean'
  | 'national'
  | 'european'
  | 'french'
  | 'spanish'
  | 'italian'
  | 'british'
  | 'german'
  | 'hollywood'
  | 'asian';

export type LayaPacing = 'fast' | 'slow';

export type LayaViewingContext = 'solo' | 'couple' | 'family' | 'friends';

export interface LayaDecisions {
  is_guessing_movie?: string | boolean;
  guess_title?: string | null;
  genre: LayaGenre | string;
  genre_label?: string;
  mood: LayaMood | string;
  content_rating: LayaContentRating | string;
  decade: LayaDecade | string;
  origin: LayaOrigin | string;
  origin_label?: string;
  pacing?: LayaPacing | string;
  viewing_context?: LayaViewingContext | string;
  context?: LayaViewingContext | string;
}

export interface Weights5DModel {
  dims: string[];
  priors: Record<string, Record<string, number>>;
  weights: Record<string, Record<string, Record<string, number>>>;
}

export interface RecommendResponse {
  query: string;
  is_guessing_movie?: boolean;
  guessed_title?: string | null;
  guessed_movie?: AiMovie | null;
  reference_movie?: string | null;
  decisions: LayaDecisions;
  movies: AiMovie[];
  cached?: boolean;
}

export interface RecommendOptions {
  /** Idioma para os resultados do TMDB ('pt-BR' | 'en-US') */
  language?: string;
  /** IDs de filmes já exibidos na conversa para priorizar inéditos */
  excludeIds?: Iterable<number>;
  /** Ignora o cache de consulta para buscar novas variações */
  bypassCache?: boolean;
  /** Chave ou token customizado do TMDB (usado pelo servidor Node) */
  apiKeyOrToken?: string;
  /** Pesos pré-carregados opcionais (usado pelo servidor Node) */
  weightsModel?: Weights5DModel | null;
}

export interface ChatTurn {
  id: string;
  query: string;
  loading: boolean;
  isGuessingMovie?: boolean;
  guessedTitle?: string | null;
  guessedMovie?: AiMovie | null;
  decisions?: LayaDecisions;
  referenceMovie?: string | null;
  movies?: AiMovie[];
  error?: string;
}
