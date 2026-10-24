import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Plus, Heart, MessageSquare, Layers, Film } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { tmdb } from '../services/tmdb';
import { useLanguage } from '../i18n/LanguageContext';
import { parseProfileTabRoute } from '../utils/tabRoutes';

export const ListsPage: React.FC = () => {
  const { lists, user } = useApp();
  const { isAuthenticated, profile } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const { username: paramUsername } = useParams<{ username?: string }>();

  const displayUsername = isAuthenticated && profile ? profile.username : user.username;
  const isProfileListsView =
    Boolean(paramUsername) ||
    parseProfileTabRoute(location.pathname, displayUsername) !== null;

  return (
    <>
      {/* =====================================================================
          MOBILE PROFILE LISTS TAB (< 768px quando dentro do Perfil do Usuário)
          ===================================================================== */}
      {isProfileListsView && (
        <div className="md:hidden flex-1 flex flex-col bg-[#14181c] min-h-[calc(100vh-170px)] relative pb-20">
          {lists.length > 0 ? (
            <div className="divide-y divide-white/10 border-b border-white/10">
              {lists.map((list) => {
                const count = list.movies.length;
                const countLabel = `${count} ${count === 1 ? t('list_film_singular') : t('home_films_word')}`;
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
                            ? tmdb.getImageUrl(m.poster_path, 'w500')
                            : null;
                          const posterW780 = m.poster_path
                            ? tmdb.getImageUrl(m.poster_path, 'w780')
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
                                  srcSet={`${posterUrl} 1x, ${posterW780} 2x`}
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
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
              <p className="text-[15px] font-semibold text-white mb-1">{t('lists_empty_title')}</p>
              <p className="text-[12px] text-[#778899] max-w-xs leading-relaxed">
                {t('lists_empty_desc')}
              </p>
            </div>
          )}

          {/* Floating Green '+' Action Button (canto inferior direito acima da BottomNav) */}
          <Link
            to="/list/new"
            aria-label={t('create_list_title')}
            className="fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-40 w-[52px] h-[52px] rounded-[16px] bg-[#00e054] hover:bg-[#00c84a] active:scale-95 text-[#14181c] shadow-[0_6px_20px_rgba(0,0,0,0.65)] flex items-center justify-center transition-transform"
          >
            <Plus className="w-6 h-6 stroke-[2.75]" />
          </Link>
        </div>
      )}

      {/* =====================================================================
          DEFAULT LISTS PAGE (Desktop + Aba Principal de Listas no Mobile)
          ===================================================================== */}
      <div
        className={`${
          isProfileListsView ? 'hidden md:block' : ''
        } max-w-[950px] mx-auto px-4 pt-3 pb-4 md:py-8 space-y-4 md:space-y-8`}
      >
        {/* Mobile Header — padrão visual idêntico às seções de Filmes e Séries */}
        <div className="md:hidden space-y-2.5 border-b border-white/10 pb-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-[15px] font-bold text-white tracking-tight">
              {t('lists_title')}
            </h1>

            <Link
              to="/list/new"
              className="flex items-center gap-1 bg-lb-green hover:bg-lb-green-hover text-lb-bg font-black text-[11px] uppercase px-2.5 py-1 rounded-sm transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>{t('create_list_title')}</span>
            </Link>
          </div>
          <p className="text-[11px] text-lb-muted leading-snug">
            {t('lists_desc')}
          </p>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex sm:flex-row sm:items-center justify-between gap-4 border-b border-lb-elevated pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {t('lists_title')}
            </h1>
            <p className="text-xs text-lb-text mt-1">
              {t('lists_desc')}
            </p>
          </div>

          <Link
            to="/list/new"
            className="flex items-center gap-1.5 bg-lb-green hover:bg-lb-green-hover text-lb-bg font-black text-xs uppercase px-4 py-2 rounded-sm transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{t('lists_start')}</span>
          </Link>
        </div>

        {/* Grid of Lists or Empty State */}
        {lists.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {lists.map((list) => (
              <Link
                key={list.id}
                to={`/list/${list.id}`}
                className="bg-lb-surface border border-white/10 md:border-lb-elevated hover:border-lb-green rounded-lg p-4 md:p-5 transition-colors group block shadow-lg hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
              >
                {/* Overlapping poster fan */}
                <div className="flex items-center -space-x-8 mb-4 overflow-hidden pt-1 pb-2">
                  {list.movies.slice(0, 5).map((m, idx) => {
                    const posterUrl = m.poster_path
                      ? tmdb.getImageUrl(m.poster_path, 'w500')
                      : null;
                    const posterW780 = m.poster_path
                      ? tmdb.getImageUrl(m.poster_path, 'w780')
                      : null;
                    return posterUrl ? (
                      <img
                        loading="lazy"
                        decoding="async"
                        key={idx}
                        src={posterUrl}
                        srcSet={`${posterUrl} 1x, ${posterW780} 2x`}
                        alt={m.title}
                        className="w-20 aspect-[2/3] object-cover rounded shadow-lg border border-white/10 group-hover:translate-y-[-4px] transition-transform"
                        style={{ zIndex: 10 - idx }}
                      />
                    ) : (
                      <div
                        key={idx}
                        style={{ zIndex: 10 - idx }}
                        className="w-20 aspect-[2/3] rounded shadow-lg border border-white/10 bg-lb-elevated flex items-center justify-center text-lb-muted"
                      >
                        <Film className="w-5 h-5" />
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white group-hover:text-lb-green transition-colors truncate">
                      {list.title}
                    </h3>
                    {list.isRanked && (
                      <span className="text-[10px] bg-lb-elevated text-lb-text px-2 py-0.5 rounded font-mono font-semibold">
                        {t('lists_ranked')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-lb-muted">
                    <span>{t('lists_by')}</span>
                    <span className="text-lb-text font-semibold">{list.author.displayName}</span>
                  </div>

                  <p className="text-xs text-lb-text line-clamp-2 leading-relaxed pt-1">
                    {list.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-lb-muted pt-3 border-t border-lb-elevated tabular-nums">
                    <span>{list.movies.length} {list.movies.length === 1 ? t('list_film_singular') : t('home_films_word')}</span>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-lb-orange" /> {list.likesCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-lb-blue" /> {list.commentsCount}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-lb-surface/70 border border-white/10 rounded-lg px-6 py-10 md:p-12 text-center space-y-3">
            <Layers className="w-9 h-9 text-lb-muted mx-auto" />
            <h3 className="text-sm md:text-base font-bold text-white">{t('lists_empty_title')}</h3>
            <p className="text-xs text-lb-text max-w-sm mx-auto leading-relaxed">
              {t('lists_empty_desc')}
            </p>
            <Link
              to="/list/new"
              className="mt-1 inline-flex items-center gap-1.5 bg-lb-green hover:bg-lb-green-hover text-lb-bg font-black text-xs uppercase px-4 py-2 rounded-sm cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>{t('lists_start')}</span>
            </Link>
          </div>
        )}
      </div>
    </>
  );
};

