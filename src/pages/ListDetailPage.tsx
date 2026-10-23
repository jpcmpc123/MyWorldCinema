import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Heart,
  Trash2,
  ArrowLeft,
  User,
  MoreVertical,
  Film,
  Send,
  Share2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { tmdb } from '../services/tmdb';
import { useLanguage } from '../i18n/LanguageContext';

interface ListComment {
  id: string;
  username: string;
  avatarUrl: string;
  text: string;
  createdAt: string;
}

export const ListDetailPage: React.FC = () => {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lists, deleteList, user, watchedMovieIds, logs } = useApp();
  const { isAuthenticated, profile } = useAuth();

  const list = lists.find((l) => l.id === id);
  const [likedList, setLikedList] = useState(false);

  // Mobile states
  const [activeTab, setActiveTab] = useState<'films' | 'comments'>('films');
  const [mobileViewMode, setMobileViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<'default' | 'reverse' | 'title' | 'newest' | 'oldest'>('default');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Comments state (persisted per list in localStorage)
  const commentsKey = `mw_list_comments_${id || ''}`;
  const [comments, setComments] = useState<ListComment[]>(() => {
    if (!id) return [];
    try {
      const saved = localStorage.getItem(`mw_list_comments_${id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [commentText, setCommentText] = useState('');

  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const currentUsername = isAuthenticated && profile ? profile.username : user.username;
  const currentAvatar =
    isAuthenticated && profile?.avatar_url ? profile.avatar_url : user.avatarUrl;

  const watchedSet = useMemo(() => {
    const s = new Set<number>(watchedMovieIds);
    logs.forEach((l) => s.add(l.movieId));
    return s;
  }, [watchedMovieIds, logs]);

  if (!list) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-white mb-2">{t('lists_not_found')}</h2>
        <Link to="/lists" className="text-sm text-lb-green hover:underline">
          {t('lists_return')}
        </Link>
      </div>
    );
  }

  const authorUsername =
    list.author.username && list.author.username !== 'visitante'
      ? list.author.username
      : currentUsername;
  const authorAvatar = list.author.avatarUrl || currentAvatar;
  const isAuthor =
    list.author.username === user.username ||
    list.author.username === currentUsername;

  const totalLikes = list.likesCount + (likedList ? 1 : 0);

  const watchedCount = list.movies.filter((m) => watchedSet.has(m.id)).length;
  const watchedPercent =
    list.movies.length > 0
      ? Math.round((watchedCount / list.movies.length) * 100)
      : 0;

  const sortedMovies = (() => {
    const indexed = list.movies.map((m, idx) => ({ movie: m, rank: idx + 1 }));
    if (sortMode === 'reverse') return [...indexed].reverse();
    if (sortMode === 'title') {
      return [...indexed].sort((a, b) => a.movie.title.localeCompare(b.movie.title));
    }
    if (sortMode === 'newest') {
      return [...indexed].sort((a, b) =>
        (b.movie.release_date || '').localeCompare(a.movie.release_date || ''),
      );
    }
    if (sortMode === 'oldest') {
      return [...indexed].sort((a, b) =>
        (a.movie.release_date || '').localeCompare(b.movie.release_date || ''),
      );
    }
    return indexed;
  })();

  const handleConfirmDelete = () => {
    deleteList(list.id);
    navigate(`/${encodeURIComponent(currentUsername)}/lists`, { replace: true });
  };

  const handleShare = async () => {
    setMoreSheetOpen(false);
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: list.title, url });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed) return;
    const newComment: ListComment = {
      id: `c-${Date.now()}`,
      username: currentUsername,
      avatarUrl: currentAvatar,
      text: trimmed,
      createdAt: new Date().toLocaleDateString(),
    };
    const next = [...comments, newComment];
    setComments(next);
    setCommentText('');
    try {
      localStorage.setItem(commentsKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  return (
    <>
      {/* =====================================================================
          MOBILE LAYOUT (< 768px) — Estilo nativo Letterboxd (List Detail)
          ===================================================================== */}
      <div className="md:hidden min-h-screen bg-[#14181c] flex flex-col">
        {/* Top Black Header + Tabs (Films / Comment) */}
        <header className="sticky top-0 z-40 bg-black select-none">
          {/* Row 1: ← List | Filter | ⋮ */}
          <div className="h-[52px] px-4 flex items-center justify-between">
            <div className="flex items-center">
              <button
                type="button"
                aria-label="Back"
                onClick={() => navigate(-1)}
                className="min-w-[44px] min-h-[44px] -ml-2.5 flex items-center justify-center text-white active:opacity-70 cursor-pointer"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.25]" />
              </button>
              <h1 className="text-[19px] font-bold text-white tracking-tight ml-3">
                List
              </h1>
            </div>

            <div className="flex items-center gap-1 -mr-2">
              {/* Filter / Sort Button */}
              <div ref={sortMenuRef} className="relative">
                <button
                  type="button"
                  aria-label="Sort list"
                  onClick={() => setSortMenuOpen((v) => !v)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white active:opacity-70 cursor-pointer"
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  >
                    <line x1="4" y1="7" x2="20" y2="7" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                    <line x1="10" y1="17" x2="14" y2="17" />
                  </svg>
                </button>

                {sortMenuOpen && (
                  <div className="absolute right-0 top-[46px] w-48 bg-[#2c3440] border border-white/15 rounded-[6px] shadow-2xl py-1.5 z-50 text-[13px] text-[#ccddee]">
                    {(
                      [
                        { key: 'default', label: 'List order' },
                        { key: 'reverse', label: 'Reverse order' },
                        { key: 'title', label: 'Film name' },
                        { key: 'newest', label: 'Release date (newest)' },
                        { key: 'oldest', label: 'Release date (oldest)' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setSortMode(opt.key);
                          setSortMenuOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 hover:bg-white/10 cursor-pointer flex items-center justify-between ${
                          sortMode === opt.key ? 'text-[#00e054] font-semibold' : 'text-white'
                        }`}
                      >
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* More (⋮) Button -> abre Bottom Sheet igual ao Letterboxd */}
              <button
                type="button"
                aria-label="More options"
                onClick={() => {
                  setSortMenuOpen(false);
                  setMoreSheetOpen(true);
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white active:opacity-70 cursor-pointer"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Row 2: Tabs (Films | Comment) */}
          <div className="grid grid-cols-2 h-[42px] border-b border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('films')}
              className={`relative h-full flex items-center justify-center text-[13.5px] font-semibold transition-colors cursor-pointer ${
                activeTab === 'films' ? 'text-white' : 'text-[#99aabb]'
              }`}
            >
              <span>Films</span>
              {activeTab === 'films' && (
                <span className="absolute bottom-0 inset-x-0 h-[3px] bg-[#00e054]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`relative h-full flex items-center justify-center text-[13.5px] font-semibold transition-colors cursor-pointer ${
                activeTab === 'comments' ? 'text-white' : 'text-[#99aabb]'
              }`}
            >
              <span>
                Comment{comments.length > 0 ? ` (${comments.length})` : ''}
              </span>
              {activeTab === 'comments' && (
                <span className="absolute bottom-0 inset-x-0 h-[3px] bg-[#00e054]" />
              )}
            </button>
          </div>
        </header>

        {activeTab === 'films' ? (
          <div className="flex-1 pb-8">
            {/* List Metadata Section */}
            <div className="px-3.5 pt-3.5 pb-3">
              {/* Author Row + View Mode Toggle Icon */}
              <div className="flex items-center justify-between mb-2">
                <Link
                  to={`/${encodeURIComponent(authorUsername)}`}
                  className="inline-flex items-center gap-2 group"
                >
                  {authorAvatar ? (
                    <img
                      loading="lazy"
                      decoding="async"
                      src={authorAvatar}
                      alt={authorUsername}
                      className="w-6 h-6 rounded-full object-cover border border-white/15"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#2c3440] flex items-center justify-center text-[#99aabb]">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <span className="text-[13.5px] font-semibold text-[#99aabb] group-hover:text-white transition-colors">
                    {authorUsername}
                  </span>
                </Link>

                {/* Letterboxd View Switcher Icon (2 squares + lines) */}
                <button
                  type="button"
                  aria-label="Toggle view mode"
                  onClick={() =>
                    setMobileViewMode((v) => (v === 'grid' ? 'list' : 'grid'))
                  }
                  className="w-9 h-9 -mr-1.5 flex items-center justify-center text-[#99aabb] hover:text-white active:opacity-70 cursor-pointer"
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2.5" y="3.5" width="4.5" height="4.5" rx="0.8" />
                    <line x1="10" y1="4.5" x2="17.5" y2="4.5" />
                    <line x1="10" y1="7.2" x2="17.5" y2="7.2" />
                    <rect x="2.5" y="12" width="4.5" height="4.5" rx="0.8" />
                    <line x1="10" y1="13" x2="17.5" y2="13" />
                    <line x1="10" y1="15.7" x2="17.5" y2="15.7" />
                  </svg>
                </button>
              </div>

              {/* List Title */}
              <h2 className="text-[19px] font-extrabold text-white tracking-tight leading-snug">
                {list.title}
              </h2>

              {/* Description (se existir) */}
              {list.description && (
                <p className="text-[13.5px] text-[#99aabb] leading-relaxed mt-1.5">
                  {list.description}
                </p>
              )}

              {/* Likes + Watched % Row */}
              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={() => setLikedList((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] cursor-pointer active:opacity-75"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      likedList
                        ? 'fill-[#ff8000] text-[#ff8000]'
                        : 'text-[#667788]'
                    }`}
                  />
                  <span className={likedList ? 'text-[#99aabb]' : 'text-[#667788]'}>
                    {totalLikes === 0
                      ? 'No likes yet'
                      : `${totalLikes} ${totalLikes === 1 ? 'like' : 'likes'}`}
                  </span>
                </button>

                <div className="inline-flex items-center gap-1.5 text-[12.5px] text-[#40bcf4] font-medium tabular-nums">
                  {/* Letterboxd Blue Eye Icon */}
                  <svg
                    className="w-4 h-4 text-[#40bcf4]"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 5C6.5 5 2 9.5 1 12c1 2.5 5.5 7 11 7s10-4.5 11-7c-1-2.5-5.5-7-11-7zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
                  </svg>
                  <span>{watchedPercent}%</span>
                </div>
              </div>
            </div>

            {/* Films 4-Column Poster Grid or Compact List */}
            {mobileViewMode === 'grid' ? (
              <div
                className={`px-3.5 pt-1 grid grid-cols-4 gap-x-2 ${
                  list.isRanked ? 'gap-y-4' : 'gap-y-2'
                }`}
              >
                {sortedMovies.map(({ movie: m, rank }) => {
                  const posterUrl = m.poster_path
                    ? tmdb.getImageUrl(m.poster_path, 'w342')
                    : null;
                  return (
                    <Link
                      key={m.id}
                      to={`/film/${m.id}`}
                      className="relative aspect-[2/3] block"
                    >
                      <div className="w-full h-full rounded-[4px] overflow-hidden border border-white/15 bg-[#1c2228]">
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

                      {/* Números exibidos SOMENTE quando a lista foi marcada como Ranked */}
                      {list.isRanked && (
                        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#2c3440] border border-[#445566] text-[11px] font-semibold text-[#99aabb] flex items-center justify-center shadow-md tabular-nums z-10">
                          {rank}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="divide-y divide-white/10 border-t border-b border-white/10 mt-1">
                {sortedMovies.map(({ movie: m, rank }) => {
                  const year = m.release_date?.slice(0, 4) || '';
                  const posterUrl = m.poster_path
                    ? tmdb.getImageUrl(m.poster_path, 'w185')
                    : null;
                  return (
                    <Link
                      key={m.id}
                      to={`/film/${m.id}`}
                      className="px-3.5 py-2.5 flex items-center gap-3.5 active:bg-white/[0.03]"
                    >
                      <div className="relative w-[42px] aspect-[2/3] shrink-0">
                        <div className="w-full h-full rounded-[3px] overflow-hidden border border-white/15 bg-[#1c2228]">
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
                              <Film className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        {list.isRanked && (
                          <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-[#1c2228] border border-white/25 text-[11px] font-bold text-white flex items-center justify-center shadow tabular-nums">
                            {rank}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-[15px] font-bold text-white leading-snug">
                            {m.title}
                          </span>
                          {year && (
                            <span className="text-[13px] text-[#778899] tabular-nums">
                              {year}
                            </span>
                          )}
                        </div>
                        {m.notes && (
                          <p className="text-[12px] text-[#99aabb] mt-0.5 line-clamp-2">
                            {m.notes}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Comment Tab */
          <div className="flex-1 flex flex-col justify-between p-4 pb-8">
            {comments.length === 0 ? (
              <div className="py-16 text-center text-[13px] text-[#667788]">
                No comments yet.
              </div>
            ) : (
              <div className="divide-y divide-white/10 mb-4">
                {comments.map((c) => (
                  <div key={c.id} className="py-3 flex gap-3 items-start">
                    {c.avatarUrl ? (
                      <img
                        src={c.avatarUrl}
                        alt={c.username}
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#2c3440] flex items-center justify-center text-[#99aabb] shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-bold text-white">
                          {c.username}
                        </span>
                        <span className="text-[11px] text-[#667788]">{c.createdAt}</span>
                      </div>
                      <p className="text-[13.5px] text-[#ccddee] mt-1 leading-relaxed">
                        {c.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-2 border-t border-white/10">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-[#2c3440] rounded-[4px] px-3 py-2 text-[14px] text-white placeholder-[#778899] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="h-9 px-3 rounded-[4px] bg-[#00e054] text-[#14181c] font-bold text-xs disabled:opacity-40 flex items-center justify-center cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Bottom Sheet dos 3 pontinhos (⋮) — Fiel ao app do Letterboxd */}
        {moreSheetOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMoreSheetOpen(false)}
            />
            <div className="relative bg-[#3b4856] rounded-t-[24px] pb-[calc(14px+env(safe-area-inset-bottom,0px))] shadow-[0_-10px_30px_rgba(0,0,0,0.65)] select-none">
              {/* Handle pill */}
              <div className="w-9 h-1 rounded-full bg-[#1e262e] mx-auto mt-3 mb-3.5" />

              {/* Cabeçalho do Bottom Sheet: Título da lista + contagem de filmes */}
              <div className="px-6 pb-3.5 border-b border-white/10">
                <h3 className="text-[16px] font-semibold text-white leading-snug truncate">
                  {list.title}
                </h3>
                <p className="text-[13.5px] text-[#99aabb] mt-0.5 tabular-nums">
                  {list.movies.length} {list.movies.length === 1 ? 'film' : 'films'}
                </p>
              </div>

              {/* Ações do Bottom Sheet */}
              <div className="py-2">
                {isAuthor && (
                  <button
                    type="button"
                    onClick={() => {
                      setMoreSheetOpen(false);
                      setDeleteConfirmOpen(true);
                    }}
                    className="w-full px-6 py-3 flex items-center gap-5 text-[#ff8000] active:bg-white/5 cursor-pointer text-left"
                  >
                    {/* Filled Orange Trash Icon */}
                    <svg
                      className="w-5 h-5 shrink-0 fill-current"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                    <span className="text-[15px] font-normal">Delete</span>
                  </button>
                )}

                {isAuthor && (
                  <button
                    type="button"
                    onClick={() => {
                      setMoreSheetOpen(false);
                      navigate(`/list/${list.id}/edit`);
                    }}
                    className="w-full px-6 py-3 flex items-center gap-5 text-[#99aabb] hover:text-white active:bg-white/5 cursor-pointer text-left"
                  >
                    {/* Filled Pencil Icon */}
                    <svg
                      className="w-5 h-5 shrink-0 fill-current"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" />
                    </svg>
                    <span className="text-[15px] font-normal">Edit</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMoreSheetOpen(false);
                    setCarouselOpen(true);
                  }}
                  className="w-full px-6 py-3 flex items-center gap-5 text-[#99aabb] hover:text-white active:bg-white/5 cursor-pointer text-left"
                >
                  {/* Carousel Icon (center card + two side cards) */}
                  <svg
                    className="w-5 h-5 shrink-0 fill-current"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M7 19h10V4H7v15zm-5-2h4V6H2v11zM18 6v11h4V6h-4z" />
                  </svg>
                  <span className="text-[15px] font-normal">View in carousel</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="w-full px-6 py-3 flex items-center gap-5 text-[#99aabb] hover:text-white active:bg-white/5 cursor-pointer text-left"
                >
                  <Share2 className="w-5 h-5 shrink-0" />
                  <span className="text-[15px] font-normal">Share</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Visualização em Carrossel (View in carousel) */}
        {carouselOpen && (
          <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
            <header className="h-[56px] px-4 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h3 className="text-[16px] font-bold text-white truncate">
                  {list.title}
                </h3>
                <p className="text-[12px] text-[#99aabb] tabular-nums">
                  {list.movies.length} {list.movies.length === 1 ? 'film' : 'films'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close carousel"
                onClick={() => setCarouselOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </header>

            <div className="flex-1 flex items-center overflow-x-auto snap-x snap-mandatory px-8 gap-5">
              {sortedMovies.map(({ movie: m, rank }) => {
                const year = m.release_date?.slice(0, 4) || '';
                const posterUrl = m.poster_path
                  ? tmdb.getImageUrl(m.poster_path, 'w500')
                  : null;
                return (
                  <Link
                    key={m.id}
                    to={`/film/${m.id}`}
                    onClick={() => setCarouselOpen(false)}
                    className="snap-center shrink-0 w-[76vw] max-w-[300px] flex flex-col items-center text-center"
                  >
                    <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden border border-white/15 bg-[#1c2228] shadow-2xl">
                      {posterUrl ? (
                        <img
                          src={posterUrl}
                          alt={m.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#556677]">
                          <Film className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <div className="mt-4 space-y-1">
                      {list.isRanked && (
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-[#2c3440] border border-[#445566] text-[12px] font-bold text-[#99aabb] tabular-nums">
                          #{rank}
                        </span>
                      )}
                      <h4 className="text-[17px] font-bold text-white leading-snug">
                        {m.title}
                      </h4>
                      {year && (
                        <p className="text-[13px] text-[#778899] tabular-nums">{year}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Toast sutil de link copiado */}
        {shareCopied && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#2c3440] border border-white/15 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl">
            Link copied
          </div>
        )}

        {/* Modal de confirmação de exclusão sem usar window.confirm */}
        {deleteConfirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-[#2c3440] border border-white/15 rounded-xl p-5 max-w-xs w-full space-y-4 text-center">
              <p className="text-[15px] font-bold text-white">
                {t('lists_delete_confirm')}
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="flex-1 py-2 rounded-lg bg-white/10 text-white text-xs font-bold cursor-pointer"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2 rounded-lg bg-[#ff4455] text-white text-xs font-bold cursor-pointer"
                >
                  {t('lists_delete_title')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          DESKTOP LAYOUT (>= 768px) — Inalterado
          ===================================================================== */}
      <div className="hidden md:block max-w-[950px] mx-auto px-4 py-8 space-y-8">
        <Link
          to="/lists"
          className="inline-flex items-center gap-1.5 text-xs text-lb-text hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('lists_back')}</span>
        </Link>

        {/* List Header */}
        <div className="border-b border-lb-elevated pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {list.title}
                </h1>
                {list.isRanked && (
                  <span className="text-[10px] bg-lb-elevated text-lb-green font-mono font-bold px-2 py-0.5 rounded">
                    {t('lists_ranked_list')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-lb-muted">
                {authorAvatar ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={authorAvatar}
                    alt={list.author.displayName}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-lb-elevated flex items-center justify-center text-lb-muted shrink-0">
                    <User className="w-3 h-3" />
                  </div>
                )}
                <span className="text-white font-semibold">{list.author.displayName}</span>
                <span>• {list.movies.length} {t('home_films_word')}</span>
              </div>

              <p className="text-xs sm:text-sm text-lb-white leading-relaxed pt-2">
                {list.description}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setLikedList((v) => !v)}
                aria-pressed={likedList}
                className={`flex items-center gap-1.5 px-3 py-1.5 bg-lb-surface border text-xs font-semibold rounded transition-colors cursor-pointer ${
                  likedList
                    ? 'border-lb-orange text-lb-orange'
                    : 'border-lb-elevated hover:border-lb-orange text-lb-muted hover:text-lb-orange'
                }`}
              >
                <Heart className={`w-4 h-4 ${likedList ? 'fill-lb-orange text-lb-orange' : ''}`} />
                <span>{totalLikes} {t('lists_likes')}</span>
              </button>

              {isAuthor && (
                <button
                  onClick={handleConfirmDelete}
                  className="p-1.5 bg-lb-surface border border-lb-elevated hover:border-lb-red text-lb-muted hover:text-lb-red rounded transition-colors cursor-pointer"
                  title={t('lists_delete_title')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* List Items */}
        <div className="space-y-4">
          {list.movies.map((m, idx) => {
            const posterUrl = m.poster_path
              ? tmdb.getImageUrl(m.poster_path, 'w185')
              : null;
            return (
              <div
                key={m.id}
                className="bg-lb-surface border border-lb-elevated rounded-lg p-4 flex gap-4 items-start group hover:border-lb-border-light transition-colors"
              >
                {/* Rank Number */}
                {list.isRanked && (
                  <span className="text-xl sm:text-2xl font-black font-mono text-lb-muted group-hover:text-lb-green w-8 shrink-0 text-right transition-colors">
                    {idx + 1}
                  </span>
                )}

                {/* Poster */}
                <Link to={`/film/${m.id}`} className="shrink-0">
                  {posterUrl ? (
                    <img
                      loading="lazy"
                      decoding="async"
                      src={posterUrl}
                      alt={m.title}
                      className="w-16 h-24 sm:w-20 sm:h-30 object-cover rounded shadow border border-white/10 group-hover:border-lb-green transition-colors"
                    />
                  ) : (
                    <div className="w-16 h-24 sm:w-20 sm:h-30 rounded shadow border border-white/10 bg-lb-elevated flex items-center justify-center text-lb-muted">
                      <Film className="w-6 h-6" />
                    </div>
                  )}
                </Link>

                {/* Movie Info & Custom Notes */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Link
                      to={`/film/${m.id}`}
                      className="font-bold text-white text-base sm:text-lg hover:text-lb-green transition-colors"
                    >
                      {m.title}
                    </Link>
                    <span className="text-xs text-lb-muted">{m.release_date?.slice(0, 4)}</span>
                  </div>

                  {m.notes ? (
                    <p className="text-xs text-lb-text italic bg-lb-bg p-2.5 rounded border border-lb-elevated">
                      "{m.notes}"
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

