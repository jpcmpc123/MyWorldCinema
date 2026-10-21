import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shuffle, Clock, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../context/AppContext';
import { PosterCard } from '../components/PosterCard';
import { tmdb } from '../services/tmdb';
import { useLanguage } from '../i18n/LanguageContext';

export const WatchlistPage: React.FC = () => {
  const { watchlist } = useApp();
  const { t } = useLanguage();

  const [shuffledMovie, setShuffledMovie] = useState<{
    id: number;
    title: string;
    poster_path: string | null;
    release_date: string;
  } | null>(null);

  const [isShuffling, setIsShuffling] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Lock body scroll while the shuffle modal is open + close on Escape
  useEffect(() => {
    if (!isModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isModalOpen]);

  const handleShuffle = () => {
    if (watchlist.length === 0) return;
    setIsModalOpen(true);
    setIsShuffling(true);

    let counter = 0;
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * watchlist.length);
      setShuffledMovie(watchlist[randomIdx]);
      counter++;

      if (counter >= 12) {
        clearInterval(interval);
        setIsShuffling(false);
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#40bcf4', '#00e054', '#ffffff'],
        });
      }
    }, 100);
  };

  return (
    <div className="max-w-[950px] mx-auto px-4 pt-3 pb-4 md:py-8 space-y-4 md:space-y-6">
      {/* Mobile Header — padrão visual idêntico às abas de Diário e Listas */}
      <div className="md:hidden space-y-2.5 border-b border-white/10 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-[15px] font-bold text-white tracking-tight flex items-center gap-2">
            <span>{t('hdr_watchlist')}</span>
            <span className="text-xs font-normal text-lb-muted tabular-nums">({watchlist.length})</span>
          </h1>

          {watchlist.length > 0 && (
            <button
              onClick={handleShuffle}
              className="flex items-center gap-1.5 bg-lb-blue hover:bg-[#32a8dd] text-lb-bg font-black text-[11px] uppercase px-2.5 py-1 rounded-sm transition-all cursor-pointer shrink-0"
            >
              <Shuffle className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{t('wl_shuffle')}</span>
            </button>
          )}
        </div>
        <p className="text-[11px] text-lb-muted leading-snug">
          {t('wl_desc')}
        </p>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex sm:flex-row sm:items-center justify-between gap-4 border-b border-lb-elevated pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>{t('hdr_watchlist')}</span>
            <span className="text-sm font-normal text-lb-muted tabular-nums">({watchlist.length} {t('wl_films_count')})</span>
          </h1>
          <p className="text-xs text-lb-text mt-1">
            {t('wl_desc')}
          </p>
        </div>

        {watchlist.length > 0 && (
          <button
            onClick={handleShuffle}
            className="flex items-center gap-2 bg-lb-blue hover:bg-[#32a8dd] text-lb-bg font-black text-xs uppercase px-4 py-2 rounded-sm transition-all shadow-[0_0_12px_rgba(64,188,244,0.3)] cursor-pointer shrink-0"
          >
            <Shuffle className="w-4 h-4 stroke-[2.5]" />
            <span>{t('wl_shuffle')}</span>
          </button>
        )}
      </div>

      {/* Grid of Posters */}
      {watchlist.length > 0 ? (
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-4">
          {watchlist.map((movie) => (
            <PosterCard key={movie.id} movie={movie} size="fluid" showDetails enableLongPressActions />
          ))}
        </div>
      ) : (
        <div className="bg-lb-surface border border-lb-elevated rounded-lg p-16 text-center space-y-3">
          <Clock className="w-10 h-10 text-lb-muted mx-auto" />
          <h3 className="text-base font-bold text-white">{t('wl_empty')}</h3>
          <p className="text-xs text-lb-text">
            {t('wl_hint')}
          </p>
          <Link
            to="/films"
            className="inline-block mt-2 bg-lb-green text-lb-bg font-black text-xs uppercase px-5 py-2 rounded-sm"
          >
            {t('wl_browse')}
          </Link>
        </div>
      )}

      {/* Shuffle Picker Modal */}
      {isModalOpen && shuffledMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="bg-lb-surface border border-lb-elevated w-full max-w-sm rounded-lg p-6 shadow-2xl text-center space-y-4">
            <div className="flex justify-between items-center border-b border-lb-elevated pb-2">
              <span className="text-xs uppercase font-bold tracking-wider text-lb-blue flex items-center gap-1.5">
                <Shuffle className="w-3.5 h-3.5" />
                {t('wl_tonight')}
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label={t('btn_close')}
                className="text-lb-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center py-2">
              <div
                className={`w-44 aspect-[2/3] rounded-md overflow-hidden shadow-2xl border-2 transition-all ${
                  isShuffling
                    ? 'border-lb-blue scale-95 opacity-80'
                    : 'border-lb-green scale-100 shadow-[0_0_20px_rgba(0,224,84,0.3)]'
                }`}
              >
                <img loading="lazy" decoding="async"
                  src={tmdb.getImageUrl(shuffledMovie.poster_path, 'w500')}
                  alt={shuffledMovie.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <h3 className="font-bold text-white text-base mt-4 line-clamp-1">
                {shuffledMovie.title}
              </h3>
              <p className="text-xs text-lb-muted">
                {shuffledMovie.release_date?.slice(0, 4)}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleShuffle}
                disabled={isShuffling}
                className="flex-1 py-2 bg-lb-elevated hover:bg-lb-border text-white text-xs font-bold uppercase rounded transition-colors"
              >
                {t('wl_spin')}
              </button>
              <Link
                to={`/film/${shuffledMovie.id}`}
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 bg-lb-green hover:bg-lb-green-hover text-lb-bg text-xs font-black uppercase rounded transition-colors"
              >
                {t('wl_view_film')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
