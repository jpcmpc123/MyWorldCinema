import type { LogEntry, MovieList, Review, UserProfile } from '../../types';

export interface MovieShort {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
}

export interface ProfileImportPayloadItem {
  movieId: number;
  movieTitle: string;
  moviePoster: string | null;
  movieYear: string;
  watchedDate: string; // YYYY-MM-DD or ''
  rating: number; // 0 or 0.5..5.0
  isRewatch: boolean;
  liked: boolean;
  reviewText: string;
  tags: string[];
}

export interface ProfileImportSummary {
  watchedCount: number;
  diaryCreatedCount: number;
  diaryUpdatedCount: number;
  reviewsCount: number;
  ratingsCount: number;
}

export interface ListImportOptions {
  targetListId: string | 'new';
  newListTitle?: string;
  newListDescription?: string;
  newListTags?: string[];
  isRanked?: boolean;
  isPrivate?: boolean;
  replaceExisting?: boolean;
  markAsWatched?: boolean;
  items: {
    id: number;
    title: string;
    poster_path: string | null;
    release_date: string;
    notes?: string;
    director?: string;
  }[];
}

export interface AppContextType {
  user: UserProfile;
  updateUser: (updates: Partial<UserProfile>) => void;
  logs: LogEntry[];
  saveLog: (entry: Omit<LogEntry, 'id' | 'createdAt'>) => void;
  deleteLog: (id: string) => void;
  watchlist: MovieShort[];
  toggleWatchlist: (movie: MovieShort) => void;
  isMovieInWatchlist: (movieId: number) => boolean;
  watchedMovieIds: number[];
  toggleWatched: (movieId: number) => void;
  isMovieWatched: (movieId: number) => boolean;
  likedMovieIds: number[];
  toggleLikeMovie: (movieId: number) => void;
  isMovieLiked: (movieId: number) => boolean;
  ratingsMap: Record<number, number>;
  setMovieRating: (movieId: number, rating: number) => void;
  top4MovieIds: number[];
  setTop4Movie: (slotIndex: number, movieId: number) => void;
  lists: MovieList[];
  createList: (
    newList: Omit<MovieList, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>,
  ) => string;
  updateList: (
    listId: string,
    updates: Omit<MovieList, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>,
  ) => void;
  deleteList: (listId: string) => void;
  reviews: Review[];
  addReview: (
    newReview: Omit<Review, 'id' | 'createdAt' | 'author' | 'likesCount' | 'commentsCount'>,
  ) => void;
  movieOverrides: Record<number, { poster?: string; backdrop?: string }>;
  setMovieOverride: (movieId: number, override: { poster?: string; backdrop?: string }) => void;
  // Import functions (Letterboxd specification)
  importToProfile: (items: ProfileImportPayloadItem[]) => Promise<ProfileImportSummary>;
  importToWatchlist: (
    movies: MovieShort[],
  ) => Promise<{ addedCount: number; skippedCount: number }>;
  importToList: (
    options: ListImportOptions,
  ) => Promise<{ listId: string; totalCount: number; addedCount: number }>;
  // ActionBottomSheet (mobile long-press / actions)
  actionSheetMovie: { id: number; title: string; release_date?: string } | null;
  openActionSheet: (movie: { id: number; title: string; release_date?: string }) => void;
  closeActionSheet: () => void;
  // Modal states
  isLogModalOpen: boolean;
  selectedMovieForLog: MovieShort | null;
  openLogModal: (movie?: MovieShort) => void;
  closeLogModal: () => void;
  isTop4PickerOpen: boolean;
  activeTop4Slot: number | null;
  openTop4Picker: (slotIndex: number) => void;
  closeTop4Picker: () => void;
}

// Row shape of public.film_logs in Supabase
export interface FilmLogRow {
  id: string;
  user_id: string;
  film_id: number;
  film_title: string;
  film_poster: string | null;
  film_year: number | null;
  watched_on: string | null;
  rating: number | null;
  liked: boolean;
  review_text: string | null;
  contains_spoilers: boolean;
  created_at: string;
}

export interface WatchlistRow {
  user_id: string;
  film_id: number;
  film_title: string;
  film_poster: string | null;
  film_year: number | null;
}

export type MovieMetaCache = Record<
  number,
  { title: string; poster: string | null; year: number | null }
>;

export type RememberMovieFn = (m: {
  id: number;
  title?: string;
  poster_path?: string | null;
  release_date?: string;
  movieTitle?: string;
  moviePoster?: string | null;
  movieYear?: string | number;
}) => void;

// Perfil neutro para visitante DESLOGADO - nunca exibimos dados de outra
// conta (era o bug: guestUser hardcoded "jpcmpc23" aparecia no F5 sem login).
export const guestUser: UserProfile = {
  id: 'guest',
  username: 'visitante',
  displayName: 'Visitante',
  bio: '',
  avatarUrl: '',
  backdropUrl: '',
  location: '',
  website: '',
  isPro: false,
  isPatron: false,
  top4MovieIds: [0, 0, 0, 0],
  followingCount: 0,
  followersCount: 0,
};

export const rowToLogEntry = (row: FilmLogRow): LogEntry => ({
  id: row.id,
  movieId: row.film_id,
  movieTitle: row.film_title,
  moviePoster: row.film_poster,
  movieYear: row.film_year ? String(row.film_year) : '',
  watchedDate: row.watched_on ?? '',
  rating: row.rating ?? 0,
  isRewatch: false,
  liked: row.liked,
  reviewText: row.review_text ?? '',
  containsSpoilers: row.contains_spoilers,
  tags: [],
  createdAt: row.created_at,
});
