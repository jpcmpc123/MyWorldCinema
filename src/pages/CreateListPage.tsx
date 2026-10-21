import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tmdb, type TMDBMovie } from '../services/tmdb';
import { useLanguage } from '../i18n/LanguageContext';

interface SelectedListItem {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  notes: string;
}

export const CreateListPage: React.FC = () => {
  const navigate = useNavigate();
  const { createList } = useApp();
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isRanked, setIsRanked] = useState(false);
  const [items, setItems] = useState<SelectedListItem[]>([]);

  // Search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await tmdb.searchMovies(query.trim(), 1);
        setResults(res.results.slice(0, 6));
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const addMovie = (movie: TMDBMovie) => {
    if (items.some((i) => i.id === movie.id)) return;
    setItems((prev) => [
      ...prev,
      {
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        release_date: movie.release_date || '',
        notes: '',
      },
    ]);
    setQuery('');
    setResults([]);
  };

  const removeMovie = (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const next = [...items];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setItems(next);
  };

  const updateNotes = (id: number, notes: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, notes } : i)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || items.length === 0) return;

    createList({
      title: title.trim(),
      description: description.trim(),
      isRanked,
      isPrivate: false,
      movies: items,
    });

    navigate('/lists');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="border-b border-lb-elevated pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {t('create_list_title')}
        </h1>
        <p className="text-xs text-lb-text mt-1">
          {t('create_list_desc')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title & Description */}
        <div className="bg-lb-surface border border-lb-elevated rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-xs uppercase font-bold text-lb-muted mb-1">
              {t('create_list_name')} *
            </label>
            <input
              type="text"
              placeholder={t('create_list_name_ph')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-lb-bg border border-lb-elevated rounded p-2.5 text-sm text-white focus:outline-none focus:border-lb-green"
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-bold text-lb-muted mb-1">
              {t('create_list_description')}
            </label>
            <textarea
              rows={3}
              placeholder={t('create_list_desc_ph')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-lb-bg border border-lb-elevated rounded p-2.5 text-xs text-white focus:outline-none focus:border-lb-green"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-lb-white">
              <input
                type="checkbox"
                checked={isRanked}
                onChange={(e) => setIsRanked(e.target.checked)}
                className="rounded border-lb-elevated text-lb-green bg-lb-bg"
              />
              <span className="font-semibold">{t('create_list_ranked')}</span>
            </label>
          </div>
        </div>

        {/* Film Search & Add */}
        <div className="bg-lb-surface border border-lb-elevated rounded-lg p-5 space-y-4">
          <label className="block text-xs uppercase font-bold text-lb-muted">
            {t('create_list_add_films')}
          </label>

          <div className="relative">
            <div className="flex items-center bg-lb-bg border border-lb-elevated rounded px-3 py-2">
              <Search className="w-4 h-4 text-lb-muted mr-2" />
              <input
                type="text"
                placeholder={t('create_list_search_ph')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-transparent text-sm text-white focus:outline-none w-full"
              />
            </div>

            {results.length > 0 && (
              <div className="absolute top-12 left-0 right-0 bg-lb-bg border border-lb-elevated rounded shadow-2xl z-20 max-h-60 overflow-y-auto divide-y divide-lb-elevated">
                {results.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => addMovie(m)}
                    className="p-2.5 flex items-center gap-3 hover:bg-lb-elevated cursor-pointer group w-full text-left"
                  >
                    <img loading="lazy" decoding="async"
                      src={tmdb.getImageUrl(m.poster_path, 'w92')}
                      alt={m.title}
                      className="w-8 h-12 object-cover rounded bg-lb-elevated"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-lb-green truncate">
                        {m.title}
                      </p>
                      <p className="text-[11px] text-lb-muted">{m.release_date?.slice(0, 4)}</p>
                    </div>
                    <Plus className="w-4 h-4 text-lb-green" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Added Films List */}
          <div className="space-y-3 pt-2">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="bg-lb-bg border border-lb-elevated rounded p-3 flex gap-3 items-center group"
              >
                {isRanked && (
                  <span className="font-mono font-bold text-sm text-lb-green w-6 text-center">
                    #{idx + 1}
                  </span>
                )}

                <img loading="lazy" decoding="async"
                  src={tmdb.getImageUrl(item.poster_path, 'w92')}
                  alt={item.title}
                  className="w-10 h-15 object-cover rounded shadow"
                />

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">{item.title}</span>
                    <span className="text-xs text-lb-muted">{item.release_date?.slice(0, 4)}</span>
                  </div>
                  <input
                    type="text"
                    placeholder={t('create_list_note_ph')}
                    value={item.notes}
                    onChange={(e) => updateNotes(item.id, e.target.value)}
                    className="w-full bg-lb-surface border border-lb-elevated rounded px-2 py-1 text-xs text-lb-white focus:outline-none focus:border-lb-green"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveItem(idx, 'up')}
                    className="p-1 text-lb-muted hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === items.length - 1}
                    onClick={() => moveItem(idx, 'down')}
                    className="p-1 text-lb-muted hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMovie(item.id)}
                    className="p-1 text-lb-muted hover:text-lb-red ml-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <p className="text-center py-6 text-xs text-lb-muted">
                {t('create_list_empty')}
              </p>
            )}
          </div>
        </div>

        {/* Save CTA */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/lists')}
            className="px-4 py-2 text-xs font-bold uppercase text-lb-text hover:text-white"
          >
            {t('btn_cancel')}
          </button>
          <button
            type="submit"
            disabled={!title.trim() || items.length === 0}
            className={`px-6 py-2.5 rounded font-black text-xs uppercase tracking-wider transition-all ${
              title.trim() && items.length > 0
                ? 'bg-lb-green hover:bg-lb-green-hover text-lb-bg cursor-pointer shadow-[0_0_12px_rgba(0,224,84,0.3)]'
                : 'bg-lb-elevated text-lb-muted cursor-not-allowed'
            }`}
          >
            {t('create_list_save')}
          </button>
        </div>
      </form>
    </div>
  );
};
