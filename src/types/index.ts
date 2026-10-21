export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  backdropUrl?: string;
  location: string;
  website: string;
  isPro: boolean;
  isPatron: boolean;
  top4MovieIds: number[];
  followingCount: number;
  followersCount: number;
}

export interface LogEntry {
  id: string;
  movieId: number;
  movieTitle: string;
  moviePoster: string | null;
  movieYear: string;
  watchedDate: string; // YYYY-MM-DD
  rating: number; // 0 to 5 in increments of 0.5
  isRewatch: boolean;
  liked: boolean;
  reviewText: string;
  containsSpoilers: boolean;
  tags: string[];
  createdAt: string;
}

export interface MovieList {
  id: string;
  title: string;
  description: string;
  isRanked: boolean;
  isPrivate: boolean;
  movies: {
    id: number;
    title: string;
    poster_path: string | null;
    release_date: string;
    notes?: string;
  }[];
  author: {
    username: string;
    displayName: string;
    avatarUrl: string;
  };
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

export interface Review {
  id: string;
  movieId: number;
  movieTitle: string;
  moviePoster: string | null;
  movieYear: string;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string;
    isPro?: boolean;
  };
  rating: number;
  liked: boolean;
  content: string;
  containsSpoilers: boolean;
  watchedDate?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: 'watch' | 'review' | 'like' | 'list';
  author: {
    username: string;
    displayName: string;
    avatarUrl: string;
  };
  movieId?: number;
  movieTitle?: string;
  moviePoster?: string | null;
  movieYear?: string;
  rating?: number;
  liked?: boolean;
  reviewSnippet?: string;
  listTitle?: string;
  timestamp: string;
}
