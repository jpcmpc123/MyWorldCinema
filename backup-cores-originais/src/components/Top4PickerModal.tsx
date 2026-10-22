import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tmdb, type TMDBMovie } from '../services/tmdb';
import { useLanguage } from '../i18n/LanguageContext';

export const Top4PickerModal: React.FC = () => {
  const { isTop4PickerOpen, closeTop4Picker, activeTop4Slot, setTop4Movie } = useApp();
  const { t } = useLanguage();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await tmdb.searchMovies(query.trim(), 1);
        setResults(res.results.slice(0, 10));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Lock body scroll while modal is open + close on Escape
  useEffect(() => {
    if (!isTop4PickerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTop4Picker();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isTop4PickerOpen, closeTop4Picker]);

  if (!isTop4PickerOpen || activeTop4Slot === null) return null;

  const handleSelect = (movieId: number) => {
    setTop4Movie(activeTop4Slot, movieId);
    closeTop4Picker();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-lb-surface border border-lb-elevated w-full max-w-lg rounded-lg shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-lb-bg border-b border-lb-elevated flex items-center justify-between">
          <span className="text-xs uppercase font-bold tracking-wider text-lb-text">
            {t('top4_select')} #{activeTop4Slot + 1}
          </span>
          <button onClick={closeTop4Picker} aria-label={t('btn_close')} className="text-lb-muted hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center bg-lb-bg border border-lb-elevated rounded px-3 py-2">
            <Search className="w-4 h-4 text-lb-muted mr-2" />
            <input
              type="text"
              placeholder={t('top4_search_ph')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="bg-transparent text-sm text-white focus:outline-none w-full"
            />
          </div>

          <div className="max-h-80 overflow-y-auto space-y-1 divide-y divide-lb-elevated">
            {results.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => handleSelect(m.id)}
                className="pt-2 pb-2 flex items-center gap-3 hover:bg-lb-elevated px-2 rounded cursor-pointer transition-colors w-full text-left"
              >
                <img
                  src={tmdb.getImageUrl(m.poster_path, 'w92')}
                  alt={m.title}
                  className="w-10 h-15 object-cover rounded bg-lb-bg shrink-0 border border-white/10"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate">{m.title}</h4>
                  <p className="text-xs text-lb-muted">{m.release_date?.slice(0, 4)}</p>
                </div>
              </button>
            ))}

            {loading && <p className="text-center text-xs text-lb-green py-4">{t('search_searching')}</p>}
            {!loading && query.length >= 2 && results.length === 0 && (
              <p className="text-center text-xs text-lb-muted py-4">{t('top4_no_films')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
