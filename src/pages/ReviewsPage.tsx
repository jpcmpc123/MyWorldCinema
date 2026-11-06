import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageSquare, Plus, Trash2, Eye, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { tmdb } from '../services/tmdb';
import { smartImgRef, smartImgOnLoad } from '../components/PosterCard';
import { useLanguage } from '../i18n/LanguageContext';

interface CommunityReviewItem {
  id: string;
  logId?: string;
  movieId: number;
  movieTitle: string;
  moviePoster: string | null;
  movieYear: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  rating: number;
  liked: boolean;
  reviewText: string;
  containsSpoilers: boolean;
  watchedDate: string;
  createdAt: string;
  isOwn: boolean;
}

export const ReviewsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { user, logs, reviews, deleteLog, openLogModal, movieOverrides } = useApp();
  const { isAuthenticated, user: authUser, profile } = useAuth();

  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [remoteReviews, setRemoteReviews] = useState<CommunityReviewItem[]>([]);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());

  const currentUsername = isAuthenticated && profile ? profile.username : user.username;
  const currentDisplayName =
    isAuthenticated && profile?.display_name ? profile.display_name : user.displayName;
  const currentAvatar =
    isAuthenticated && profile?.avatar_url ? profile.avatar_url : user.avatarUrl;

  // Busca críticas públicas recentes do Supabase (film_logs com review_text preenchido)
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;

    const loadCommunityReviews = async () => {
      try {
        const { data: logRows, error } = await client
          .from('film_logs')
          .select(
            'id, user_id, film_id, film_title, film_poster, film_year, watched_on, rating, liked, review_text, contains_spoilers, created_at',
          )
          .not('review_text', 'is', null)
          .neq('review_text', '')
          .order('created_at', { ascending: false })
          .limit(60);

        if (cancelled || error || !logRows) return;

        const userIds = Array.from(new Set(logRows.map((r) => r.user_id).filter(Boolean)));
        const profileMap = new Map<
          string,
          { username: string; display_name: string; avatar_url: string }
        >();

        if (userIds.length > 0) {
          const { data: profilesData } = await client
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', userIds);

          if (profilesData) {
            for (const p of profilesData) {
              profileMap.set(p.id, {
                username: p.username,
                display_name: p.display_name || p.username,
                avatar_url: p.avatar_url || '',
              });
            }
          }
        }

        if (cancelled) return;

        const mapped: CommunityReviewItem[] = logRows
          .filter((r) => typeof r.review_text === 'string' && r.review_text.trim().length > 0)
          .map((r) => {
            const prof = profileMap.get(r.user_id);
            const isOwn = Boolean(authUser && r.user_id === authUser.id);
            return {
              id: `remote-${r.id}`,
              logId: String(r.id),
              movieId: r.film_id,
              movieTitle: r.film_title || 'Untitled',
              moviePoster: r.film_poster ?? null,
              movieYear: r.film_year ? String(r.film_year) : '',
              authorUsername: prof?.username || (isOwn ? currentUsername : 'member'),
              authorDisplayName:
                prof?.display_name || (isOwn ? currentDisplayName : 'Member'),
              authorAvatarUrl: prof?.avatar_url || (isOwn ? currentAvatar : ''),
              rating: Number(r.rating) || 0,
              liked: Boolean(r.liked),
              reviewText: String(r.review_text).trim(),
              containsSpoilers: Boolean(r.contains_spoilers),
              watchedDate: r.watched_on || '',
              createdAt: r.created_at || '',
              isOwn,
            };
          });

        setRemoteReviews(mapped);
      } catch {
        // Ignora erro de rede silenciosamente e usa críticas locais
      }
    };

    void loadCommunityReviews();
    const onRefresh = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ registerPromise?: (p: Promise<unknown>) => void }>;
      customEvt.detail?.registerPromise?.(loadCommunityReviews());
    };
    window.addEventListener('mw:pull-to-refresh', onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('mw:pull-to-refresh', onRefresh);
    };
  }, [authUser, currentUsername, currentDisplayName, currentAvatar]);

  // Mescla críticas locais (do próprio usuário) + críticas remotas sem duplicar
  const allReviewItems = useMemo<CommunityReviewItem[]>(() => {
    const localFromLogs: CommunityReviewItem[] = logs
      .filter((l) => l.reviewText && l.reviewText.trim().length > 0)
      .map((l) => ({
        id: `local-${l.id}`,
        logId: l.id,
        movieId: l.movieId,
        movieTitle: l.movieTitle,
        moviePoster: l.moviePoster,
        movieYear: l.movieYear,
        authorUsername: currentUsername,
        authorDisplayName: currentDisplayName,
        authorAvatarUrl: currentAvatar,
        rating: l.rating,
        liked: l.liked,
        reviewText: l.reviewText.trim(),
        containsSpoilers: l.containsSpoilers,
        watchedDate: l.watchedDate,
        createdAt: l.createdAt,
        isOwn: true,
      }));

    const seenLogIds = new Set(localFromLogs.map((item) => item.logId).filter(Boolean));
    const localStandalone: CommunityReviewItem[] = reviews
      .filter((r) => r.content && r.content.trim().length > 0)
      .filter((r) => {
        const rawLogId = r.id.replace(/^rev-/, '');
        return !seenLogIds.has(rawLogId);
      })
      .map((r) => ({
        id: `rev-${r.id}`,
        logId: r.id.replace(/^rev-/, ''),
        movieId: r.movieId,
        movieTitle: r.movieTitle,
        moviePoster: r.moviePoster,
        movieYear: r.movieYear,
        authorUsername: r.author.username || currentUsername,
        authorDisplayName: r.author.displayName || currentDisplayName,
        authorAvatarUrl: r.author.avatarUrl || currentAvatar,
        rating: r.rating,
        liked: r.liked,
        reviewText: r.content.trim(),
        containsSpoilers: r.containsSpoilers,
        watchedDate: r.watchedDate || '',
        createdAt: r.createdAt,
        isOwn: r.author.username === currentUsername,
      }));

    const combined = [...localFromLogs, ...localStandalone];
    const existingKeys = new Set(
      combined.map((c) => `${c.logId || ''}:${c.movieId}:${c.reviewText.slice(0, 40)}`),
    );

    for (const rem of remoteReviews) {
      const key = `${rem.logId || ''}:${rem.movieId}:${rem.reviewText.slice(0, 40)}`;
      if (!existingKeys.has(key) && (!rem.logId || !seenLogIds.has(rem.logId))) {
        combined.push(rem);
        existingKeys.add(key);
      }
    }

    return combined.sort((a, b) =>
      (b.watchedDate || b.createdAt || '').localeCompare(a.watchedDate || a.createdAt || ''),
    );
  }, [logs, reviews, remoteReviews, currentUsername, currentDisplayName, currentAvatar]);

  const years = useMemo(
    () =>
      Array.from(
        new Set(
          allReviewItems
            .map((r) => (r.watchedDate || r.createdAt || '').slice(0, 4))
            .filter((y) => /^\d{4}$/.test(y)),
        ),
      )
        .sort()
        .reverse(),
    [allReviewItems],
  );

  const filteredReviews = useMemo(
    () =>
      allReviewItems.filter((item) => {
        if (filterMode === 'mine' && !item.isOwn) return false;
        if (selectedYear !== 'all') {
          const itemYear = (item.watchedDate || item.createdAt || '').slice(0, 4);
          if (itemYear !== selectedYear) return false;
        }
        return true;
      }),
    [allReviewItems, filterMode, selectedYear],
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [language],
  );

  const formatReviewDate = (raw?: string | null) => {
    if (!raw) return '';
    const d = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    try {
      return dateFormatter.format(d);
    } catch {
      return raw;
    }
  };

  return (
    <div className="max-w-[950px] mx-auto px-4 pt-3 pb-6 md:py-8 space-y-4 md:space-y-6">
      {/* Mobile Header */}
      <div className="md:hidden space-y-2.5 border-b border-white/10 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-[15px] font-bold text-white tracking-tight">
            {t('reviews_page_title')}
          </h1>

          <div className="flex items-center gap-1.5">
            {isAuthenticated && (
              <div className="inline-flex rounded bg-lb-surface border border-white/15 p-0.5 text-[10px] font-bold uppercase">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2 py-0.5 rounded-xs transition-colors cursor-pointer ${
                    filterMode === 'all' ? 'bg-lb-green text-lb-bg' : 'text-lb-muted hover:text-white'
                  }`}
                >
                  {t('common_all')}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('mine')}
                  className={`px-2 py-0.5 rounded-xs transition-colors cursor-pointer ${
                    filterMode === 'mine' ? 'bg-lb-green text-lb-bg' : 'text-lb-muted hover:text-white'
                  }`}
                >
                  {t('reviews_filter_mine')}
                </button>
              </div>
            )}

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-lb-surface border border-white/15 text-[11px] font-semibold text-white rounded px-2 py-1 focus:outline-none focus:border-lb-green"
            >
              <option value="all">{t('diary_all_years')}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => openLogModal()}
              className="flex items-center gap-1 bg-lb-green hover:bg-lb-green-hover text-lb-bg font-black text-[11px] uppercase px-2.5 py-1 rounded-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>{t('nav_log')}</span>
            </button>
          </div>
        </div>
        <p className="text-[11px] text-lb-muted leading-snug">{t('reviews_page_desc')}</p>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex sm:flex-row sm:items-center justify-between gap-4 border-b border-lb-elevated pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {t('reviews_page_title')}
          </h1>
          <p className="text-xs text-lb-text mt-1">{t('reviews_page_desc')}</p>
        </div>

        <div className="flex items-center gap-2.5">
          {isAuthenticated && (
            <div className="inline-flex rounded bg-lb-surface border border-lb-elevated p-0.5 text-xs font-bold uppercase">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-xs transition-colors cursor-pointer ${
                  filterMode === 'all' ? 'bg-lb-green text-lb-bg' : 'text-lb-muted hover:text-white'
                }`}
              >
                {t('reviews_filter_all')}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('mine')}
                className={`px-3 py-1 rounded-xs transition-colors cursor-pointer ${
                  filterMode === 'mine' ? 'bg-lb-green text-lb-bg' : 'text-lb-muted hover:text-white'
                }`}
              >
                {t('reviews_filter_mine')}
              </button>
            </div>
          )}

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-lb-surface border border-lb-elevated text-xs text-white rounded px-3 py-1.5 focus:outline-none focus:border-lb-green"
          >
            <option value="all">{t('diary_all_years')}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => openLogModal()}
            className="flex items-center gap-1.5 bg-lb-green hover:bg-lb-green-hover text-lb-bg font-black text-xs uppercase px-3.5 py-1.5 rounded-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>{t('reviews_write_btn').replace(/^\+\s*/, '')}</span>
          </button>
        </div>
      </div>

      {/* Reviews List */}
      {filteredReviews.length > 0 ? (
        <div className="divide-y divide-white/10 md:divide-lb-elevated">
          {filteredReviews.map((entry) => {
            const rawPoster = movieOverrides[entry.movieId]?.poster || entry.moviePoster;
            const p500 = tmdb.getImageUrl(rawPoster, 'w500');
            const p780 = tmdb.getImageUrl(rawPoster, 'w780');
            const isSpoilerHidden =
              entry.containsSpoilers && !revealedSpoilers.has(entry.id);
            const displayDate = formatReviewDate(entry.watchedDate || entry.createdAt);

            return (
              <article
                key={entry.id}
                className="py-4 md:py-5 flex gap-3.5 md:gap-5 items-start"
              >
                <Link
                  to={`/film/${entry.movieId}`}
                  className="shrink-0 rounded-[4px] bg-lb-surface ring-1 ring-white/15 overflow-hidden hover:ring-lb-green transition-all"
                >
                  <img
                    ref={smartImgRef}
                    onLoad={smartImgOnLoad}
                    loading="lazy"
                    decoding="async"
                    src={p500}
                    srcSet={rawPoster ? `${p500} 1x, ${p780} 2x` : undefined}
                    alt={entry.movieTitle}
                    className="w-16 md:w-20 aspect-[2/3] object-cover mw-img-fade"
                  />
                </Link>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/film/${entry.movieId}`}
                        className="font-bold text-white text-sm md:text-base leading-tight hover:text-lb-green transition-colors"
                      >
                        {entry.movieTitle}
                      </Link>
                      {entry.movieYear && (
                        <span className="ml-1.5 text-xs font-normal text-lb-muted font-mono">
                          {entry.movieYear}
                        </span>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                        <Link
                          to={`/${encodeURIComponent(entry.authorUsername)}`}
                          className="inline-flex items-center gap-1.5 text-lb-muted hover:text-white font-semibold transition-colors"
                        >
                          {entry.authorAvatarUrl ? (
                            <img
                              src={entry.authorAvatarUrl}
                              alt={entry.authorDisplayName}
                              className="w-4 h-4 rounded-full object-cover border border-white/15"
                            />
                          ) : (
                            <User className="w-3.5 h-3.5 text-lb-muted" />
                          )}
                          <span>{entry.authorDisplayName || entry.authorUsername}</span>
                        </Link>

                        {entry.rating > 0 && (
                          <span className="text-lb-green font-bold tracking-tight tabular-nums">
                            {'★'.repeat(Math.floor(entry.rating))}
                            {entry.rating % 1 !== 0 ? '½' : ''}
                          </span>
                        )}

                        {entry.liked && (
                          <Heart className="w-3.5 h-3.5 fill-lb-orange text-lb-orange" />
                        )}

                        {displayDate && (
                          <span className="text-[11px] text-lb-muted">{displayDate}</span>
                        )}
                      </div>
                    </div>

                    {entry.isOwn && entry.logId && (
                      <button
                        type="button"
                        onClick={() => deleteLog(entry.logId!)}
                        title={t('diary_delete')}
                        className="text-lb-muted hover:text-lb-red p-1 rounded transition-colors shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {isSpoilerHidden ? (
                    <div className="bg-lb-surface/80 border border-white/10 rounded px-3 py-2.5 flex items-center justify-between gap-3">
                      <span className="text-xs text-lb-muted italic">
                        {t('spoiler_warning')}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedSpoilers((prev) => new Set(prev).add(entry.id))
                        }
                        className="inline-flex items-center gap-1 text-xs font-bold text-lb-green hover:underline cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t('reveal_spoiler')}</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs md:text-sm text-[#ddeeff] whitespace-pre-line leading-relaxed">
                      {entry.reviewText}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="bg-lb-surface/70 border border-white/10 rounded-lg px-6 py-10 md:p-12 text-center space-y-3">
          <MessageSquare className="w-9 h-9 text-lb-muted mx-auto" />
          <h3 className="text-sm md:text-base font-bold text-white">
            {t('reviews_empty_title')}
          </h3>
          <p className="text-xs text-lb-text max-w-sm mx-auto leading-relaxed">
            {t('reviews_empty_desc')}
          </p>
          <button
            type="button"
            onClick={() => openLogModal()}
            className="mt-1 inline-flex items-center gap-1.5 bg-lb-green hover:bg-lb-green-hover text-lb-bg font-black text-xs uppercase px-4 py-2 rounded-sm cursor-pointer transition-colors"
          >
            {t('reviews_write_btn')}
          </button>
        </div>
      )}
    </div>
  );
};

export default ReviewsPage;
