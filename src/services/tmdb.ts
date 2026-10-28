import {
  clearAllTmdbRuntimeCaches,
  collectionDetailsCache,
  mediaDetailsCache,
  personDetailsCache,
} from './tmdb/cache';
import {
  fetchFromTMDB,
  getTmdbLanguage,
  IMAGE_BASE_URL,
  MOVIE_GENRES,
  setTmdbLanguage,
  STREAMING_SERVICES,
  SUPPORTED_LANGUAGES,
  TMDB_TODAY,
  TMDB_TOMORROW,
  toOriginCountryIso,
  TV_GENRES,
} from './tmdb/client';
import {
  getCollectionDetails,
  getMovieDetails,
  getMovieImages,
  getPerson,
  getPersonDetails,
  getPersonMovieCredits,
  getPersonProviderMediaKeys,
  getSimilarMedia,
  getTVDetails,
} from './tmdb/details';
import {
  discoverByKeywordsOrGenres,
  discoverMovies,
  discoverMoviesBatch,
  discoverTV,
  discoverTVBatch,
  getCuratedPopularBatch,
  getFilmsHubSections,
  getSectionMedia,
  getSeriesHubSections,
} from './tmdb/discover';
import {
  findByImdbId,
  getMovieForImportById,
  searchEnriched,
  searchMovies,
  searchMoviesForImport,
  searchMultiEnriched,
  searchPeople,
  searchTV,
} from './tmdb/search';
import type {
  TMDBCollectionDetails,
  TMDBImage,
  TMDBMovie,
  TMDBMovieDetails,
  TMDBMovieImages,
  TMDBPerson,
  TMDBPersonDetails,
  TMDBPersonMovieCredit,
  TMDBPersonMovieCredits,
  TMDBResponse,
  TMDBSearchPerson,
  TMDBSearchResult,
  TMDBSeries,
} from './tmdb/types';

export {
  setTmdbLanguage,
  getTmdbLanguage,
  TMDB_TODAY,
  TMDB_TOMORROW,
  toOriginCountryIso,
};

export type {
  TMDBMovie,
  TMDBSeries,
  TMDBMovieDetails,
  TMDBCollectionDetails,
  TMDBImage,
  TMDBMovieImages,
  TMDBPerson,
  TMDBPersonMovieCredit,
  TMDBPersonMovieCredits,
  TMDBPersonDetails,
  TMDBResponse,
  TMDBSearchResult,
  TMDBSearchPerson,
};

export const tmdb = {
  clearRuntimeCaches(): void {
    clearAllTmdbRuntimeCaches();
  },

  getCachedDetails(id: number, type: 'movie' | 'tv'): TMDBMovieDetails | null {
    const key = `${type}:${id}:${getTmdbLanguage()}`;
    return mediaDetailsCache.get(key);
  },

  getCachedPersonDetails(id: number): TMDBPersonDetails | null {
    const key = `person:${id}:${getTmdbLanguage()}`;
    return personDetailsCache.get(key);
  },

  getCachedCollectionDetails(id: number): TMDBCollectionDetails | null {
    const key = `collection:${id}:${getTmdbLanguage()}`;
    return collectionDetailsCache.get(key);
  },

  getImageUrl(
    path: string | null,
    size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500',
  ): string {
    if (!path) return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
    if (path.startsWith('http')) return path;
    return `${IMAGE_BASE_URL}/${size}${path}`;
  },

  getBackdropUrl(
    path: string | null,
    size: 'w780' | 'w1280' | 'original' = 'original',
  ): string {
    if (!path) return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1280&auto=format&fit=crop&q=80';
    if (path.startsWith('http')) return path;
    return `${IMAGE_BASE_URL}/${size}${path}`;
  },

  getProfileUrl(
    path: string | null,
    size: 'w185' | 'h632' | 'original' = 'w185',
  ): string {
    if (!path) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=185&auto=format&fit=crop&q=60';
    return `${IMAGE_BASE_URL}/${size}${path}`;
  },

  async getPopular(page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/movie/popular', { page });
  },

  async getTopRated(page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/movie/top_rated', { page });
  },

  async getNowPlaying(page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/movie/now_playing', { page });
  },

  async getTrending(
    timeWindow: 'day' | 'week' = 'week',
    page = 1,
  ): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/trending/movie/${timeWindow}`, { page });
  },

  async getTrendingBatch(
    timeWindow: 'day' | 'week' = 'week',
    page = 1,
    pagesToFetch = 3,
  ): Promise<{ results: TMDBMovie[]; total_results: number; total_pages: number }> {
    const startPage = (page - 1) * pagesToFetch + 1;
    const pageNumbers = Array.from({ length: pagesToFetch }, (_, i) => startPage + i);
    const responses = await Promise.all(
      pageNumbers.map((p) =>
        this.getTrending(timeWindow, p).catch(() => ({
          results: [] as TMDBMovie[],
          total_results: 0,
          total_pages: 0,
          page: p,
        })),
      ),
    );
    const allResults = responses.flatMap((r) => r.results);
    const seen = new Set<number>();
    const unique = allResults.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    const firstRes = responses[0] || { total_results: 0, total_pages: 1 };
    return {
      results: unique,
      total_results: firstRes.total_results,
      total_pages: Math.max(1, Math.ceil((firstRes.total_pages || 1) / pagesToFetch)),
    };
  },

  getMovieDetails,
  getMovieImages,
  getCollectionDetails,
  discoverByKeywordsOrGenres,
  getSimilarMedia,

  searchTV,
  searchMovies,
  searchPeople,
  searchEnriched,
  searchMultiEnriched,

  getPerson,
  getPersonMovieCredits,
  getPersonDetails,
  getPersonProviderMediaKeys,

  streamingServices: STREAMING_SERVICES,
  languages: SUPPORTED_LANGUAGES,
  tvGenres: TV_GENRES,
  genres: MOVIE_GENRES,

  discoverMovies,
  discoverMoviesBatch,

  async getPopularTV(page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/tv/popular', { page });
  },

  async getTopRatedTV(page = 1): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>('/tv/top_rated', { page });
  },

  async getTrendingTV(
    timeWindow: 'day' | 'week' = 'week',
    page = 1,
  ): Promise<TMDBResponse<TMDBMovie>> {
    return fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/trending/tv/${timeWindow}`, { page });
  },

  discoverTV,
  discoverTVBatch,
  getCuratedPopularBatch,
  getSectionMedia,
  getFilmsHubSections,
  getSeriesHubSections,
  getTVDetails,

  getMovieForImportById,
  findByImdbId,
  searchMoviesForImport,
};
