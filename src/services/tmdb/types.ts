export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  popularity: number;
  original_language?: string;
}

export interface TMDBSeries {
  id: number;
  name: string;
  original_name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  popularity: number;
  original_language?: string;
}

/**
 * Payload híbrido retornado por endpoints de filme ou série do TMDB antes da normalização.
 * Elimina a necessidade de casts `as unknown as Record<string, unknown>`.
 */
export interface TMDBRawMediaPayload extends Partial<TMDBMovie> {
  id: number;
  name?: string;
  original_name?: string;
  first_air_date?: string;
  episode_run_time?: number[];
  last_episode_to_air?: { runtime?: number } | null;
  next_episode_to_air?: { runtime?: number } | null;
  created_by?: { id: number; name: string; profile_path?: string | null }[];
  aggregate_credits?: {
    cast?: {
      id: number;
      name: string;
      profile_path: string | null;
      order: number;
      roles?: { character: string; episode_count: number }[];
    }[];
    crew?: {
      id: number;
      name: string;
      department: string;
      profile_path: string | null;
      jobs?: { job: string; episode_count: number }[];
    }[];
  };
}

export interface TMDBMovieDetails extends TMDBMovie {
  tagline: string;
  runtime: number;
  status: string;
  budget: number;
  revenue: number;
  genres: { id: number; name: string }[];
  production_companies: {
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string;
  }[];
  production_countries: { iso_3166_1: string; name: string }[];
  spoken_languages: { english_name: string; iso_639_1: string; name: string }[];
  credits?: {
    cast: {
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
      order: number;
    }[];
    crew: {
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }[];
  };
  similar?: {
    results: TMDBMovie[];
  };
  recommendations?: {
    results: TMDBMovie[];
  };
  'watch/providers'?: {
    results: {
      [countryCode: string]: {
        link: string;
        flatrate?: { provider_id: number; provider_name: string; logo_path: string }[];
        rent?: { provider_id: number; provider_name: string; logo_path: string }[];
        buy?: { provider_id: number; provider_name: string; logo_path: string }[];
      };
    };
  };
  videos?: {
    results: {
      id: string;
      key: string;
      name: string;
      site: string;
      type: string;
    }[];
  };
  // Datas de lançamento por país (filmes) — aba "Releases"
  release_dates?: {
    results: {
      iso_3166_1: string;
      release_dates: {
        certification: string;
        iso_639_1: string;
        note: string;
        release_date: string;
        type: number; // 1=Premiere 2=TheatricalLtd 3=Theatrical 4=Digital 5=Physical 6=TV
      }[];
    }[];
  };
  // Classificação indicativa por país (séries)
  content_ratings?: {
    results: { iso_3166_1: string; rating: string }[];
  };
  external_ids?: {
    imdb_id?: string | null;
  };
  // Filmes usam `keywords`; séries usam `results`
  keywords?: {
    keywords?: { id: number; name: string }[];
    results?: { id: number; name: string }[];
  };
  alternative_titles?: {
    titles?: { iso_3166_1: string; title: string; type: string }[];
    results?: { iso_3166_1: string; title: string; type: string }[];
  };
  original_language?: string;
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
  } | null;
  collection_parts?: TMDBMovie[];
}

export interface TMDBCollectionDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: TMDBMovie[];
}

export interface TMDBImage {
  file_path: string;
  width: number;
  height: number;
  aspect_ratio: number;
  vote_average: number;
  vote_count: number;
}

export interface TMDBMovieImages {
  id: number;
  posters: TMDBImage[];
  backdrops: TMDBImage[];
}

export interface TMDBPerson {
  id: number;
  name: string;
  biography: string;
  profile_path: string | null;
  known_for_department: string;
  birthday: string | null;
  place_of_birth?: string | null;
  also_known_as?: string[];
}

export interface TMDBPersonMovieCredit {
  id: number;
  title: string;
  original_title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  popularity: number;
  character?: string;
  job?: string;
  department?: string;
  genre_ids?: number[];
  /**
   * 'tv' quando o crédito veio de `tv_credits` (série). Ausente/`movie` = filme.
   * Usado para rotear o clique para /tv/{id} na página de pessoa.
   */
  media_type?: 'movie' | 'tv';
}

export interface TMDBPersonMovieCredits {
  id: number;
  cast: TMDBPersonMovieCredit[];
  crew: TMDBPersonMovieCredit[];
}

/**
 * Pessoa + filmografia numa única chamada
 * (`/person/{id}?append_to_response=movie_credits,tv_credits`) — usada pela
 * página de perfil (abas Bio / Ator / cargos de equipe, incluindo Criador).
 */
export interface TMDBPersonDetails extends TMDBPerson {
  movie_credits?: TMDBPersonMovieCredits;
  /** Créditos em SÉRIES — trazem os criadores (job 'Creator') e o elenco de TV */
  tv_credits?: TMDBPersonMovieCredits;
  external_ids?: {
    imdb_id?: string | null;
    wikidata_id?: string | null;
  };
  wikipedia_url?: string;
}

export interface TMDBResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TMDBSearchResult {
  id: number;
  /** 'movie' | 'tv' — nunca misturamos os dois numa mesma lista. */
  media_type: 'movie' | 'tv';
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  popularity: number;
  directors: string[];
  alternativeTitles: string[];
}

export interface TMDBSearchPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  popularity?: number;
  known_for?: { id: number; title?: string; name?: string; media_type?: string }[];
}

/** Resposta mínima de /movie|tv/{id}?append_to_response=credits,alternative_titles */
export interface TMDBEnrichmentPayload {
  created_by?: { id: number; name: string }[];
  credits?: { crew?: { id: number; name: string; job?: string }[] };
  alternative_titles?: { titles?: { title: string }[]; results?: { title: string }[] };
}

export interface SimilarSourceProfile {
  id: number;
  type: 'movie' | 'tv';
  genreIds: number[];
  keywordIds: number[];
  originalLanguage: string;
  releaseYear: number;
  collectionId?: number;
  collectionParts: TMDBMovie[];
  rankedPool: TMDBMovie[];
}

export interface DiscoverMediaParams {
  genreId?: number;
  year?: number;
  decade?: number;
  providerId?: number;
  language?: string;
  /** País/nacionalidade: aceita ISO alpha-2 ou nome por extenso (Brazil → BR) */
  country?: string;
  sortBy?: string;
  page?: number;
  pagesToFetch?: number;
  /** Limites de data de lançamento (YYYY-MM-DD) — usado pelo filtro Released */
  releaseDateGte?: string;
  releaseDateLte?: string;
  /** Piso de votos explícito (sobrescreve o padrão por sortBy) */
  minVotes?: number;
  /** Gêneros excluídos no servidor (ex.: '99,10402' p/ docs/musicais) */
  withoutGenres?: string;
}

export interface HubSectionsResult {
  popular: TMDBMovie[];
  highestRated: TMDBMovie[];
  mostWatched: TMDBMovie[];
  mostAnticipated: TMDBMovie[];
}
