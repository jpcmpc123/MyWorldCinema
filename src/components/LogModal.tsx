import React, { useState, useEffect } from 'react';
import { X, Search, Calendar, Heart, AlertTriangle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../context/AppContext';
import { tmdb, type TMDBMovie } from '../services/tmdb';
import { StarRating } from './StarRating';
import { useLanguage } from '../i18n/LanguageContext';

export const LogModal: React.FC = () => {
  const { isLogModalOpen, closeLogModal, selectedMovieForLog, saveLog, ratingsMap, isMovieLiked } = useApp();
  const { t } = useLanguage();

  const [movie, setMovie] = useState<TMDBMovie | { id: number; title: string; poster_path: string | null; release_date?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBMovie[]>([]);
  const [, setIsSearching] = useState(false);

  // Form fields
  const [watchDate, setWatchDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isRewatch, setIsRewatch] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [reviewText, setReviewText] = useState('');
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [tagsInput, setTagsInput] = useState('');

  // Prepopulate if movie was passed
  useEffect(() => {
    if (selectedMovieForLog) {
      setMovie(selectedMovieForLog);
      setRating(ratingsMap[selectedMovieForLog.id] || 0);
      setLiked(isMovieLiked(selectedMovieForLog.id));
    } else {
      setMovie(null);
      setRating(0);
      setLiked(false);
    }
    setReviewText('');
    setTagsInput('');
    setContainsSpoilers(false);
    setSearchQuery('');
    setSearchResults([]);
  }, [selectedMovieForLog, isLogModalOpen]);

  // Lock body scroll while modal is open + close on Escape
  useEffect(() => {
    if (!isLogModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLogModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isLogModalOpen, closeLogModal]);

  // Live search inside modal if no movie selected
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await tmdb.searchMovies(searchQuery.trim(), 1);
        setSearchResults(res.results.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isLogModalOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movie) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    saveLog({
      movieId: movie.id,
      movieTitle: movie.title,
      moviePoster: movie.poster_path,
      movieYear: movie.release_date?.slice(0, 4) || '',
      watchedDate: watchDate,
      rating,
      isRewatch,
      liked,
      reviewText,
      containsSpoilers,
      tags,
    });

    // Fire subtle celebration
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#00e054', '#40bcf4', '#ff8000'],
    });

    closeLogModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto mw-overlay-fade">
      <div className="bg-lb-surface border border-lb-elevated w-full max-w-lg rounded-lg shadow-2xl overflow-hidden my-8 mw-pop-in">
        {/* Header */}
        <div className="px-5 py-3.5 bg-lb-bg border-b border-lb-elevated flex items-center justify-between">
          <span className="text-xs uppercase font-bold tracking-wider text-lb-text">
            {movie ? `${t('log_film_prefix')} ${movie.title}` : t('log_a_film')}
          </span>
          <button
            onClick={closeLogModal}
            aria-label={t('btn_close')}
            className="text-lb-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Film Selection or Preview */}
          {!movie ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-lb-muted">
                {t('log_find_film')}
              </label>
              <div className="relative">
                <div className="flex items-center bg-lb-bg border border-lb-elevated rounded px-3 py-2">
                  <Search className="w-4 h-4 text-lb-muted mr-2" />
                  <input
                    type="text"
                    placeholder="Search for a film to log..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="bg-transparent text-sm text-white focus:outline-none w-full"
                  />
                </div>

                {/* Search Results Dropdown in Modal */}
                {searchResults.length > 0 && (
                  <div className="mt-1 bg-lb-bg border border-lb-elevated rounded shadow-lg max-h-48 overflow-y-auto divide-y divide-lb-elevated">
                    {searchResults.map((res) => (
                      <button
                        type="button"
                        key={res.id}
                        aria-label={res.title}
                        onClick={() => {
                          setMovie(res);
                          setRating(ratingsMap[res.id] || 0);
                          setLiked(isMovieLiked(res.id));
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="p-2 flex items-center gap-3 hover:bg-lb-elevated cursor-pointer w-full text-left"
                      >
                        <img
                          src={tmdb.getImageUrl(res.poster_path, 'w92')}
                          alt={res.title}
                          className="w-8 h-12 object-cover rounded bg-lb-elevated"
                        />
                        <div>
                          <p className="text-xs font-bold text-white">{res.title}</p>
                          <p className="text-[11px] text-lb-muted">{res.release_date?.slice(0, 4)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 bg-lb-bg p-3 rounded border border-lb-elevated">
              <img
                src={tmdb.getImageUrl(movie.poster_path, 'w185')}
                alt={movie.title}
                className="w-12 h-18 object-cover rounded shadow border border-white/10"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white text-base truncate">{movie.title}</h3>
                <p className="text-xs text-lb-muted">{movie.release_date?.slice(0, 4)}</p>
              </div>
              <button
                type="button"
                onClick={() => setMovie(null)}
                className="text-xs text-lb-blue hover:underline"
              >
                {t('log_change')}
              </button>
            </div>
          )}

          {/* Date & Rewatch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-lb-muted block mb-1">
                {t('log_date_watched')}
              </label>
              <div className="flex items-center bg-lb-bg border border-lb-elevated rounded px-3 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-lb-muted mr-2" />
                <input
                  type="date"
                  value={watchDate}
                  onChange={(e) => setWatchDate(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none w-full"
                />
              </div>
            </div>

            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-lb-text hover:text-white">
                <input
                  type="checkbox"
                  checked={isRewatch}
                  onChange={(e) => setIsRewatch(e.target.checked)}
                  className="rounded border-lb-elevated text-lb-green focus:ring-0 focus:ring-offset-0 bg-lb-bg"
                />
                <span>{t('log_rewatch')}</span>
              </label>
            </div>
          </div>

          {/* Rating and Liked */}
          <div className="flex items-center justify-between bg-lb-bg p-3 rounded border border-lb-elevated">
            <div>
              <label className="text-xs font-semibold uppercase text-lb-muted block mb-1">
                {t('log_rating')}
              </label>
              <div className="flex items-center gap-2">
                <StarRating value={rating} onChange={setRating} size="lg" />
                {rating > 0 && (
                  <span className="text-xs font-bold text-lb-green ml-1">{rating.toFixed(1)}</span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <label className="text-xs font-semibold uppercase text-lb-muted block mb-1">
                {t('action_like')}
              </label>
              <button
                type="button"
                onClick={() => setLiked(!liked)}
                className={`p-2 rounded-full border transition-all ${
                  liked
                    ? 'bg-lb-orange border-lb-orange text-white shadow-[0_0_10px_rgba(255,128,0,0.5)]'
                    : 'bg-lb-surface border-lb-elevated text-lb-muted hover:text-lb-orange'
                }`}
              >
                <Heart className={`w-5 h-5 ${liked ? 'fill-white' : ''}`} />
              </button>
            </div>
          </div>

          {/* Review text */}
          <div>
            <label className="text-xs font-semibold uppercase text-lb-muted block mb-1">
              {t('log_add_review')}
            </label>
            <textarea
              rows={4}
              placeholder={t('log_review_ph')}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="w-full bg-lb-bg border border-lb-elevated rounded p-3 text-sm text-white placeholder-lb-muted focus:outline-none focus:border-lb-green"
            />
          </div>

          {/* Spoilers & Tags */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-lb-orange hover:text-[#ff9933]">
              <input
                type="checkbox"
                checked={containsSpoilers}
                onChange={(e) => setContainsSpoilers(e.target.checked)}
                className="rounded border-lb-elevated text-lb-orange bg-lb-bg"
              />
              <span className="flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t('log_spoilers')}
              </span>
            </label>

            <div>
              <label className="text-[11px] font-semibold uppercase text-lb-muted block mb-1">
                {t('log_tags')}
              </label>
              <input
                type="text"
                placeholder={t('log_tags_ph')}
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full bg-lb-bg border border-lb-elevated rounded px-3 py-1.5 text-xs text-white placeholder-lb-muted focus:outline-none focus:border-lb-green"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-lb-elevated">
            <button
              type="button"
              onClick={closeLogModal}
              className="px-4 py-2 text-xs font-bold uppercase text-lb-text hover:text-white transition-colors"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="submit"
              disabled={!movie}
              className={`px-5 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                movie
                  ? 'bg-lb-green hover:bg-lb-green-hover text-lb-bg cursor-pointer shadow-[0_0_12px_rgba(0,224,84,0.3)]'
                  : 'bg-lb-elevated text-lb-muted cursor-not-allowed'
              }`}
            >
              {t('log_save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
