import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useParams, Navigate, useLocation } from 'react-router-dom';
import { MoreHorizontal, Search, Heart, ChevronRight, User, Plus, Film } from 'lucide-react';
import { RatingHistogram } from '../components/RatingHistogram';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useProfileByUsername } from '../lib/useProfileByUsername';
import { tmdb, type TMDBMovie } from '../services/tmdb';
import { PosterCard } from '../components/PosterCard';
import { useLanguage } from '../i18n/LanguageContext';
import { parseProfileTabRoute } from '../utils/tabRoutes';

export const ProfilePage: React.FC = () => {
  const { t } = useLanguage();
  const { username: paramUsername } = useParams<{ username: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'profile';

  const {
    user,
    updateUser,
    logs,
    watchlist,
    watchedMovieIds,
    likedMovieIds,
    top4MovieIds,
    lists,
    ratingsMap,
  } = useApp();

  const { isAuthenticated } = useAuth();

  const [top4Movies, setTop4Movies] = useState<(TMDBMovie | null)[]>([null, null, null, null]);
  const [, setWatchedMovies] = useState<TMDBMovie[]>([]);
  const [likedMovies, setLikedMovies] = useState<TMDBMovie[]>([]);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: user.displayName,
    bio: user.bio,
    location: user.location,
    website: user.website,
  });

  // Lock body scroll while the edit-profile modal is open + close on Escape
  useEffect(() => {
    if (!isEditingBio) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEditingBio(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isEditingBio]);

  // Load Top 4 Movies
  useEffect(() => {
    async function loadTop4() {
      const fetched = await Promise.all(
        top4MovieIds.map(async (id) => {
          if (!id) return null;
          try {
            return await tmdb.getMovieDetails(id);
          } catch {
            return null;
          }
        })
      );
      setTop4Movies(fetched);
    }
    void loadTop4();
    const onRefresh = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ registerPromise?: (p: Promise<unknown>) => void }>;
      customEvt.detail?.registerPromise?.(loadTop4());
    };
    window.addEventListener('mw:pull-to-refresh', onRefresh);
    return () => window.removeEventListener('mw:pull-to-refresh', onRefresh);
  }, [top4MovieIds]);

  // Load Watched Movies
  useEffect(() => {
    async function loadWatched() {
      const uniqueIds = Array.from(new Set(watchedMovieIds)).slice(0, 24);
      const fetched = await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            return await tmdb.getMovieDetails(id);
          } catch {
            return null;
          }
        })
      );
      setWatchedMovies(fetched.filter(Boolean) as TMDBMovie[]);
    }
    void loadWatched();
    const onRefresh = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ registerPromise?: (p: Promise<unknown>) => void }>;
      customEvt.detail?.registerPromise?.(loadWatched());
    };
    window.addEventListener('mw:pull-to-refresh', onRefresh);
    return () => window.removeEventListener('mw:pull-to-refresh', onRefresh);
  }, [watchedMovieIds]);

  // Load Liked Movies
  useEffect(() => {
    async function loadLiked() {
      const uniqueIds = Array.from(new Set(likedMovieIds)).slice(0, 24);
      const fetched = await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            return await tmdb.getMovieDetails(id);
          } catch {
            return null;
          }
        })
      );
      setLikedMovies(fetched.filter(Boolean) as TMDBMovie[]);
    }
    void loadLiked();
    const onRefresh = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ registerPromise?: (p: Promise<unknown>) => void }>;
      customEvt.detail?.registerPromise?.(loadLiked());
    };
    window.addEventListener('mw:pull-to-refresh', onRefresh);
    return () => window.removeEventListener('mw:pull-to-refresh', onRefresh);
  }, [likedMovieIds]);

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser(editForm);
    setIsEditingBio(false);
  };

  const username =
    paramUsername ?? parseProfileTabRoute(location.pathname, user.username)?.username;

  // Perfil remoto (Supabase) quando a URL aponta para outro username
  const remote = useProfileByUsername(username, user.username);

  // Dados efetivamente exibidos (remoto se houver, senão o estado local)
  const viewUsername = remote.isRemote && remote.profile ? remote.profile.username : user.username;
  const viewAvatar = remote.isRemote && remote.profile?.avatar_url ? remote.profile.avatar_url : user.avatarUrl;
  const viewLogs = remote.isRemote ? remote.logs : logs;

  // Estatísticas reais, derivadas dos dados exibidos (sem números de demo)
  const currentYear = String(new Date().getFullYear());
  const viewFilmsCount = new Set(viewLogs.map((l) => l.movieId)).size;
  const viewThisYearCount = viewLogs.filter((l) =>
    (l.watchedDate || l.createdAt || '').startsWith(currentYear)
  ).length;
  const viewDiaryCount = viewLogs.length;
  const viewListsCount = remote.isRemote ? 0 : lists.length;
  const viewWatchlistCount = remote.isRemote ? 0 : watchlist.length;
  const viewFollowingCount = remote.isRemote || isAuthenticated ? 0 : user.followingCount;
  const viewFollowersCount = remote.isRemote || isAuthenticated ? 0 : user.followersCount;

  // Recent 4 activity movies
  const recentLogs = viewLogs.slice(0, 4);

  // Mobile-only derived stats
  const viewReviewsCount = viewLogs.filter((l) => l.reviewText).length;
  const viewLikesCount = remote.isRemote ? 0 : likedMovieIds.length;
  const ratedLogs = viewLogs.filter((l) => l.rating > 0);
  const avgRating =
    ratedLogs.length > 0
      ? ratedLogs.reduce((sum, l) => sum + l.rating, 0) / ratedLogs.length
      : 0;

  const mobileCounters: { label: string; count: number; to: string }[] = [
    { label: t('nav_films'), count: viewFilmsCount, to: `/${viewUsername}?tab=films` },
    { label: t('nav_series'), count: 0, to: '/series' },
    { label: t('hdr_diary'), count: viewDiaryCount, to: `/${viewUsername}/diary` },
    { label: t('reviews_label'), count: viewReviewsCount, to: `/${viewUsername}?tab=reviews` },
    { label: t('hdr_watchlist'), count: viewWatchlistCount, to: `/${viewUsername}/watchlist` },
    { label: t('nav_lists'), count: viewListsCount, to: `/${viewUsername}/lists` },
    { label: t('pp_likes'), count: viewLikesCount, to: `/${viewUsername}?tab=likes` },
    { label: t('pp_tags'), count: 0, to: `/${viewUsername}?tab=tags` },
    { label: t('pp_following'), count: viewFollowingCount, to: `/${viewUsername}?tab=network` },
    { label: t('pp_followers'), count: viewFollowersCount, to: `/${viewUsername}?tab=network` },
  ];

  // Guard: username desconhecido (sem perfil local nem no Supabase) vai para home
  if (username && username.toLowerCase() !== user.username.toLowerCase() && remote.status === 'not-found') {
    return <Navigate to="/" replace />;
  }

  const renderTabBody = (tabId: string) => {
    if (tabId === 'profile') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
          {/* LEFT COLUMN (8 cols): Favorite Films + Recent Activity */}
          <div className="lg:col-span-8 space-y-10">
            {/* FAVORITE FILMS (THE TOP 4) — local user only */}
            {!remote.isRemote && (
              <section className="space-y-3">
                <div className="border-b border-lb-elevated pb-1.5 flex items-center justify-between">
                  <h2 className="text-[11px] uppercase tracking-wider font-bold text-lb-text">
                    {t('cfg_favorite_films')}
                  </h2>
                </div>

                {top4Movies.every((m) => !m) ? (
                  <div className="py-12 text-center space-y-2">
                    <p className="text-sm text-white font-semibold">{t('person_nothing')}</p>
                    <p className="text-xs text-lb-muted">{t('pp_pick_four')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    {top4Movies.map((movie, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-[2/3] bg-lb-surface rounded-xs overflow-hidden border border-white/12 shadow-md w-full h-full"
                      >
                        {movie ? (
                          <Link to={`/film/${movie.id}`} title={movie.title}>
                            <img
                              loading="lazy"
                              decoding="async"
                              src={tmdb.getImageUrl(movie.poster_path, 'w500')}
                              srcSet={`${tmdb.getImageUrl(movie.poster_path, 'w342')} 342w, ${tmdb.getImageUrl(movie.poster_path, 'w500')} 500w, ${tmdb.getImageUrl(movie.poster_path, 'w780')} 780w`}
                              sizes="(max-width: 1024px) 22vw, 180px"
                              alt={movie.title}
                              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                            />
                          </Link>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lb-muted text-xs">
                            {t('pp_slot')} #{idx + 1}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* RECENT ACTIVITY */}
            <section className="space-y-3">
              <div className="border-b border-lb-elevated pb-1.5 flex items-center justify-between">
                <h2 className="text-[11px] uppercase tracking-wider font-bold text-lb-text">
                  {t('pp_recent_activity')}
                </h2>
                <button
                  onClick={() => setTab('diary')}
                  className="text-[10px] uppercase font-bold tracking-wider text-lb-muted hover:text-white"
                >
                  {t('pp_all')}
                </button>
              </div>

              {recentLogs.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-sm text-white font-semibold">{t('person_nothing')}</p>
                  <p className="text-xs text-lb-muted">{t('pp_recent_empty')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  {recentLogs.map((log, idx) => (
                    <div key={`recent-${log.id}-${idx}`} className="group">
                      <div className="aspect-[2/3] bg-lb-surface rounded-xs overflow-hidden border border-white/12 hover:border-white transition-all shadow-md">
                        <Link to={`/film/${log.movieId}`}>
                          <img
                            loading="lazy"
                            decoding="async"
                            src={tmdb.getImageUrl(log.moviePoster, 'w500')}
                            srcSet={`${tmdb.getImageUrl(log.moviePoster, 'w342')} 342w, ${tmdb.getImageUrl(log.moviePoster, 'w500')} 500w, ${tmdb.getImageUrl(log.moviePoster, 'w780')} 780w`}
                            sizes="(max-width: 1024px) 22vw, 180px"
                            alt={log.movieTitle}
                            className="w-full h-full object-cover"
                          />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN (4 cols): Watchlist, Diary */}
          <div className="lg:col-span-4 space-y-6">
            {/* WATCHLIST PREVIEW */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-lb-elevated pb-1 text-xs">
                <span className="uppercase tracking-wider font-bold text-lb-text text-[11px]">
                  Watchlist
                </span>
                <span className="text-lb-muted text-[11px] tabular-nums">{viewWatchlistCount}</span>
              </div>

              {/* Overlapping mini-posters */}
              {viewWatchlistCount === 0 ? (
                <p className="text-[11px] text-lb-muted pt-2">
                  {t('pp_no_watchlist')}
                </p>
              ) : (
                <div className="flex items-center -space-x-4 pt-1">
                  {watchlist.slice(0, 4).map((m, i) => (
                    <div
                      key={m.id}
                      className="w-14 aspect-[2/3] rounded-xs overflow-hidden shadow border border-white/20"
                      style={{ zIndex: 10 - i }}
                    >
                      {m.poster_path ? (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={m.poster_path.startsWith('http') ? m.poster_path : tmdb.getImageUrl(m.poster_path, 'w185')}
                          alt={m.title}
                          title={m.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-lb-surface flex items-center justify-center text-[8px] text-lb-muted px-0.5 text-center">
                          {m.title}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DIARY PREVIEW */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-lb-elevated pb-1 text-xs">
                <span className="uppercase tracking-wider font-bold text-lb-text text-[11px]">
                  {t('hdr_diary')}
                </span>
                <span className="text-lb-muted text-[11px] tabular-nums">{viewDiaryCount}</span>
              </div>

              <div className="space-y-1.5 text-xs text-lb-white">
                {viewDiaryCount === 0 ? (
                  <p className="text-[11px] text-lb-muted pt-1">{t('pp_no_diary')}</p>
                ) : (
                  viewLogs.slice(0, 3).map((l, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-lb-muted">
                        {l.watchedDate.slice(8, 10)}
                      </span>
                      <Link
                        to={`/film/${l.movieId}`}
                        className="text-white hover:text-lb-green truncate text-xs"
                      >
                        {l.movieTitle}
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (tabId === 'films') {
      return (
        <div className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest font-bold text-lb-text border-b border-lb-elevated pb-2">
            {t('pp_all_watched')} ({logs.length})
          </h2>
          {/* Mobile: strict 4-col grid with rating stars under each poster */}
          <div className="md:hidden grid grid-cols-4 gap-1.5 px-2">
            {logs.map((log, idx) => {
              const r = ratingsMap[log.movieId] ?? log.rating;
              return (
                <div key={`all-mob-${log.id}-${idx}`}>
                  <PosterCard
                    movie={{
                      id: log.movieId,
                      title: log.movieTitle,
                      poster_path: log.moviePoster,
                      release_date: log.movieYear,
                    }}
                    size="fluid"
                  />
                  {r > 0 && (
                    <p className="mt-1 text-center text-[10px] text-lb-green font-semibold">
                      {'★'.repeat(Math.round(r))}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="max-md:hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {logs.map((log, idx) => (
              <PosterCard
                key={`all-${log.id}-${idx}`}
                size="fluid"
                movie={{
                  id: log.movieId,
                  title: log.movieTitle,
                  poster_path: log.moviePoster,
                  release_date: log.movieYear,
                }}
                showDetails
              />
            ))}
          </div>
        </div>
      );
    }

    if (tabId === 'diary') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-lb-elevated pb-2">
            <h2 className="text-xs uppercase tracking-widest font-bold text-lb-text">
              {t('pp_film_diary')} ({logs.length} {t('pp_entries')})
            </h2>
          </div>

          <div className="bg-lb-surface border border-lb-elevated rounded-sm overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs text-left">
              <thead className="bg-lb-bg border-b border-lb-elevated text-[11px] uppercase font-bold text-lb-muted">
                <tr>
                  <th className="py-2.5 px-4">{t('pp_th_date')}</th>
                  <th className="py-2.5 px-4">{t('pp_th_film')}</th>
                  <th className="py-2.5 px-4">{t('filter_released')}</th>
                  <th className="py-2.5 px-4">{t('filter_rating')}</th>
                  <th className="py-2.5 px-4 text-center">{t('action_like')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lb-elevated/60">
                {logs.map((log, idx) => (
                  <tr key={`diary-tab-${log.id}-${idx}`} className="hover:bg-lb-elevated/50 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-lb-text tabular-nums">{log.watchedDate}</td>
                    <td className="py-2.5 px-4 font-bold text-white">
                      <Link to={`/film/${log.movieId}`} className="hover:text-lb-green">
                        {log.movieTitle}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4 text-lb-muted tabular-nums">{log.movieYear}</td>
                    <td className="py-2.5 px-4 text-lb-green font-bold tabular-nums">
                      {log.rating > 0 ? `${log.rating} ★` : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {log.liked ? <Heart className="w-3.5 h-3.5 fill-lb-orange text-lb-orange inline" /> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (tabId === 'reviews') {
      return (
        <div className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest font-bold text-lb-text border-b border-lb-elevated pb-2">
            Reviews
          </h2>
          <div className="space-y-4">
            {logs
              .filter((l) => l.reviewText)
              .map((l, idx) => (
                <div key={`rev-${l.id}-${idx}`} className="bg-lb-surface border border-lb-elevated p-4 rounded text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <Link to={`/film/${l.movieId}`} className="font-bold text-white text-sm hover:text-lb-green">
                      {l.movieTitle} ({l.movieYear})
                    </Link>
                    <span className="text-lb-muted">{l.watchedDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lb-green font-bold">★ {l.rating}</span>
                    {l.liked && <Heart className="w-3.5 h-3.5 fill-lb-orange text-lb-orange" />}
                  </div>
                  <p className="text-lb-white leading-relaxed">{l.reviewText}</p>
                </div>
              ))}
          </div>
        </div>
      );
    }

    if (tabId === 'activity') {
      return (
        <div className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest font-bold text-lb-text border-b border-lb-elevated pb-2">
            Activity
          </h2>
          {logs.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm text-white font-semibold">{t('person_nothing')}</p>
              <p className="text-xs text-lb-muted">{t('pp_activity_empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {logs.map((log, idx) => (
                <PosterCard
                  key={`act-${log.id}-${idx}`}
                  size="fluid"
                  movie={{
                    id: log.movieId,
                    title: log.movieTitle,
                    poster_path: log.moviePoster,
                    release_date: log.movieYear,
                  }}
                  showDetails
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    if (tabId === 'watchlist') {
      return (
        <div className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest font-bold text-lb-text border-b border-lb-elevated pb-2">
            {t('hdr_watchlist')} ({viewWatchlistCount})
          </h2>
          {viewWatchlistCount === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm text-white font-semibold">{t('person_nothing')}</p>
              <p className="text-xs text-lb-muted">{t('pp_watchlist_empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {watchlist.map((m) => (
                <PosterCard
                  key={`wl-${m.id}`}
                  size="fluid"
                  movie={{
                    id: m.id,
                    title: m.title,
                    poster_path:
                      m.poster_path && m.poster_path.startsWith('http')
                        ? null
                        : m.poster_path,
                    release_date: m.release_date,
                  }}
                  showDetails
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    if (tabId === 'lists') {
      return (
        <div className="space-y-4">
          <h2 className="hidden md:block text-xs uppercase tracking-widest font-bold text-lb-text border-b border-lb-elevated pb-2">
            {t('nav_lists')} ({viewListsCount})
          </h2>
          {lists.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm text-white font-semibold">{t('person_nothing')}</p>
            </div>
          ) : (
            <>
              {/* Mobile Letterboxd Profile Lists strip */}
              <div className="md:hidden -mx-4 divide-y divide-white/10 border-b border-white/10">
                {lists.map((list) => {
                  const count = list.movies.length;
                  const countLabel = `${count} ${count === 1 ? 'film' : t('home_films_word')}`;
                  const previewMovies = list.movies.slice(0, 5);
                  return (
                    <Link
                      key={list.id}
                      to={`/list/${list.id}`}
                      className="block px-4 py-3.5 active:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-2.5">
                        <h3 className="text-[15px] font-bold text-white leading-snug truncate">
                          {list.title}
                        </h3>
                        <span className="text-[12px] text-[#99aabb] shrink-0 tabular-nums">
                          {countLabel}
                        </span>
                      </div>
                      {previewMovies.length > 0 && (
                        <div className="flex items-center w-full">
                          {previewMovies.map((m, idx) => {
                            const posterUrl = m.poster_path
                              ? tmdb.getImageUrl(m.poster_path, 'w185')
                              : null;
                            return (
                              <div
                                key={`${m.id}-${idx}`}
                                className="w-[20%] aspect-[2/3] bg-[#1c2228] overflow-hidden border-y border-r first:border-l border-white/15 first:rounded-l-[4px] last:rounded-r-[4px] shrink-0"
                              >
                                {posterUrl ? (
                                  <img
                                    loading="lazy"
                                    decoding="async"
                                    src={posterUrl}
                                    alt={m.title}
                                    className="w-full h-full object-cover block"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[#556677]">
                                    <Film className="w-5 h-5" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Desktop grid */}
              <div className="hidden md:grid md:grid-cols-2 gap-4">
                {lists.map((list) => (
                  <Link
                    key={list.id}
                    to={`/list/${list.id}`}
                    className="bg-lb-surface border border-lb-elevated hover:border-lb-green rounded p-4 transition-colors block"
                  >
                    <h3 className="text-sm font-bold text-white">{list.title}</h3>
                    <p className="text-xs text-lb-muted mt-1">{list.movies.length} {t('home_films_word')}</p>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Mobile floating green + button */}
          <Link
            to="/list/new"
            aria-label={t('create_list_title')}
            className="md:hidden fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-40 w-[52px] h-[52px] rounded-[16px] bg-[#00e054] hover:bg-[#00c84a] active:scale-95 text-[#14181c] shadow-[0_6px_20px_rgba(0,0,0,0.65)] flex items-center justify-center transition-transform"
          >
            <Plus className="w-6 h-6 stroke-[2.75]" />
          </Link>
        </div>
      );
    }

    if (tabId === 'likes') {
      return (
        <div className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest font-bold text-lb-text border-b border-lb-elevated pb-2">
            {t('pp_likes')}
          </h2>
          {likedMovies.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm text-white font-semibold">{t('person_nothing')}</p>
              <p className="text-xs text-lb-muted">{t('pp_likes_empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {likedMovies.map((m) => (
                <PosterCard key={`like-${m.id}`} movie={m} size="fluid" showDetails />
              ))}
            </div>
          )}
        </div>
      );
    }

    if (tabId === 'tags') {
      return (
        <div className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest font-bold text-lb-text border-b border-lb-elevated pb-2">
            {t('pp_tags')}
          </h2>
          <div className="py-12 text-center space-y-2">
            <p className="text-sm text-white font-semibold">{t('person_nothing')}</p>
            <p className="text-xs text-lb-muted">{t('pp_tags_empty')}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h2 className="text-xs uppercase tracking-widest font-bold text-lb-text border-b border-lb-elevated pb-2">
          {t('pp_network')}
        </h2>
        <div className="py-12 text-center space-y-2">
          <p className="text-sm text-white font-semibold">{t('person_nothing')}</p>
          <p className="text-xs text-lb-muted">{t('pp_network_empty')}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[950px] mx-auto px-4 py-8 space-y-6">
      {/* 0/1. Header + abas do perfil no mobile: renderizados pelo Header global
          (barra preta com ⚙ + usuário + Profile/Diary/Lists/Watchlist) */}

      {/* 1. Profile Header */}
      <div className="max-md:hidden flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 pt-2 pb-4">
        {/* Avatar & User Details */}
        <div className="flex items-center gap-5">
          {viewAvatar ? (
            <img loading="lazy" decoding="async"
              src={viewAvatar}
              alt={viewUsername}
              className="w-24 h-24 rounded-full object-cover border border-lb-border-light shadow-xl"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-lb-surface border border-lb-border-light shadow-xl flex items-center justify-center text-lb-muted">
              <User className="w-12 h-12" />
            </div>
          )}

          <div className="space-y-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {viewUsername}
            </h1>

            {!remote.isRemote && (
            <div className="flex items-center gap-2">
              <Link
                to="/settings?tab=profile"
                className="btn-edit-profile text-[10px] uppercase font-bold tracking-wider text-lb-white px-3 py-1 rounded-sm border border-lb-border-light/60 cursor-pointer"
              >
                {t('pp_edit_profile')}
              </Link>

              <Link
                to="/settings"
                className="bg-lb-elevated hover:bg-lb-border text-lb-text p-1 rounded-full cursor-pointer transition-colors"
                title={t('pp_account_settings')}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Link>
            </div>
            )}
          </div>
        </div>

        {/* User Statistics (Matching exact screenshot counts) */}
        <div className="flex items-center gap-6 sm:gap-8 text-center pt-2 tabular-nums">
          <div>
            <span className="block text-xl sm:text-2xl font-bold text-white tracking-tight">{viewFilmsCount}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-lb-muted">{t('nav_films')}</span>
          </div>
          <div>
            <span className="block text-xl sm:text-2xl font-bold text-white tracking-tight">{viewThisYearCount}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-lb-muted">{t('pp_this_year')}</span>
          </div>
          <div>
            <span className="block text-xl sm:text-2xl font-bold text-white tracking-tight">{viewListsCount}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-lb-muted">{t('nav_lists')}</span>
          </div>
          <div>
            <span className="block text-xl sm:text-2xl font-bold text-white tracking-tight">{viewFollowingCount}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-lb-muted">{t('pp_following')}</span>
          </div>
          <div>
            <span className="block text-xl sm:text-2xl font-bold text-white tracking-tight">{viewFollowersCount}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-lb-muted">{t('pp_followers')}</span>
          </div>
        </div>
      </div>

      {/* 2. Subnav Tabs (Desktop) */}
      <div className="max-md:hidden border-y border-lb-elevated flex items-center justify-between text-xs font-semibold">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          {[
            { id: 'profile', label: t('nav_profile') },
            { id: 'activity', label: t('nav_activity') },
            { id: 'films', label: t('nav_films') },
            { id: 'diary', label: t('hdr_diary') },
            { id: 'reviews', label: t('reviews_label') },
            { id: 'watchlist', label: t('hdr_watchlist') },
            { id: 'lists', label: t('nav_lists') },
            { id: 'likes', label: t('pp_likes') },
            { id: 'tags', label: t('pp_tags') },
            { id: 'network', label: t('pp_network') },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`py-3 border-b-2 tracking-wide transition-colors cursor-pointer whitespace-nowrap ${
                currentTab === tab.id
                  ? 'border-lb-green text-white'
                  : 'border-transparent text-lb-text hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-3 text-lb-muted">
          <Link
            to="/search"
            aria-label={t('search_label')}
            title={t('search_label')}
            className="p-1.5 hover:text-white transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 3. Mobile Profile layout (avatar, favorites, recent activity, ratings, counters) */}
      <div className="md:hidden">
        {currentTab === 'profile' ? (
          <div className="pt-0">
            {/* Big centered avatar */}
            <div className="flex flex-col items-center gap-2 pt-0 pb-5 border-b border-white/10 -mx-4 px-4 -mt-4">
              {viewAvatar ? (
                <img loading="lazy" decoding="async"
                  src={viewAvatar}
                  alt={viewUsername}
                  className="w-16 h-16 rounded-full object-cover border border-lb-border-light shadow-xl"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-lb-surface border border-lb-border-light shadow-xl flex items-center justify-center text-lb-muted">
                  <User className="w-8 h-8" />
                </div>
              )}
              {user.displayName && remote.isRemote === false && (
                <span className="text-xs text-lb-muted">{user.displayName}</span>
              )}
            </div>

            {/* FAVORITES (Top 4) */}
            {!remote.isRemote && (
              <section className="space-y-2 pt-6 pb-6 border-b border-white/10 -mx-4 px-4">
                <h2 className="text-xs uppercase tracking-widest text-lb-muted font-bold">
                  {t('pp_favorites')}
                </h2>
                <div className="grid grid-cols-4 gap-1.5">
                  {top4Movies.map((movie, idx) => (
                    <div
                      key={`mob-fav-${idx}`}
                      className="relative aspect-[2/3] bg-lb-surface rounded-xs overflow-hidden border border-white/12 shadow-md"
                    >
                      {movie ? (
                        <Link to={`/film/${movie.id}`} title={movie.title}>
                          <img loading="lazy" decoding="async"
                            src={tmdb.getImageUrl(movie.poster_path, 'w342')}
                            alt={movie.title}
                            className="w-full h-full object-cover"
                          />
                        </Link>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lb-muted text-[10px]">
                          #{idx + 1}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* RECENT ACTIVITY (4 posters with stars beneath) */}
            <section className="space-y-2 pt-6 pb-6 border-b border-white/10 -mx-4 px-4">
              <h2 className="text-xs uppercase tracking-widest text-lb-muted font-bold">
                {t('pp_recent_activity')}
              </h2>
              {recentLogs.length === 0 ? (
                <p className="text-xs text-lb-muted py-2">
                  {t('pp_recent_empty')}
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {recentLogs.map((log, idx) => (
                    <div key={`mob-recent-${log.id}-${idx}`}>
                      <div className="aspect-[2/3] bg-lb-surface rounded-xs overflow-hidden border border-white/12 shadow-md">
                        <Link to={`/film/${log.movieId}`}>
                          <img loading="lazy" decoding="async"
                            src={tmdb.getImageUrl(log.moviePoster, 'w342')}
                            alt={log.movieTitle}
                            className="w-full h-full object-cover"
                          />
                        </Link>
                      </div>
                      {log.rating > 0 && (
                        <p className="mt-1 text-center text-[10px] text-lb-green font-semibold">
                          {'★'.repeat(Math.round(log.rating))}
                          {log.rating % 1 !== 0 ? '½' : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* RATINGS histogram */}
            {ratedLogs.length > 0 && (
              <section className="space-y-2 pt-6 pb-6 border-b border-white/10 -mx-4 px-4">
                <RatingHistogram averageRating={avgRating} voteCount={ratedLogs.length} />
              </section>
            )}

            {/* Counters list */}
            <nav className="flex flex-col tabular-nums">
              {mobileCounters.map((c) => (
                <Link
                  key={c.label}
                  to={c.to}
                  className="flex items-center justify-between py-3 text-sm text-white"
                >
                  <span>{c.label}</span>
                  <span className="flex items-center gap-2 text-lb-muted">
                    <span className="text-xs font-semibold">{c.count}</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        ) : (
          renderTabBody(currentTab)
        )}
      </div>

      {/* 4. Desktop Tab Content */}
      <div className="max-md:hidden">
        {renderTabBody(currentTab)}
      </div>

      {/* Edit Profile Modal */}
      {isEditingBio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-lb-surface border border-lb-elevated w-full max-w-md rounded p-6 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
              {t('pp_edit_profile_title')}
            </h3>
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block text-lb-muted uppercase font-bold mb-1">{t('pp_display_name')}</label>
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  className="w-full bg-lb-bg border border-lb-elevated rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-lb-muted uppercase font-bold mb-1">{t('cfg_bio')}</label>
                <textarea
                  rows={3}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full bg-lb-bg border border-lb-elevated rounded p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingBio(false)}
                  className="px-3 py-1.5 text-lb-muted hover:text-white"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-lb-green text-lb-bg font-bold rounded"
                >
                  {t('btn_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
