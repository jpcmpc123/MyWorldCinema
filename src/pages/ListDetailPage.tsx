import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, Trash2, ArrowLeft, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tmdb } from '../services/tmdb';
import { useLanguage } from '../i18n/LanguageContext';

export const ListDetailPage: React.FC = () => {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lists, deleteList, user } = useApp();

  const list = lists.find((l) => l.id === id);
  const [likedList, setLikedList] = useState(false);

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

  const isAuthor = list.author.username === user.username;

  const handleDelete = () => {
    if (confirm(t('lists_delete_confirm'))) {
      deleteList(list.id);
      navigate('/lists');
    }
  };

  return (
    <div className="max-w-[950px] mx-auto px-4 py-8 space-y-8">
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
              {list.author.avatarUrl ? (
                <img loading="lazy" decoding="async"
                  src={list.author.avatarUrl}
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
              <span>{list.likesCount + (likedList ? 1 : 0)} {t('lists_likes')}</span>
            </button>

            {isAuthor && (
              <button
                onClick={handleDelete}
                className="p-1.5 bg-lb-surface border border-lb-elevated hover:border-lb-red text-lb-muted hover:text-lb-red rounded transition-colors"
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
        {list.movies.map((m, idx) => (
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
              <img loading="lazy" decoding="async"
                src={tmdb.getImageUrl(m.poster_path, 'w185')}
                alt={m.title}
                className="w-16 h-24 sm:w-20 sm:h-30 object-cover rounded shadow border border-white/10 group-hover:border-lb-green transition-colors"
              />
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
        ))}
      </div>
    </div>
  );
};
